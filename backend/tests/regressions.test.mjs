import test from 'node:test';
import assert from 'node:assert/strict';
import { database,fixtures,ids,asUser } from './database.mjs';
import { transaction } from '../db.mjs';
import { getReport,reportEvent } from '../service.mjs';
import { listReports } from '../queries.mjs';
import { roleValue } from '../accounts.mjs';
import { migrate } from '../migrate.mjs';
import { seedAdmin } from '../seed-admin.mjs';
const claims=id=>({sub:id,session_id:id,role:'authenticated',aal:'aal1'});
test('idempotency replay rechecks changed scope and role; maintenance must own the assigned team',async()=>{
  const pool=await database();const {db}=pool;
  try {
    await fixtures(db);const key='00000000-0000-4000-8000-000000000099';
    await transaction(pool,c=>reportEvent(c,ids.report,{action:'verify'},key),claims(ids.local));
    await db.query('UPDATE public.patag_profiles SET municipality=$1 WHERE id=$2',['Baliwag',ids.local]);
    await assert.rejects(transaction(pool,c=>reportEvent(c,ids.report,{action:'verify'},key),claims(ids.local)),e=>e.status===404);
    await db.query('UPDATE public.patag_profiles SET municipality=$1,role=$2,team_id=$3 WHERE id=$4',['Malolos','maintenance',ids.team,ids.local]);
    await assert.rejects(transaction(pool,c=>reportEvent(c,ids.report,{action:'verify'},key),claims(ids.local)),e=>e.status===403);
    const otherTeam='00000000-0000-4000-8000-000000000011';
    await db.query('INSERT INTO public.patag_teams(id,name,municipality) VALUES($1,$2,$3)',[otherTeam,'Other Crew','Malolos']);
    await transaction(pool,c=>reportEvent(c,ids.report,{action:'assign',teamId:ids.team}),claims(ids.admin));
    await db.query("UPDATE public.patag_profiles SET role='maintenance',team_id=$1 WHERE id=$2",[otherTeam,ids.citizen]);
    assert.equal((await asUser(db,ids.citizen,()=>db.query('SELECT id FROM public.patag_reports'))).rows.length,0);
    await assert.rejects(transaction(pool,c=>reportEvent(c,ids.report,{action:'start'}),claims(ids.citizen)),e=>e.status===404||e.status===403);
  }finally{await pool.end();}
});
test('completion evidence is independent of the bounded original-before collection',async()=>{
  const pool=await database();const {db}=pool;
  try {
    await fixtures(db);
    await db.query("INSERT INTO public.patag_evidence(report_id,uploaded_by,object_path,name,kind,mime_type,size) SELECT $1,$2,'before-'||n,'before.png','before','image/png',20 FROM generate_series(1,100) n",[ids.report,ids.citizen]);
    const after='00000000-0000-4000-8000-000000000030';
    await db.query("INSERT INTO public.patag_evidence(id,report_id,uploaded_by,object_path,name,kind,mime_type,size) VALUES($1,$2,$3,'after','after.png','after','image/png',20)",[after,ids.report,ids.crew]);
    await db.query("INSERT INTO public.patag_completions(report_id,submitted_by,state,note,photo_ids) VALUES($1,$2,'Awaiting Verification','Patch complete',$3)",[ids.report,ids.crew,[after]]);
    const report=await transaction(pool,c=>getReport(c,ids.report),claims(ids.admin));
    assert.equal(report.photos.length,100);assert.ok(report.photos.every(p=>p.kind==='before'));assert.equal(report.completion.photos[0].id,after);
  }finally{await pool.end();}
});
test('raw migration runner applies once, repeats safely, and detects edited applied SQL',async()=>{
  const pool=await database();
  try {
    assert.deepEqual(await migrate(pool),['202610270001_admin.sql']);assert.deepEqual(await migrate(pool),[]);
    await pool.db.query("UPDATE patag_private.migrations SET checksum='tampered'");
    await assert.rejects(migrate(pool),/differs from source/);
  }finally{await pool.end();}
});
test('allowlists reject inherited keys with validation errors',async()=>{
  const pool=await database();
  try {
    await fixtures(pool.db);
    for(const value of ['constructor','__proto__','toString']) {
      assert.throws(()=>roleValue(value),e=>e.status===400);
      await assert.rejects(transaction(pool,c=>listReports(c,{sort:value}),claims(ids.admin)),e=>e.status===400);
    }
  }finally{await pool.end();}
});
test('failed bootstrap compensates independent Auth creation and never deletes an existing account',async()=>{
  const pool=await database(),remoteUsers=[];let removed=0;
  const auth={listUsers:async()=>({users:remoteUsers}),createUser:async body=>{remoteUsers.push({id:ids.admin,email:body.email});return remoteUsers[0];},deleteUser:async()=>{removed++;remoteUsers.splice(0);}};
  try {
    await assert.rejects(seedAdmin(pool,auth,{password:'private test seed password'}));
    assert.equal(remoteUsers.length,0);assert.equal(removed,1);
    remoteUsers.push({id:ids.admin,email:'admin@patag.test'});
    await assert.rejects(seedAdmin(pool,auth,{password:'private test seed password'}),/Existing account/);
    assert.equal(remoteUsers.length,1);assert.equal(removed,1);
  }finally{await pool.end();}
});
test('notification/evidence RLS denies cross-user reads and audit cannot be rewritten',async()=>{
  const pool=await database();const {db}=pool;
  try {
    await fixtures(db);
    await transaction(pool,c=>reportEvent(c,ids.report,{action:'verify'}),claims(ids.admin));
    assert.ok((await asUser(db,ids.local,()=>db.query('SELECT * FROM public.patag_notifications'))).rows.every(r=>r.user_id===ids.local));
    assert.equal((await asUser(db,ids.other,()=>db.query('SELECT * FROM public.patag_notifications'))).rows.length,0);
    await db.query("INSERT INTO public.patag_evidence(report_id,uploaded_by,object_path,name,kind,mime_type,size) VALUES($1,$2,'private','private.png','before','image/png',20)",[ids.report,ids.citizen]);
    assert.equal((await asUser(db,ids.other,()=>db.query('SELECT * FROM public.patag_evidence'))).rows.length,0);
    await assert.rejects(asUser(db,ids.admin,()=>db.query("UPDATE public.patag_audit_events SET action='changed'"),'patag_api'),/permission denied/);
    await db.query('DELETE FROM auth.sessions WHERE user_id=$1',[ids.admin]);
    assert.equal((await asUser(db,ids.admin,()=>db.query('SELECT * FROM public.patag_reports'))).rows.length,0);
  }finally{await pool.end();}
});
test('literal report search handles wildcard characters without SQL interpolation',async()=>{
 const pool=await database();
 try {
  await fixtures(pool.db);await pool.db.query('UPDATE public.patag_reports SET road=$1 WHERE id=$2',['100%_\\ road',ids.report]);
  for(const q of ['%','_','\\'])assert.equal((await transaction(pool,c=>listReports(c,{q}),claims(ids.admin))).reports.length,1);
  assert.equal((await transaction(pool,c=>listReports(c,{q:"%' OR 1=1--"}),claims(ids.admin))).reports.length,0);
 }finally{await pool.end();}
});
test('duplicate decisions keep canonical originals valid',async()=>{
 const pool=await database();
 try {
  await fixtures(pool.db);await pool.db.query('UPDATE public.patag_reports SET municipality=$1 WHERE id=$2',['Malolos',ids.outside]);
  await transaction(pool,c=>reportEvent(c,ids.report,{action:'duplicate',duplicateOf:ids.outside}),claims(ids.admin));
  await assert.rejects(transaction(pool,c=>reportEvent(c,ids.outside,{action:'reject',note:'Conflicting decision'}),claims(ids.admin)),e=>e.status===409);
  await assert.rejects(transaction(pool,c=>reportEvent(c,ids.outside,{action:'duplicate',duplicateOf:ids.report}),claims(ids.admin)),e=>e.status===409);
 }finally{await pool.end();}
});
