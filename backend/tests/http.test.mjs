import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';
import { database, fixtures, ids } from './database.mjs';
const config={url:'https://test.supabase.co',publicKey:'public',serviceKey:'private-server-key',origin:'http://127.0.0.1:5173',secure:false};
const jwt=(id,exp=Math.floor(Date.now()/1000)+3600)=>`header.${Buffer.from(JSON.stringify({sub:id,session_id:id,exp,iss:config.url+'/auth/v1',aal:'aal1'})).toString('base64url')}.signature`;
test('HTTP login, secure cookie contract, CSRF, expiry, inactive/role rejection, logout and unavailable Auth',async()=>{
  const pool=await database();await fixtures(pool.db);let identity=ids.admin,expired=false,unavailable=false;
  const auth={login:async(email,password)=>{if(unavailable)throw Object.assign(Error('Supabase authentication is unavailable.'),{status:503});if(password!=='private test password')throw Object.assign(Error('Invalid credentials'),{status:401});return {access_token:jwt(identity,expired?1:undefined),user:{id:identity,email}};},user:async()=>({id:identity,factors:[]}),logout:async()=>({}),recover:async()=>({})};
  const server=createServer({config,pool,auth});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api`;
  const post=(path,body={},cookie='',origin=config.origin)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'X-Patag-Request':'1','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  try {
    assert.equal((await post('/auth/login',{email:'a@example.test',password:'wrong'})).status,401);
    assert.equal((await post('/auth/login',{email:'a@example.test',password:'private test password'},'','https://evil.test')).status,403);
    let response=await post('/auth/login',{email:'a@example.test',password:'private test password',role:'admin'});
    assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
    assert.ok(!(await response.text()).includes('access_token'));
    assert.equal((await fetch(base+'/bootstrap',{headers:{Cookie:cookie}})).status,200);
    assert.equal((await post('/duplicates',{id:ids.report},cookie)).status,200);
    assert.equal((await fetch(base+'/duplicates?limit=50',{headers:{Cookie:cookie}})).status,200);
    for(const action of ['review','flag','verify']) assert.equal((await post('/reports/'+ids.report+'/events',{action,note:'HTTP history test'},cookie)).status,200);
    const firstHistory=await (await fetch(base+'/reports/'+ids.report+'/history?limit=1',{headers:{Cookie:cookie}})).json();
    const nextHistory=await (await fetch(base+'/reports/'+ids.report+'/history?limit=1&offset=1',{headers:{Cookie:cookie}})).json();
    assert.equal(firstHistory.history.length,1);assert.equal(firstHistory.nextOffset,1);assert.notEqual(firstHistory.history[0].id,nextHistory.history[0].id);
    assert.equal((await fetch(base+'/notifications/read',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/bootstrap',{method:'DELETE',headers:{Origin:config.origin,'X-Patag-Request':'1','Content-Type':'application/json'}})).status,405);
    assert.equal((await post('/auth/logout',{},cookie)).status,200);
    assert.equal((await fetch(base+'/bootstrap',{headers:{Cookie:cookie}})).status,401);
    identity=ids.inactive;assert.equal((await post('/auth/login',{email:'a@example.test',password:'private test password'})).status,403);
    identity=ids.citizen;assert.equal((await post('/auth/login',{email:'a@example.test',password:'private test password'})).status,403);
    identity=ids.admin;expired=true;assert.equal((await post('/auth/login',{email:'a@example.test',password:'private test password'})).status,401);
    expired=false;unavailable=true;response=await post('/auth/login',{email:'a@example.test',password:'private test password'});assert.equal(response.status,503);assert.ok(!(await response.text()).includes(config.serviceKey));
    assert.equal((await post('/auth/demo',{role:'admin'})).status,404);
  }finally{await new Promise(r=>server.close(r));await pool.end();}
});
