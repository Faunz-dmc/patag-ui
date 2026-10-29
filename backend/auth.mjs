import { createHash } from 'node:crypto';
import { fail, uuid } from './config.mjs';
export const tokenHash=token=>createHash('sha256').update(token).digest('hex');
export function claimsFor(token,user,config) {
  let claims;
  try { claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()); } catch {fail(401,'Session expired. Sign in again.');}
  if(claims.sub!==user.id||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||claims.iss!==config.url+'/auth/v1') fail(401,'Session expired. Sign in again.');
  uuid(claims.sub);
  if(typeof claims.session_id!=='string') fail(401,'Session expired. Sign in again.');
  uuid(claims.session_id);
  return {sub:claims.sub,role:'authenticated',aal:claims.aal==='aal2'?'aal2':'aal1',exp:claims.exp,session_id:claims.session_id};
}
export function createAuth(config,transport=fetch) {
  async function call(path,{method='POST',body,token,admin=false,status=400,message='Supabase authentication could not complete the request.'}={}) {
    let response;
    try {
      response=await transport(config.url+'/auth/v1'+path,{method,headers:{apikey:admin?config.serviceKey:config.publicKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:admin?{Authorization:'Bearer '+config.serviceKey}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),redirect:'error'});
    } catch {fail(503,'Supabase authentication is unavailable. Check the server configuration and connection.');}
    if(admin && [401,403].includes(response.status)) fail(503,'Supabase server administration is not configured. Check the private service-role key.');
    if(!response.ok) fail(response.status>=500||response.status===429?503:status,response.status>=500||response.status===429?'Supabase authentication is unavailable. Please retry later.':message);
    if(response.status===204) return {};
    try {return await response.json();} catch {fail(503,'Supabase returned an invalid authentication response.');}
  }
  return {
    login:(email,password)=>call('/token?grant_type=password',{body:{email,password},status:401,message:'Email or password is incorrect for this portal.'}),
    user:token=>call('/user',{method:'GET',token,status:401,message:'Session expired. Sign in again.'}),
    logout:token=>call('/logout?scope=local',{token}),
    logoutAll:token=>call('/logout?scope=global',{token}),
    recover:email=>call('/recover?redirect_to='+encodeURIComponent(config.recoveryRedirect),{body:{email}}),
    verifyRecovery:token_hash=>call('/verify',{body:{token_hash,type:'recovery'},status:401,message:'Recovery link is invalid or expired.'}),
    updatePassword:(token,password)=>call('/user',{method:'PUT',token,body:{password}}),
    challenge:(token,factorId)=>call('/factors/'+uuid(factorId)+'/challenge',{token}),
    verify:(token,factorId,challengeId,code)=>call('/factors/'+uuid(factorId)+'/verify',{token,body:{challenge_id:uuid(challengeId),code},status:400,message:'Verification code is invalid or expired.'}),
    listUsers:page=>call('/admin/users?page='+page+'&per_page=100',{method:'GET',admin:true}),
    createUser:body=>call('/admin/users',{admin:true,body}),
    updateUser:(id,body)=>call('/admin/users/'+uuid(id),{method:'PUT',admin:true,body}),
    deleteUser:id=>call('/admin/users/'+uuid(id),{method:'DELETE',admin:true}),
  };
}
export function sessionCookie(config,token='',seconds=0) {
  return `patag-session=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.floor(seconds))}${config.secure?'; Secure':''}`;
}
export function readToken(req) {
  const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('patag-session='));
  const token=cookie?.slice('patag-session='.length);
  if(!token||token.length>8192) fail(401,'Session expired. Sign in again.');
  return token;
}
export async function registerSession(pool,token,user,config) {
  const claims=claimsFor(token,user,config);
  await pool.query('DELETE FROM patag_private.sessions WHERE expires_at<now()');
  await pool.query('INSERT INTO patag_private.sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3) ON CONFLICT(token_hash) DO NOTHING',[tokenHash(token),user.id,new Date(Math.min(claims.exp*1000,Date.now()+8*3600000)).toISOString()]);
  return claims;
}
export async function authenticate(pool,auth,config,req,{pending=false}={}) {
  const token=readToken(req),hash=tokenHash(token);
  const session=(await pool.query('SELECT user_id FROM patag_private.sessions WHERE token_hash=$1 AND expires_at>now()',[hash])).rows[0];
  if(!session) fail(401,'Session expired. Sign in again.');
  const user=await auth.user(token),claims=claimsFor(token,user,config);
  const live=(await pool.query('SELECT id FROM auth.sessions WHERE id=$1 AND user_id=$2',[claims.session_id,user.id])).rows[0];
  if(!live) {await pool.query('DELETE FROM patag_private.sessions WHERE token_hash=$1',[hash]);fail(401,'Session expired. Sign in again.');}
  if(session.user_id!==user.id) fail(401,'Session expired. Sign in again.');
  const profile=(await pool.query('SELECT * FROM public.patag_profiles WHERE id=$1 AND active',[user.id])).rows[0];
  if(!profile||!['administrator','maintenance'].includes(profile.role)) fail(403,'Account inactive or not authorized for this portal.');
  const factor=user.factors?.find(f=>f.status==='verified'&&f.factor_type==='totp');
  if(!pending&&user.factors?.some(f=>f.status==='verified')&&claims.aal!=='aal2') fail(403,'MFA verification is required. Sign in again.');
  return {token,claims,user,profile,factor};
}
