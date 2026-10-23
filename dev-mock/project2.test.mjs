import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from './server.mjs';
import {seed,publicReport,transition,candidates} from './domain.mjs';
import {publicReport as previewPublicReport} from '../browser-preview/domain.mjs';

test('PDF constraint 6: public projections omit private notes and future private fields',()=>{
 const r=seed().reports.find(r=>r.completion);
 r.description='Private contact 09123456789';r.title='Reporter name';r.feedback={text:'Call me privately'};r.internalSecret='hidden';r.updates=[{note:'Staff contact'}];
 r.history.push({id:'private',at:r.updatedAt,action:'flag',from:r.status,to:r.status,note:'Private contact',actor:'Staff name'});
 r.completion.note='Private repair contact';r.location.landmark='Reporter house';r.photos[0].name='reporter-name.png';
 for(const project of [publicReport,previewPublicReport]){
  const p=project(r);const text=JSON.stringify(p);
  for(const key of ['reporterId','assignment','teamId','feedback','updates','internalSecret','flagged','jurisdiction'])assert.equal(p[key],undefined,key);
  for(const value of ['09123456789','Staff name','Private repair contact','Reporter house','reporter-name.png'])assert.ok(!text.includes(value),value);
  assert.ok(p.photos.length);assert.equal(p.status,r.status);assert.ok(p.history.every(h=>!('actor' in h)));assert.ok(p.completion.photos.length);
 }
});

test('PDF workflow: invalid transitions, forwarding and duplicate confirmation stay explicit',()=>{
 const db=seed(),r=db.reports[0];
 assert.throws(()=>transition(r,'citizen','verify'));
 assert.throws(()=>transition(r,'admin','resolve'));
 assert.throws(()=>transition(r,'admin','reject',{note:''}));
 transition(r,'admin','forward',{jurisdiction:'Provincial road office',note:'Jurisdiction check'});
 assert.equal(r.jurisdiction,'Provincial road office');assert.equal(r.status,'Submitted');
 transition(r,'admin','flag',{note:'Inspect evidence'});assert.equal(r.flagged,true);
 assert.throws(()=>transition(r,'admin','duplicate',{duplicateOf:r.id}));
 transition(r,'admin','duplicate',{duplicateOf:db.reports[1].id});assert.equal(r.status,'Duplicate');
 assert.equal(candidates(db.reports,{...db.reports[1],id:'new',location:{...db.reports[1].location,coordinates:{lat:0,lng:0}}}).length,0);
});

test('PDF FR-01 and role ownership: real registration/login, rejection and notification isolation',async()=>{
 const server=await createServer({persist:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 async function call(path,body,token,method){const r=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 try{
  const input={name:'Audit Citizen',email:'audit@example.test',password:'Audit-Test-1234'};
  assert.equal((await call('/auth/register',{...input,password:'short'})).status,400);
  const registered=await call('/auth/register',input);assert.equal(registered.status,201);const token=registered.data.token;
  assert.equal(registered.data.user.hash,undefined);assert.equal(registered.data.user.salt,undefined);
  assert.equal((await call('/auth/register',input)).status,409);
  assert.equal((await call('/auth/login',{email:input.email,password:'wrong'})).status,401);
  assert.equal((await call('/auth/login',input)).status,200);
  assert.equal((await call('/reports/PTG-2026-0101',undefined,token)).status,403);
  assert.equal((await call('/reports/PTG-2026-0101/feedback',{rating:5,text:'not mine'},token)).status,403);
  const bootstrap=await call('/bootstrap',undefined,token);assert.equal(bootstrap.data.reports.length,0);assert.equal(bootstrap.data.notifications.length,0);assert.equal(bootstrap.data.users.length,0);
  assert.equal((await call('/users',{id:'admin-1',active:false},token,'PATCH')).status,404);
  await call('/auth/logout',{},token);assert.equal((await call('/bootstrap',undefined,token)).status,401);
 }finally{await new Promise(r=>server.close(r));}
});
