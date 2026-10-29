import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { database,fixtures,ids } from './database.mjs';
const config={url:'https://test.supabase.co',publicKey:'public',serviceKey:'private-test-key',origin:'http://127.0.0.1:5173',secure:false};
const token=(changes={})=>`header.${Buffer.from(JSON.stringify({sub:ids.admin,session_id:ids.admin,iss:config.url+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600,aal:'aal1',...changes})).toString('base64url')}.signature`;
test('password recovery validates both token formats and rejects invalid or revoked sessions before updating',async()=>{
 const pool=await database();await fixtures(pool.db);const calls=[];let rejected=false,verified=token();
 const auth={verifyRecovery:async hash=>{calls.push(['verify',hash]);return {access_token:verified};},user:async value=>{calls.push(['user',value]);if(rejected)throw Object.assign(Error('Recovery link is invalid or expired.'),{status:401});return {id:ids.admin};},updatePassword:async(value,password)=>calls.push(['update',value,password]),logoutAll:async value=>calls.push(['logout',value])};
 const server=createServer({config,pool,auth});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const post=async body=>{await pool.query('DELETE FROM patag_private.rate_limits');return fetch(`http://127.0.0.1:${server.address().port}/api/auth/password`,{method:'POST',headers:{Origin:config.origin,'X-Patag-Request':'1','Content-Type':'application/json'},body:JSON.stringify(body)});};
 const password='synthetic new password';
 try{
  for(const credentials of [{tokenHash:'synthetic-hash'},{accessToken:token()}]){
   calls.length=0;const response=await post({...credentials,password});assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
   assert.deepEqual(calls.map(c=>c[0]),credentials.tokenHash?['verify','user','update','logout']:['user','update','logout']);assert.equal(calls.find(c=>c[0]==='update')[2],password);
  }
  for(const credentials of [{},{tokenHash:'hash',accessToken:token()},{accessToken:''},{accessToken:token(),extra:true}]){calls.length=0;assert.equal((await post({...credentials,password})).status,400);assert.equal(calls.length,0);}
  calls.length=0;assert.equal((await post({tokenHash:'hash',password:'short'})).status,400);assert.equal(calls.length,0);
  rejected=true;calls.length=0;assert.equal((await post({accessToken:token(),password})).status,401);assert.deepEqual(calls.map(c=>c[0]),['user']);rejected=false;
  for(const invalid of [token({exp:1}),token({sub:ids.other}),token({iss:'https://wrong.example/auth/v1'})]){calls.length=0;assert.equal((await post({accessToken:invalid,password})).status,401);assert.deepEqual(calls.map(c=>c[0]),['user']);}
  await pool.query('DELETE FROM auth.sessions WHERE user_id=$1',[ids.admin]);calls.length=0;assert.equal((await post({accessToken:token(),password})).status,401);assert.deepEqual(calls.map(c=>c[0]),['user']);
 }finally{await new Promise(r=>server.close(r));await pool.end();}
});

test('post-update cleanup failures report that the password already changed and clear the cookie',async()=>{
 for(const failure of ['database','logout']){
  let updated=0,loggedOut=0;
  const pool={query:async sql=>{if(sql.startsWith('DELETE FROM patag_private.sessions')&&failure==='database')throw Error('private database detail');return {rows:[{id:ids.admin,attempts:1}]};}};
  const auth={user:async()=>({id:ids.admin}),updatePassword:async()=>{updated++;},logoutAll:async()=>{loggedOut++;if(failure==='logout')throw Error('private provider detail');}};
  const server=createServer({config,pool,auth});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/password`,{method:'POST',headers:{Origin:config.origin,'X-Patag-Request':'1','Content-Type':'application/json'},body:JSON.stringify({accessToken:token(),password:'synthetic new password'})});
   assert.equal(response.status,503);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);const result=await response.json();assert.match(result.error,/Password was updated.*session cleanup/s);assert.ok(!result.error.includes('private'));assert.equal(updated,1);assert.equal(loggedOut,1);
  }finally{await new Promise(r=>server.close(r));}
 }
});
