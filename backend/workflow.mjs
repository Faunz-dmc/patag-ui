import { fields, text, uuid, fail } from './config.mjs';
const actionFields = {
  review:[], verify:[], reject:[], duplicate:['duplicateOf'], flag:[], forward:['jurisdiction'],
  assign:['teamId','priority','targetDate'], start:[], progress:['phase','photos'], complete:['photos'],
  'before-photos':['photos'], return:[], resolve:[], publication:['approved'],
};
export function eventInput(input) {
  if (!input || typeof input.action!=='string' || !Object.hasOwn(actionFields,input.action)) fail(400,'Unknown workflow action.');
  fields(input,['action','note',...actionFields[input.action]]);
  const value={...input,note:text(input.note ?? '', 'note',2000,false)};
  if (['reject','flag','return','complete','progress'].includes(value.action) && !value.note) fail(400,'A note is required.');
  if (value.action==='assign') {
    value.teamId=uuid(value.teamId);
    value.priority=value.priority || 'Medium';
    if (!['Low','Medium','High'].includes(value.priority)) fail(400,'Invalid priority.');
    if(value.targetDate!=null && typeof value.targetDate!=='string') fail(400,'Invalid target date.');
    if (value.targetDate && (!/^\d{4}-\d{2}-\d{2}$/.test(value.targetDate) || !Number.isFinite(Date.parse(value.targetDate)) || new Date(value.targetDate).toISOString().slice(0,10)!==value.targetDate)) fail(400,'Invalid target date.');
  }
  if (value.action==='duplicate') value.duplicateOf=uuid(value.duplicateOf);
  if (value.action==='forward') value.jurisdiction=text(value.jurisdiction,'jurisdiction',200);
  if (value.action==='progress') value.phase=text(value.phase,'phase',100);
  if (value.action==='publication' && typeof value.approved!=='boolean') fail(400,'Choose a publication state.');
  if (['complete','before-photos','progress'].includes(value.action)) {
    value.photos=value.photos ?? [];
    if (!Array.isArray(value.photos) || value.photos.length>10 || value.photos.some(p=>!p || !uuid(p.id))) fail(400,'Invalid evidence.');
    if (value.action!=='progress' && !value.photos.length) fail(400,'Evidence is required.');
    if (new Set(value.photos.map(p=>p.id)).size!==value.photos.length) fail(400,'Repeated evidence.');
  }
  return value;
}
export function authorizeAction(actor, action) {
  const adminActions=['review','verify','reject','duplicate','flag','forward','assign','return','resolve','publication'];
  if ((adminActions.includes(action) && actor.role!=='administrator') || (!adminActions.includes(action) && actor.role!=='maintenance')) fail(403,'Not authorized for this action.');
}
export function applyEvent(report, actor, value) {
  const {action,note}=value, current=report.status;
  authorizeAction(actor,action);
  if(actor.role==='maintenance' && report.teamId!==actor.team_id) fail(403,'This report is assigned to another maintenance team.');
  if (actor.role==='maintenance' && report.completion?.state==='Awaiting Verification') fail(409,'Repair is awaiting administrative review.');
  if (action==='review' && current==='Submitted') report.status='Under Review';
  else if (['verify','reject','duplicate'].includes(action) && ['Submitted','Under Review'].includes(current)) {
    report.status={verify:'Verified',reject:'Rejected',duplicate:'Duplicate'}[action];
    if (action==='duplicate') report.duplicateOf=value.duplicateOf;
  } else if (action==='assign' && current==='Verified') { report.status='Assigned'; report.teamId=value.teamId; report.assignment={teamId:value.teamId,priority:value.priority,targetDate:value.targetDate || null,note}; }
  else if (action==='start' && current==='Assigned') report.status='In Progress';
  else if (action==='progress' && current==='In Progress') { /* The service appends the progress row. */ }
  else if (action==='before-photos' && ['Assigned','In Progress'].includes(current)) report.publicPhotosApproved=false;
  else if (action==='complete' && current==='In Progress') { report.completion={state:'Awaiting Verification',note,photos:value.photos}; report.publicPhotosApproved=false; }
  else if (action==='resolve' && current==='In Progress' && report.completion?.state==='Awaiting Verification') { report.status='Resolved'; report.completion.state='Verified'; }
  else if (action==='return' && current==='In Progress' && report.completion?.state==='Awaiting Verification') report.completion.state='Additional Work Requested';
  else if (action==='flag') report.flagged=true;
  else if (action==='forward') report.jurisdiction=value.jurisdiction;
  else if (action==='publication') report.publicPhotosApproved=value.approved;
  else fail(409,'Invalid workflow transition.');
  return report;
}
