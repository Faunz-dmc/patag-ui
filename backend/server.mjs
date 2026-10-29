import http from 'node:http';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import { configuration, fail, fields, text, email, password, uuid } from './config.mjs';
import { poolFor, transaction, publicUser, audit } from './db.mjs';
import { createAuth, claimsFor, registerSession, authenticate, sessionCookie, tokenHash, readToken } from './auth.mjs';
import { bootstrap, reportEvent, getReport, markNotifications, manageTeam, settings, exportReports } from './service.mjs';
import { listReports, statistics, requireAdmin, page } from './queries.mjs';
import { provisionUser, updateUser, updateMe } from './accounts.mjs';
import { storageClient, uploadEvidence, evidenceRecord } from './evidence.mjs';
const methods={'/health':['GET'],'/auth/login':['POST'],'/auth/logout':['POST'],'/auth/recovery':['POST'],'/auth/password':['POST'],'/auth/mfa':['POST'],'/me':['GET','PATCH'],'/bootstrap':['GET'],'/reports':['GET'],'/teams':['GET','POST','PATCH'],'/users':['GET','POST','PATCH'],'/settings':['PATCH'],'/notifications':['GET'],'/notifications/read':['POST'],'/statistics':['GET'],'/exports':['POST'],'/activity':['GET'],'/duplicates':['GET','POST'],'/uploads':['POST']};
export async function rateLimit(pool,key,max=200) {
  const hash=tokenHash(key);
  const {rows}=await pool.query(`INSERT INTO patag_private.rate_limits(key,window_start,attempts) VALUES($1,date_trunc('minute',now()),1)
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN patag_private.rate_limits.window_start=date_trunc('minute',now()) THEN patag_private.rate_limits.attempts+1 ELSE 1 END,window_start=date_trunc('minute',now()) RETURNING attempts`,[hash]);
  if(rows[0].attempts>max) fail(429,'Too many requests. Wait a minute and try again.');
}
async function bodyFor(req) {
  if(!['POST','PATCH'].includes(req.method)) return {};
  if(!req.headers['content-type']?.startsWith('application/json')) fail(415,'Use application/json.');
  const chunks=[];let length=0;
  for await(const chunk of req) {length+=chunk.length;if(length>12*1024*1024) fail(413,'Request exceeds the 12 MB limit.');chunks.push(chunk);}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail(400,'Invalid JSON.');}
  if(!body||typeof body!=='object'||Array.isArray(body)) fail(400,'Expected a JSON object.');return body;
}
export function createServer({config,pool,auth=createAuth(config),storage=storageClient(config)}) {
  const server=http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Vary','Origin');
    if(config.secure) res.setHeader('Strict-Transport-Security','max-age=31536000');
    try {
      if(req.headers.origin && req.headers.origin!==config.origin) fail(403,'Request origin is not allowed.');
      if(req.headers.origin===config.origin) {res.setHeader('Access-Control-Allow-Origin',config.origin);res.setHeader('Access-Control-Allow-Credentials','true');}
      if(req.method==='OPTIONS') {if(req.headers.origin!==config.origin) fail(403,'Request origin is not allowed.');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-Patag-Request,Idempotency-Key');res.writeHead(204);res.end();return;}
      if(!['GET','HEAD'].includes(req.method) && (req.headers.origin!==config.origin||req.headers['x-patag-request']!=='1')) fail(403,'Request origin and CSRF header are required.');
      const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/')) fail(404,'Endpoint not found.');
      const path=url.pathname.slice(4),reportMatch=/^\/reports\/([^/]+)(?:\/(events|history))?$/.exec(path),evidenceMatch=/^\/evidence\/([^/]+)$/.exec(path);
      const allowed=methods[path]||(reportMatch?(reportMatch[2]==='events'?['POST']:['GET']):evidenceMatch?['GET']:null);
      if(!allowed) fail(404,'Endpoint not found.');
      if(!allowed.includes(req.method)) {res.setHeader('Allow',allowed.join(', '));fail(405,'HTTP method is not allowed for this endpoint.');}
      const body=await bodyFor(req),params=Object.fromEntries(url.searchParams);
      if(Object.keys(params).some(k=>!['limit','offset','status','severity','municipality','barangay','teamId','q','from','to','sort'].includes(k))) fail(400,'Unknown query parameter.');
      let address=req.socket.remoteAddress||'unknown';
      if(config.trustProxy) {const forwarded=req.headers['x-forwarded-for'];if(typeof forwarded!=='string'||!isIP(forwarded)) fail(400,'Trusted proxy must supply one valid client address.');address=forwarded;}
      if(path==='/health'||path.startsWith('/auth/')) await rateLimit(pool,address+':'+path+':'+(path==='/auth/login'||path==='/auth/recovery'?email(body.email):''),path==='/auth/login'?20:path==='/auth/recovery'||path==='/auth/password'?5:path==='/auth/mfa'?10:200);
      if(path==='/health') {await pool.query('SELECT 1 FROM public.patag_settings LIMIT 1');send(200,{ok:true,backend:'supabase'});return;}
      if(path==='/auth/login') {
        fields(body,['email','password','role']);
        if(typeof body.password!=='string'||body.password.length<1||body.password.length>128) fail(401,'Email or password is incorrect for this portal.');
        const session=await auth.login(email(body.email),body.password),user=session.user||await auth.user(session.access_token),claims=claimsFor(session.access_token,user,config);
        const profile=(await pool.query('SELECT * FROM public.patag_profiles WHERE id=$1 AND active',[user.id])).rows[0];
        const expected=body.role==='maintenance'?'maintenance':'administrator';
        if((body.role && !['admin','maintenance'].includes(body.role)) || !profile || profile.role!==expected) fail(403,'Account inactive or not authorized for this portal.');
        const previous=(()=>{try{return readToken(req);}catch{return null;}})();
        if(previous) await pool.query('DELETE FROM patag_private.sessions WHERE token_hash=$1',[tokenHash(previous)]);
        await registerSession(pool,session.access_token,user,config);res.setHeader('Set-Cookie',sessionCookie(config,session.access_token,claims.exp-Date.now()/1000));
        const factor=user.factors?.find(f=>f.status==='verified'&&f.factor_type==='totp');
        if(user.factors?.some(f=>f.status==='verified')&&claims.aal!=='aal2') {if(!factor) fail(403,'This account requires an MFA factor unsupported by this portal. Contact your administrator.');send(200,{mfaRequired:true,factorId:factor.id,user:publicUser(profile)});return;}
        await transaction(pool,db=>audit(db,'auth.login',profile.id,profile.municipality),claims);
        send(200,{user:publicUser(profile)});return;
      }
      if(path==='/auth/recovery') {fields(body,['email']);await auth.recover(email(body.email));send(200,{message:'If the account exists, Supabase will send recovery instructions.'});return;}
      if(path==='/auth/password') {
        fields(body,['tokenHash','accessToken','password']);
        if((body.tokenHash!==undefined)===(body.accessToken!==undefined)) fail(400,'Supply exactly one recovery token.');
        const newPassword=password(body.password);
        const token=body.tokenHash!==undefined?(await auth.verifyRecovery(text(body.tokenHash,'recovery token',2048))).access_token:text(body.accessToken,'recovery token',8192);
        const user=await auth.user(token),claims=claimsFor(token,user,config);
        const live=(await pool.query('SELECT id FROM auth.sessions WHERE id=$1 AND user_id=$2',[claims.session_id,user.id])).rows[0];
        if(!live) fail(401,'Recovery link is invalid or expired.');
        await auth.updatePassword(token,newPassword);
        try {
          try{await pool.query('DELETE FROM patag_private.sessions WHERE user_id=$1',[user.id]);}finally{await auth.logoutAll(token);}
        } catch {
          fail(503,'Password was updated, but session cleanup could not be confirmed. Sign in with your new password and contact your administrator.');
        } finally {res.setHeader('Set-Cookie',sessionCookie(config));}
        send(200,{message:'Password updated. Sign in again; enrolled MFA remains required.'});return;
      }
      if(path==='/auth/logout') {
        res.setHeader('Set-Cookie',sessionCookie(config));let token;try{token=readToken(req);}catch{send(200,{ok:true});return;}
        await pool.query('DELETE FROM patag_private.sessions WHERE token_hash=$1',[tokenHash(token)]);await auth.logout(token);send(200,{ok:true});return;
      }
      const context=await authenticate(pool,auth,config,req,{pending:path==='/auth/mfa'});
      await rateLimit(pool,'user:'+context.claims.sub,200);
      if(path==='/auth/mfa') {
        fields(body,['factorId','challengeId','code']);if(!context.factor||context.factor.id!==body.factorId) fail(403,'MFA factor is not authorized.');
        if(!body.challengeId) {send(200,await auth.challenge(context.token,body.factorId));return;}
        if(typeof body.code!=='string'||!/^\d{6}$/.test(body.code)) fail(400,'Enter a six digit verification code.');
        const session=await auth.verify(context.token,body.factorId,body.challengeId,body.code),user=await auth.user(session.access_token),claims=claimsFor(session.access_token,user,config);
        if(claims.aal!=='aal2') fail(403,'MFA verification is required.');
        await registerSession(pool,session.access_token,user,config);await pool.query('DELETE FROM patag_private.sessions WHERE token_hash=$1',[tokenHash(context.token)]);
        res.setHeader('Set-Cookie',sessionCookie(config,session.access_token,claims.exp-Date.now()/1000));send(200,{user:publicUser(context.profile)});return;
      }
      if(path==='/users'&&req.method==='POST') {send(201,await provisionUser(pool,context.claims,body,auth));return;}
      if(path==='/uploads') {send(201,await uploadEvidence(pool,context.claims,body,storage));return;}
      if(evidenceMatch) {
        const record=await transaction(pool,db=>evidenceRecord(db,evidenceMatch[1]),context.claims),response=await storage.download(record.object_path);
        const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>8388608) fail(503,'Stored evidence exceeds its allowed size.');
        res.writeHead(200,{'Content-Type':record.mime_type,'Content-Disposition':'inline'});res.end(bytes);return;
      }
      const result=await transaction(pool,async db=>{
        if(path==='/me') return req.method==='GET'?publicUser(db.actor):updateMe(db,body);
        if(path==='/bootstrap') return bootstrap(db,params);
        if(path==='/reports') return listReports(db,params);
        if(reportMatch) {
          if(reportMatch[2]==='events') return reportEvent(db,reportMatch[1],body,req.headers['idempotency-key']);
          const report=await getReport(db,reportMatch[1]);
          if(reportMatch[2]==='history') {const {limit,offset}=page(params);const {rows}=await db.query('SELECT id,created_at AS at,actor,action,from_status AS from,to_status AS to,note FROM public.patag_report_history WHERE report_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3',[report.id,limit+1,offset]);return {history:rows.slice(0,limit),nextOffset:rows.length>limit?offset+limit:null};}
          return report;
        }
        if(path==='/notifications/read') return markNotifications(db,body);
        if(path==='/settings') return settings(db,body);
        if(path==='/teams'&&req.method!=='GET') return manageTeam(db,body,req.method);
        if(path==='/users'&&req.method==='PATCH') return updateUser(db,body);
        if(path==='/exports') return exportReports(db,body);
        if(path==='/statistics') return statistics(db);
        if(path==='/activity') {requireAdmin(db);const {limit,offset}=page(params);return (await db.query('SELECT id,actor_id,action,resource_id,municipality,details,created_at FROM public.patag_audit_events ORDER BY created_at DESC,id LIMIT $1 OFFSET $2',[limit,offset])).rows;}
        if(path==='/duplicates') {
          requireAdmin(db);
          if(req.method==='GET') {
            const {limit,offset}=page(params);
            return (await db.query(`SELECT a.id AS a,b.id AS b,round(6371000*2*asin(least(1,sqrt(power(sin(radians(a.latitude-b.latitude)/2),2)+cos(radians(a.latitude))*cos(radians(b.latitude))*power(sin(radians(a.longitude-b.longitude)/2),2)))))::integer AS distance FROM public.patag_reports a JOIN public.patag_reports b ON a.id<b.id AND lower(a.road)=lower(b.road) AND lower(a.municipality)=lower(b.municipality) AND abs(a.latitude-b.latitude)<0.003 AND abs(a.longitude-b.longitude)<0.003 WHERE (a.status IN ('Submitted','Under Review') OR b.status IN ('Submitted','Under Review')) AND a.status NOT IN ('Rejected','Duplicate') AND b.status NOT IN ('Rejected','Duplicate') AND 6371000*2*asin(least(1,sqrt(power(sin(radians(a.latitude-b.latitude)/2),2)+cos(radians(a.latitude))*cos(radians(b.latitude))*power(sin(radians(a.longitude-b.longitude)/2),2))))<=150 ORDER BY distance,a.id,b.id LIMIT $1 OFFSET $2`,[Math.min(limit,50),offset])).rows;
          }
          fields(body,['id']);const report=await getReport(db,body.id);
          const {rows}=await db.query(`SELECT id,round(6371000*2*asin(least(1,sqrt(power(sin(radians(latitude-$1)/2),2)+cos(radians($1))*cos(radians(latitude))*power(sin(radians(longitude-$2)/2),2)))))::integer AS distance FROM public.patag_reports WHERE id<>$3 AND lower(road)=lower($4) AND lower(municipality)=lower($5) AND status NOT IN ('Rejected','Duplicate') ORDER BY distance LIMIT 50`,[report.location.coordinates.lat,report.location.coordinates.lng,report.id,report.location.road,report.location.city]);
          const candidates=[];for(const r of rows.filter(r=>r.distance<=150)) candidates.push({report:await getReport(db,r.id),distance:r.distance});return candidates;
        }
        const snapshot=await bootstrap(db,params);return snapshot[path.slice(1)];
      },context.claims);
      send(path==='/teams'&&req.method==='POST'?201:200,result);
    } catch(error) {
      const status=error.status||({'23505':409,'23503':400,'23514':400,'22P02':400,'22007':400,'42501':403,'40001':409,'40P01':409}[error.code])||503;
      if(status===401) res.setHeader('Set-Cookie',sessionCookie(config));
      const message=error.status?error.message:status===409?'The record changed or conflicts with existing data. Refresh and retry.':status===400?'The supplied data violates a database constraint.':status===403?'The operation is outside your authorized scope.':'Supabase database is unavailable or not initialized. Check server configuration and migrations.';
      send(status,{error:message});
    }
  });
  server.requestTimeout=30000;server.headersTimeout=10000;return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {const config=configuration(),pool=poolFor(config);await pool.query('SELECT 1 FROM public.patag_settings LIMIT 1');const server=createServer({config,pool});server.listen(config.port,'127.0.0.1',()=>console.log(`PATAG Supabase API http://127.0.0.1:${config.port}/api`));const stop=()=>server.close(()=>void pool.end());process.on('SIGINT',stop);process.on('SIGTERM',stop);}
  catch(error){console.error(error.code?'Supabase connection or migrations unavailable. Check private server configuration.':error.message);process.exitCode=1;}
}
