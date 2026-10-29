import { fail, fields, text, password, email, uuid } from './config.mjs';
import { transaction, audit, publicUser } from './db.mjs';
import { requireAdmin } from './queries.mjs';
export function roleValue(value) {
  const roles={admin:'administrator',administrator:'administrator',maintenance:'maintenance',citizen:'citizen'};
  const role=typeof value==='string' && Object.hasOwn(roles,value)?roles[value]:undefined;
  if(!role) fail(400,'Invalid account role.');return role;
}
async function profileFields(db,input) {
  const role=roleValue(input.role);
  if(typeof input.active!=='boolean') fail(400,'Invalid active state.');
  if(db.actor.municipality && role==='administrator') fail(403,'Only a province-wide administrator may manage administrator accounts.');
  let teamId=null,municipality=db.actor.municipality;
  if(role==='maintenance') {
    teamId=uuid(input.teamId);
    const team=(await db.query('SELECT * FROM public.patag_teams WHERE id=$1 AND active FOR SHARE',[teamId])).rows[0];
    if(!team) fail(400,'Choose an active authorized maintenance team.');
    municipality=team.municipality;
  } else if(input.municipality) municipality=text(input.municipality,'municipality',100);
  return {role,teamId,municipality,active:input.active};
}
export async function provisionUser(pool,claims,input,auth) {
  fields(input,['name','email','password','role','teamId','active','municipality']);
  const name=text(input.name,'name',100),mail=email(input.email),secret=password(input.password);
  let created;
  try {
    return await transaction(pool,async db=>{
      requireAdmin(db);const value=await profileFields(db,input);
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[mail]);
      if((await db.query('SELECT id FROM public.patag_profiles WHERE lower(email)=$1',[mail])).rows.length) fail(409,'An account with these details already exists.');
      const response=await auth.createUser({email:mail,password:secret,email_confirm:true});created=response.id||response.user?.id;uuid(created);
      const {rows}=await db.query('INSERT INTO public.patag_profiles(id,name,email,role,active,municipality,team_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[created,name,mail,value.role,value.active,value.municipality,value.teamId]);
      await audit(db,'user.create',created,value.municipality,{role:value.role,active:value.active});
      return publicUser(rows[0]);
    },claims);
  } catch(error) {
    if(created) {try {await auth.deleteUser(created);} catch {throw Object.assign(Error('Account provisioning requires administrator reconciliation; Supabase Auth cleanup failed.'),{status:503});}}
    throw error;
  }
}
export async function updateUser(db,input) {
  requireAdmin(db);fields(input,['id','role','active','teamId','municipality']);
  const id=uuid(input.id);
  if(id===db.actor.id) fail(409,'You cannot change your own access.');
  const current=(await db.query('SELECT * FROM public.patag_profiles WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!current) fail(404,'Account not found.');
  if(db.actor.municipality && current.role==='administrator') fail(403,'Only a province-wide administrator may manage administrator accounts.');
  const value=await profileFields(db,{...input,municipality:input.municipality??current.municipality});
  const {rows}=await db.query('UPDATE public.patag_profiles SET role=$1,active=$2,team_id=$3,municipality=$4,updated_at=now() WHERE id=$5 RETURNING *',[value.role,value.active,value.teamId,value.municipality,id]);
  await audit(db,'user.update',id,current.municipality,{role:value.role,active:value.active});return publicUser(rows[0]);
}
export async function updateMe(db,input) {
  fields(input,['name','email']);
  if(email(input.email)!==db.actor.email.toLowerCase()) fail(400,'Email changes require verified account recovery.');
  const {rows}=await db.query('UPDATE public.patag_profiles SET name=$1,updated_at=now() WHERE id=$2 RETURNING *',[text(input.name,'name',100),db.actor.id]);
  if(!rows[0]) fail(403,'Profile update is not authorized.');
  await audit(db,'profile.update',db.actor.id,db.actor.municipality);return publicUser(rows[0]);
}
