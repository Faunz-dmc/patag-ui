import { Pool } from 'pg';
import { fail } from './config.mjs';
export function poolFor(config) {
  return new Pool({connectionString:config.dbUrl,ssl:{rejectUnauthorized:true},max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,statement_timeout:15000});
}
export async function transaction(pool, operation, claims) {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    if (claims) {
      await client.query('SELECT id FROM public.patag_profiles WHERE id=$1 FOR SHARE',[claims.sub]);
      await client.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);
      await client.query('SET LOCAL ROLE patag_api');
      const {rows}=await client.query('SELECT * FROM public.patag_profiles WHERE id=$1 AND active',[claims.sub]);
      if (!rows[0]) fail(403,'Account inactive or not authorized.');
      const actor=await client.query('SELECT (patag_private.actor()).id AS id');
      if (!actor.rows[0]?.id) fail(403,'MFA verification is required.');
      client.actor=rows[0];
    }
    const result=await operation(client);
    await client.query('COMMIT');
    return result;
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export function publicUser(row) {
  return {id:row.id,name:row.name,email:row.email,role:row.role==='administrator'?'admin':row.role,active:row.active,teamId:row.team_id ?? undefined};
}
export async function audit(db,action,id,municipality,details={}) {
  await db.query('INSERT INTO public.patag_audit_events(actor_id,action,resource_id,municipality,details) VALUES($1,$2,$3,$4,$5)',[db.actor.id,action,id,municipality,JSON.stringify(details)]);
}
