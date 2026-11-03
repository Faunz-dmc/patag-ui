import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/** The minimal database surface the store needs; implemented by pg and (in tests) PGlite. */
export interface Db {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Runs one or more statements without parameters. */
  exec(sql: string): Promise<void>;
  /** Runs fn inside a transaction; nested calls reuse the outer transaction. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function pgDb(pool: pg.Pool): Db {
  return {
    query: (sql, params) => pool.query(sql, params as any[]) as any,
    exec: async sql => { await pool.query(sql); },
    async tx(fn) {
      const client = await pool.connect();
      const inner: Db = {
        query: (sql, params) => client.query(sql, params as any[]) as any,
        exec: async sql => { await client.query(sql); },
        tx: f => f(inner),
        close: async () => {},
      };
      try {
        await client.query('begin');
        const result = await fn(inner);
        await client.query('commit');
        return result;
      } catch (e) {
        await client.query('rollback').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

const legacyMigration = '202610270001_admin.sql';
const legacyChecksum = 'c00208a781b81c0fd1a00874ab7d76042d9221719cc71240f03e2e0fe611a733';
const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const migrationAssets = [
  new URL('../migrations/001_init.sql', import.meta.url),
  new URL('../migrations/002_unassigned_crew.sql', import.meta.url),
];

/** Read-only lineage check; never adopt an older hosted schema as this backend's baseline. */
export async function checkMigrations(db: Db) {
  const files = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
  if (migrationAssets.map(url => path.basename(fileURLToPath(url))).sort().join(',') !== files.join(',')) {
    throw new Error('Migration asset manifest differs from migrations/. Update src/db.ts before deploying new migrations.');
  }
  const relations = (await db.query<{ schema: string; name: string; kind: string }>(`
    select n.nspname as schema, c.relname as name, c.relkind as kind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' or (n.nspname = 'patag_private' and c.relname = 'migrations')
  `)).rows;
  const fail = (reason: string): never => {
    throw new Error(`Migration compatibility check failed: ${reason}. No migration writes were attempted. See docs/migration-recovery.md; do not change migration records or checksums.`);
  };
  const hasLegacy = relations.some(r => r.schema === 'patag_private' || (r.schema === 'public' && r.name.startsWith('patag_')));
  const registry = relations.find(r => r.schema === 'public' && r.name === 'schema_migrations');
  let done = new Set<string>();
  if (registry) {
    if (registry.kind !== 'r') fail('public.schema_migrations is not a table');
    const columns = (await db.query<{ name: string; type: string }>(`
      select attname as name, atttypid::regtype::text as type from pg_attribute
      where attrelid = 'public.schema_migrations'::regclass and attnum > 0 and not attisdropped
    `)).rows;
    if (!columns.some(c => c.name === 'name' && c.type === 'text') ||
        !columns.some(c => c.name === 'applied_at' && c.type === 'timestamp with time zone')) {
      fail('public.schema_migrations has incompatible columns');
    }
    done = new Set((await db.query<{ name: string }>('select name from public.schema_migrations')).rows.map(r => r.name));
    if ([...done].some(name => !files.includes(name))) fail('unrecognized migration history');
    if (files.some((name, i) => done.has(name) && files.slice(0, i).some(previous => !done.has(previous)))) {
      fail('migration history is not a complete prefix of the local migrations');
    }
  }
  const tables = ['settings', 'teams', 'users', 'sessions', 'uploads', 'reports', 'notifications'];
  const managed = relations.filter(r => r.schema === 'public' && (tables.includes(r.name) || r.name === 'report_code_seq'));
  if (!done.has(files[0]) && managed.length) fail('existing application data has no recognized baseline');
  if (done.has(files[0]) && tables.some(name => !managed.some(r => r.name === name && r.kind === 'r'))) {
    fail('the recorded baseline is missing application tables');
  }
  if (hasLegacy) {
    if (!done.has(files[0])) fail('legacy PATAG schema has no recognized current baseline; an explicit upgrade is required');
    const legacy = relations.find(r => r.schema === 'patag_private' && r.name === 'migrations');
    if (legacy?.kind !== 'r') fail('legacy PATAG relations have no recognized migration registry');
    const history = (await db.query<{ name: string | null; checksum: string | null }>(`
      select to_jsonb(m)->>'name' as name, to_jsonb(m)->>'checksum' as checksum
      from patag_private.migrations m
    `)).rows;
    if (history.length !== 1 || history[0].name !== legacyMigration || history[0].checksum !== legacyChecksum) {
      fail('legacy migration history differs from the recovered source');
    }
    const original = await readFile(new URL('../legacy/202610270001_admin.sql', import.meta.url));
    if (createHash('sha256').update(original).digest('hex') !== legacyChecksum) fail('the recovered migration bytes were changed');
  }
  return { files, done };

}

/** Startup validates an already upgraded schema without applying migrations. */
export async function requireCurrentSchema(db: Db) {
  await db.tx(async t => {
    await t.exec('set transaction read only');
    const { files, done } = await checkMigrations(t);
    if (files.some(file => !done.has(file))) {
      throw new Error('Pending migrations. Run npm run migrate as a separate release step before starting the API.');
    }
  });
}

/** Applies migrations/*.sql in name order, each once, each in its own transaction. */
export async function migrate(db: Db, log: (m: string) => void = () => {}) {
  const { files, done } = await checkMigrations(db);
  await db.exec(`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());
    alter table public.schema_migrations enable row level security;`);
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await db.tx(async t => {
      await t.exec(sql);
      await t.query('insert into public.schema_migrations (name) values ($1)', [file]);
    });
    log(`applied ${file}`);
  }
}
