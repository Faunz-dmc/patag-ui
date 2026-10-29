import test from 'node:test';
import assert from 'node:assert/strict';
import { database, fixtures, ids, asUser } from './database.mjs';

test('migrations repeat safely; RLS scopes administrators, owners, inactive users and anonymous access', async () => {
  const { db, sql } = await database();
  try {
    await db.exec(sql); await fixtures(db);
    const read = () => db.query('SELECT id FROM public.patag_reports ORDER BY id');
    assert.equal((await asUser(db,ids.admin,read)).rows.length,2);
    assert.deepEqual((await asUser(db,ids.local,read)).rows.map(r=>r.id),[ids.report]);
    assert.deepEqual((await asUser(db,ids.citizen,read)).rows.map(r=>r.id),[ids.report]);
    assert.equal((await asUser(db,ids.inactive,read)).rows.length,0);
    await assert.rejects(asUser(db,ids.admin,() => db.query('UPDATE public.patag_profiles SET role=\'administrator\' WHERE id=$1',[ids.citizen])), /permission denied/);
    await db.exec('SET ROLE anon'); await assert.rejects(read(), /permission denied/); await db.exec('RESET ROLE');
    await assert.rejects(db.query('UPDATE public.patag_reports SET status=$1 WHERE id=$2',['Completed',ids.report]), /check constraint/);
    await assert.rejects(db.query('DELETE FROM auth.users WHERE id=$1',[ids.citizen]), /foreign key/);
    await db.query('INSERT INTO auth.mfa_factors VALUES($1,$2,$3)',[ids.team,ids.admin,'verified']);
    assert.equal((await asUser(db,ids.admin,read)).rows.length,0);
    assert.equal((await asUser(db,ids.admin,read,'authenticated','aal2')).rows.length,2);
  } finally { await db.close(); }
});
