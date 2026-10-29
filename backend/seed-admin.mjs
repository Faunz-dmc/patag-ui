import { fileURLToPath } from 'node:url';
import { configuration, password as validatePassword } from './config.mjs';
import { poolFor, transaction } from './db.mjs';
import { createAuth } from './auth.mjs';
export const adminEmail='admin@patag.test';
export async function seedAdmin(pool,auth,{password,reset=false}={}) {
  validatePassword(password);
  let createdId;
  try { return await transaction(pool,async db=>{
    await db.query('SELECT pg_advisory_xact_lock(728194621)');
    let user;
    for(let page=1;page<=100;page++) {
      const response=await auth.listUsers(page),users=response.users||[];
      user=users.find(u=>u.email?.toLowerCase()===adminEmail);
      if(user||users.length<100) break;
      if(page===100) throw Error('Admin lookup exceeds 10,000 Auth accounts; resolve the test identity manually.');
    }
    if(user) {
      const profile=(await db.query('SELECT * FROM public.patag_profiles WHERE id=$1',[user.id])).rows[0];
      if(!reset) {
        if(!profile||profile.role!=='administrator'||!profile.active||profile.municipality!==null||profile.province!=='Bulacan'||profile.email!==adminEmail) throw Error('Existing account is not the configured test administrator. Review it and use --reset explicitly.');
        return {email:adminEmail,created:false};
      }
      await auth.updateUser(user.id,{password,email_confirm:true});
    } else {
      const response=await auth.createUser({email:adminEmail,password,email_confirm:true});user=response.user||response;createdId=user.id;
    }
    await db.query(`INSERT INTO public.patag_profiles(id,name,email,role,active,province,municipality,team_id)
      VALUES($1,'PATAG Test Administrator',$2,'administrator',true,'Bulacan',NULL,NULL)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,role=EXCLUDED.role,active=true,province='Bulacan',municipality=NULL,team_id=NULL,updated_at=now()`,[user.id,adminEmail]);
    await db.query("INSERT INTO public.patag_audit_events(actor_id,action,resource_id,details) VALUES($1,$2,$4,$3)",[user.id,reset?'admin.bootstrap.reset':'admin.bootstrap.create',JSON.stringify({email:adminEmail}),user.id]);
    return {email:adminEmail,created:!!createdId};
  }); } catch(error) {
    if(createdId) {try {await auth.deleteUser(createdId);} catch {throw Error('Bootstrap requires administrator reconciliation: Supabase Auth cleanup failed.');}}
    throw error;
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  let pool;
  try {
    if(!process.env.PATAG_TEST_ADMIN_PASSWORD) throw Error('PATAG_TEST_ADMIN_PASSWORD is missing. Configure it privately.');
    validatePassword(process.env.PATAG_TEST_ADMIN_PASSWORD);
    if(process.env.NODE_ENV==='production') throw Error('The test administrator bootstrap is disabled in production.');
    if(process.env.PATAG_ALLOW_HOSTED_MUTATIONS!=='true') throw Error('Hosted bootstrap not authorized: set PATAG_ALLOW_HOSTED_MUTATIONS=true only after approving the target project.');
    const config=configuration();pool=poolFor(config);
    const result=await seedAdmin(pool,createAuth(config),{password:process.env.PATAG_TEST_ADMIN_PASSWORD,reset:process.argv.includes('--reset')});
    console.log(`${result.created?'Created':'Confirmed'} ${adminEmail}. Password omitted.`);
  } catch(error) {console.error(error.code?'Supabase bootstrap failed; inspect credentials, TLS and migration status.':error.message);process.exitCode=1;}
  finally {if(pool) await pool.end();}
}
