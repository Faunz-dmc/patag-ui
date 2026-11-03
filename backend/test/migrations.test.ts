import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { checkMigrations, migrate, type Db } from '../src/db.ts';

async function fixture() {
  const pg = await PGlite.create();
  const wrap = (q: PGlite | Transaction): Db => ({
    query: (sql, params) => q.query(sql, params) as any,
    exec: async sql => { await q.exec(sql); },
    tx: fn => q === pg ? pg.transaction(t => fn(wrap(t))) : fn(wrap(q)),
    close: () => pg.close(),
  });
  return wrap(pg);
}

async function snapshot(db: Db) {
  return (await db.query(`select n.nspname, c.relname, c.relkind, c.relrowsecurity,
    a.attname, a.atttypid, a.attnotnull
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    left join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where n.nspname in ('public', 'patag_private')
    order by n.nspname, c.relname, a.attnum`)).rows;
}

test('fresh migration is idempotent and removes only the crew constraint on upgrade', async () => {
  const db = await fixture();
  try {
    const sql = await readFile(new URL('../migrations/001_init.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(`create table schema_migrations (name text primary key, applied_at timestamptz not null default now());
      insert into schema_migrations (name) values ('001_init.sql');
      insert into teams (id, name) values ('crew', 'Synthetic crew');
      insert into users (id, name, email, role, team_id, password_hash)
        values ('worker', 'Synthetic worker', 'worker@example.test', 'maintenance', 'crew', 'unchanged');`);
    await migrate(db);
    await migrate(db);
    assert.equal((await db.query('select * from schema_migrations')).rows.length, 2);
    await db.exec("update users set team_id = null where id = 'worker'");
    assert.equal((await db.query("select password_hash from users where id = 'worker'")).rows[0].password_hash, 'unchanged');
    await assert.rejects(db.exec("update users set team_id = 'absent' where id = 'worker'"), /foreign key/);
  } finally { await db.close(); }
});

test('empty database initializes both migrations', async () => {
  const db = await fixture();
  try {
    await migrate(db);
    await migrate(db);
    assert.deepEqual((await db.query('select name from schema_migrations order by name')).rows,
      [{ name: '001_init.sql' }, { name: '002_unassigned_crew.sql' }]);
  } finally { await db.close(); }
});

for (const [label, setup] of [
  ['legacy checksum registry', `create schema patag_private;
    create table patag_private.migrations (name text primary key, checksum text not null);
    insert into patag_private.migrations values ('202610270001_admin.sql', 'original-checksum');`],
  ['coexisting registries', `create schema patag_private;
    create table patag_private.migrations (name text primary key, checksum text not null);
    insert into patag_private.migrations values ('202610270001_admin.sql', 'original-checksum');
    create table schema_migrations (name text primary key, applied_at timestamptz);
    insert into schema_migrations (name) values ('001_init.sql');`],
  ['legacy public tables', 'create table patag_profiles (id text primary key);'],
  ['unmanaged users', "create table users (id text); insert into users values ('preserved');"],
  ['unknown migration', `create table schema_migrations (name text primary key, applied_at timestamptz);
    insert into schema_migrations values ('202610270001_admin.sql');`],
  ['incompatible registry columns', 'create table schema_migrations (version text primary key);'],
  ['incomplete migration history', `create table schema_migrations (name text primary key, applied_at timestamptz);
    insert into schema_migrations (name) values ('002_unassigned_crew.sql');`],
  ['missing baseline tables', `create table schema_migrations (name text primary key, applied_at timestamptz);
    insert into schema_migrations (name) values ('001_init.sql');`],
  ['empty registry with existing data', `create table schema_migrations (name text primary key, applied_at timestamptz);
    create table teams (id text); insert into teams values ('preserved');`],
] as const) {
  test(`rejects ${label} before any schema or data mutation`, async () => {
    const db = await fixture();
    try {
      await db.exec(setup);
      const before = await snapshot(db);
      await assert.rejects(migrate(db), label === 'unknown migration' ? /unrecognized migration history/ : /Migration compatibility check failed/);
      assert.deepEqual(await snapshot(db), before);
      if (label === 'legacy checksum registry' || label === 'coexisting registries') {
        assert.deepEqual((await db.query('select * from patag_private.migrations')).rows,
          [{ name: '202610270001_admin.sql', checksum: 'original-checksum' }]);
      }
      if (label === 'unmanaged users') assert.deepEqual((await db.query('select * from users')).rows, [{ id: 'preserved' }]);
      if (label === 'empty registry with existing data') assert.deepEqual((await db.query('select * from teams')).rows, [{ id: 'preserved' }]);
    } finally { await db.close(); }
  });
}

test('compatibility diagnosis succeeds inside read-only transactions without changing schema', async () => {
  const db = await fixture();
  try {
    for (const initialized of [false, true]) {
      if (initialized) await migrate(db);
      const before = await snapshot(db);
      await db.tx(async t => {
        await t.exec('set transaction read only');
        const { files, done } = await checkMigrations(t);
        assert.equal(files.length, 2);
        assert.equal(done.size, initialized ? 2 : 0);
      });
      assert.deepEqual(await snapshot(db), before);
    }
  } finally { await db.close(); }
});

const originalChecksum = 'c00208a781b81c0fd1a00874ab7d76042d9221719cc71240f03e2e0fe611a733';

test('recovered original SQL retains the exact hosted checksum and is packaged without newline conversion', async () => {
  const original = await readFile(new URL('../legacy/202610270001_admin.sql', import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), originalChecksum);
  const attributes = await readFile(new URL('../../.gitattributes', import.meta.url), 'utf8');
  assert.match(attributes, /^backend\/legacy\/202610270001_admin\.sql -text$/m);
  const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(dockerfile, /^COPY legacy \.\/legacy$/m);
});

for (const state of ['verified', 'changed checksum', 'extra migration', 'missing registry', 'legacy only'] as const) {
  test(`${state} legacy lineage with preserved current data`, async () => {
    const db = await fixture();
    try {
      if (state !== 'legacy only') {
        await migrate(db);
        await db.exec(`insert into teams (id, name) values ('retained-team', 'Retained crew');
          insert into users (id, name, email, role, team_id, password_hash)
            values ('retained-user', 'Retained user', 'retained@example.test', 'maintenance', 'retained-team', 'unchanged-hash');
          insert into reports (id, title, description, severity, status, location, reporter_id, jurisdiction, created_at, updated_at)
            values ('retained-report', 'Retained report', 'Description', 'Low', 'Submitted', '{}', 'retained-user', 'Bulacan', now(), now());`);
      }
      await db.exec(`create schema patag_private;
        create table public.patag_profiles (id text primary key);
        insert into public.patag_profiles values ('retained-legacy-profile');`);
      if (state !== 'missing registry') {
        await db.exec('create table patag_private.migrations (name text primary key, checksum text not null)');
        await db.query('insert into patag_private.migrations values ($1, $2)',
          ['202610270001_admin.sql', state === 'changed checksum' ? 'changed' : originalChecksum]);
        if (state === 'extra migration') await db.exec("insert into patag_private.migrations values ('unknown.sql', 'unknown')");
      }
      const before = await snapshot(db);
      const history = state === 'missing registry' ? [] : (await db.query('select * from patag_private.migrations order by name')).rows;
      const current = state === 'legacy only' ? [] : (await db.query('select * from public.schema_migrations order by name')).rows;
      if (state === 'verified') {
        await db.tx(async t => {
          await t.exec('set transaction read only');
          assert.equal((await checkMigrations(t)).done.size, 2);
        });
        await migrate(db);
      } else {
        await assert.rejects(migrate(db), /Migration compatibility check failed/);
      }
      assert.deepEqual(await snapshot(db), before);
      if (state !== 'missing registry') assert.deepEqual((await db.query('select * from patag_private.migrations order by name')).rows, history);
      assert.deepEqual((await db.query('select * from patag_profiles')).rows, [{ id: 'retained-legacy-profile' }]);
      if (state !== 'legacy only') {
        assert.deepEqual((await db.query('select * from public.schema_migrations order by name')).rows, current);
        assert.equal((await db.query("select password_hash from users where id = 'retained-user'")).rows[0].password_hash, 'unchanged-hash');
        assert.equal((await db.query("select team_id from users where id = 'retained-user'")).rows[0].team_id, 'retained-team');
        assert.equal((await db.query("select reporter_id from reports where id = 'retained-report'")).rows[0].reporter_id, 'retained-user');
      }
    } finally { await db.close(); }
  });
}

test('startup requires a current schema without changing tables or migration ledgers', async () => {
  const { requireCurrentSchema } = await import('../src/db.ts');
  const db = await fixture();
  try {
    const empty = await snapshot(db);
    await assert.rejects(requireCurrentSchema(db), /Pending migrations/);
    assert.deepEqual(await snapshot(db), empty);
    await migrate(db);
    const schema = await snapshot(db);
    const ledger = await db.query('select * from schema_migrations order by name');
    await requireCurrentSchema(db);
    assert.deepEqual(await snapshot(db), schema);
    assert.deepEqual(await db.query('select * from schema_migrations order by name'), ledger);
    await db.query('delete from schema_migrations where name = $1', ['002_unassigned_crew.sql']);
    await assert.rejects(requireCurrentSchema(db), /Pending migrations/);
    assert.equal((await db.query('select * from schema_migrations')).rows.length, 1);
  } finally { await db.close(); }
});
