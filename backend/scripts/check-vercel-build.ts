// Run after vercel build; inspect packaging without starting the API or opening a database.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(process.argv[2] || path.join(backend, '.vercel/output'));
const bundle = path.join(output, 'functions/index.func');
const config = JSON.parse(await readFile(path.join(output, 'config.json'), 'utf8'));
const runtime = JSON.parse(await readFile(path.join(bundle, '.vc-config.json'), 'utf8'));
assert.equal(config.framework.slug, 'fastify');
assert.equal(runtime.runtime, 'nodejs24.x');
assert.ok(config.routes.some((route: any) => route.src === '/(.*)' && route.dest === '/'));
assert.ok(config.crons.some((cron: any) => cron.path === '/api/internal/purge-sessions'));
for (const file of await readdir(path.join(backend, 'migrations'))) {
  if (!file.endsWith('.sql')) continue;
  const original = await readFile(path.join(backend, 'migrations', file));
  assert.deepEqual(await readFile(path.join(bundle, 'migrations', file)), original);
}
const archive = await readFile(path.join(bundle, 'legacy/202610270001_admin.sql'));
assert.equal(createHash('sha256').update(archive).digest('hex'),
  'c00208a781b81c0fd1a00874ab7d76042d9221719cc71240f03e2e0fe611a733');
console.log('Verified Fastify root function, Node 24 runtime, API routing, cron and exact migration assets.');
