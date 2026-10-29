import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { database,fixtures,ids } from './database.mjs';
const config={url:'https://test.supabase.co',publicKey:'public',serviceKey:'private-test-key',origin:'http://127.0.0.1:5173',secure:false};
const token=aal=>`header.${Buffer.from(JSON.stringify({sub:ids.admin,session_id:ids.admin,iss:config.url+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600,aal})).toString('base64url')}.signature`;
test('MFA gates data until verification; recovery and Auth-session revocation invalidate cookies',async()=>{
 const pool=await database();await fixtures(pool.db);let recoveryRequests=0,globalLogouts=0;
 const user={id:ids.admin,factors:[{id:ids.other,factor_type:'totp',status:'verified'}]};
 await pool.db.query('INSERT INTO auth.mfa_factors VALUES($1,$2,$3)',[ids.other,ids.admin,'verified']);
 const auth={login:async()=>({access_token:token('aal1'),user}),user:async()=>user,challenge:async()=>({id:ids.team}),verify:async(_token,_factor,_challenge,code)=>{if(code!=='123456')throw Object.assign(Error('Invalid verification code.'),{status:400});return {access_token:token('aal2')};},recover:async()=>{recoveryRequests++;},verifyRecovery:async()=>({access_token:token('aal2')}),updatePassword:async()=>({}),logoutAll:async()=>{globalLogouts++;},logout:async()=>({})};
 const server=createServer({config,pool,auth});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api`;
 const post=(path,body={},cookie='')=>fetch(base+path,{method:'POST',headers:{Origin:config.origin,'X-Patag-Request':'1','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 try {
  let response=await post('/auth/login',{email:'admin@example.test',password:'test password'});assert.equal(response.status,200);assert.equal((await response.json()).mfaRequired,true);
  let cookie=response.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'/bootstrap',{headers:{Cookie:cookie}})).status,403);
  assert.equal((await post('/auth/mfa',{factorId:ids.other},cookie)).status,200);
  response=await post('/auth/mfa',{factorId:ids.other,challengeId:ids.team,code:'000000'},cookie);assert.equal(response.status,400);assert.equal(response.headers.get('set-cookie'),null);
  response=await post('/auth/mfa',{factorId:ids.other,challengeId:ids.team,code:'123456'},cookie);assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/bootstrap',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await post('/auth/recovery',{email:'admin@example.test'})).status,200);assert.equal(recoveryRequests,1);
  assert.equal((await post('/auth/password',{tokenHash:'synthetic-recovery-hash',password:'new private test password'})).status,200);assert.equal(globalLogouts,1);
  assert.equal((await fetch(base+'/bootstrap',{headers:{Cookie:cookie}})).status,401);
  response=await post('/auth/login',{email:'admin@example.test',password:'test password'});cookie=response.headers.get('set-cookie').split(';')[0];
  await pool.db.query('DELETE FROM auth.sessions WHERE user_id=$1',[ids.admin]);
  assert.equal((await fetch(base+'/me',{headers:{Cookie:cookie}})).status,401);
 }finally{await new Promise(r=>server.close(r));await pool.end();}
});
