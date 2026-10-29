import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEvent, eventInput } from '../workflow.mjs';
const report = (status='Submitted') => ({ status, teamId:'00000000-0000-4000-8000-000000000010', flagged:false, publicPhotosApproved:false, completion:null, assignment:null });
const admin = { role:'administrator' }, crew = { role:'maintenance',team_id:'00000000-0000-4000-8000-000000000010' };
test('canonical review, verification, assignment, repair and resolution transitions', () => {
  const r=report(); applyEvent(r,admin,eventInput({action:'review'})); assert.equal(r.status,'Under Review');
  applyEvent(r,admin,eventInput({action:'verify'})); assert.equal(r.status,'Verified');
  applyEvent(r,admin,eventInput({action:'assign',teamId:'00000000-0000-4000-8000-000000000010',priority:'High'})); assert.equal(r.status,'Assigned');
  applyEvent(r,crew,eventInput({action:'start'})); assert.equal(r.status,'In Progress');
  applyEvent(r,crew,eventInput({action:'complete',note:'Patch compacted',photos:[{id:'00000000-0000-4000-8000-000000000030'}]})); assert.equal(r.status,'In Progress'); assert.equal(r.completion.state,'Awaiting Verification');
  applyEvent(r,admin,eventInput({action:'resolve'})); assert.equal(r.status,'Resolved'); assert.equal(r.completion.state,'Verified');
});
test('invalid roles, transitions, missing rejection notes and mass assignment fail', () => {
  assert.throws(()=>applyEvent(report(),crew,{action:'verify'}),/authorized/);
  assert.throws(()=>applyEvent(report('Assigned'),{role:'maintenance',team_id:'00000000-0000-4000-8000-000000000011'},{action:'start'}),/another maintenance team/);
  assert.throws(()=>applyEvent(report(),admin,{action:'resolve'}),/transition/);
  assert.throws(()=>eventInput({action:'reject',note:''}),/note/);
  assert.throws(()=>eventInput({action:'verify',status:'Resolved'}),/fields/);
  assert.throws(()=>eventInput({action:{toString:'invalid'}}),e=>e.status===400);
  assert.throws(()=>eventInput({action:'assign',teamId:'00000000-0000-4000-8000-000000000010',targetDate:0}),e=>e.status===400);
  assert.throws(()=>eventInput({action:'assign',teamId:'bad'}),/identifier/);
  assert.throws(()=>applyEvent({...report('In Progress'),completion:{state:'Awaiting Verification'}},crew,{action:'progress',note:'Test',phase:'Repair'}),/review/);
});
test('return requires a reason and permits new repair evidence after additional work', () => {
  const r={...report('In Progress'),completion:{state:'Awaiting Verification'}};
  applyEvent(r,admin,eventInput({action:'return',note:'Inspect patch edge'}));
  assert.equal(r.completion.state,'Additional Work Requested');
  applyEvent(r,crew,eventInput({action:'progress',phase:'Repair',note:'Reworking edge'}));
  assert.equal(r.status,'In Progress');
});
