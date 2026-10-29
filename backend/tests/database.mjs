import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const ids = { admin: '00000000-0000-4000-8000-000000000001', local: '00000000-0000-4000-8000-000000000002', citizen: '00000000-0000-4000-8000-000000000003', crew: '00000000-0000-4000-8000-000000000004', other: '00000000-0000-4000-8000-000000000005', inactive: '00000000-0000-4000-8000-000000000006', team: '00000000-0000-4000-8000-000000000010', report: '00000000-0000-4000-8000-000000000020', outside: '00000000-0000-4000-8000-000000000021' };
export async function database() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users);
    CREATE TABLE auth.mfa_factors(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users, status text);
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
  const sql = await readFile(new URL('../../supabase/migrations/202610270001_admin.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  const query=(sql,params)=>params?db.query(sql,params):db.exec(sql).then(results=>results.at(-1));
  return { db, sql, query, connect: async () => ({ query, release() {} }), end: () => db.close() };
}
export async function fixtures(db) {
  for (const [key, id] of Object.entries(ids).filter(([key]) => ['admin','local','citizen','crew','other','inactive'].includes(key))) {
    await db.query('INSERT INTO auth.users VALUES($1,$2)', [id, `${key}@example.test`]);
    await db.query('INSERT INTO auth.sessions VALUES($1,$1)',[id]);
  }
  await db.query('INSERT INTO public.patag_teams(id,name,municipality) VALUES($1,$2,$3)', [ids.team,'Test Crew','Malolos']);
  for (const [key, role, municipality, active] of [['admin','administrator',null,true],['local','administrator','Malolos',true],['citizen','citizen','Malolos',true],['crew','maintenance','Malolos',true],['other','citizen','Baliwag',true],['inactive','administrator',null,false]]) {
    await db.query('INSERT INTO public.patag_profiles(id,name,email,role,municipality,active,team_id) VALUES($1,$2,$3,$4,$5,$6,$7)', [ids[key],key,`${key}@example.test`,role,municipality,active,key==='crew'?ids.team:null]);
  }
  for (const [id, city, owner] of [[ids.report,'Malolos',ids.citizen],[ids.outside,'Baliwag',ids.other]]) {
    await db.query('INSERT INTO public.patag_reports(id,title,description,road,barangay,municipality,latitude,longitude,reporter_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id,'Test damage','Test description','Test Road','Test Barangay',city,14.855,120.815,owner]);
  }
}
export async function asUser(db, user, operation, role = 'authenticated', aal = 'aal1') {
  await db.exec('BEGIN');
  try {
    await db.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user, aal, role:'authenticated',session_id:user })]);
    await db.exec(`SET LOCAL ROLE ${role}`);
    const result = await operation();
    await db.exec('COMMIT');
    return result;
  } catch (e) { await db.exec('ROLLBACK'); throw e; }
}
