import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('configured Fastify entrypoint satisfies Vercel framework detection', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.framework, 'fastify');
  const entrypoint = 'src/index.ts';
  assert.equal(config.functions, undefined);
  assert.equal(config.builds, undefined);
  const source = await readFile(new URL('../' + entrypoint, import.meta.url), 'utf8');
  // Match Vercel's Fastify detector; imports through the app builder do not count.
  const detector = /(?:from|require|import)\s*(?:\(\s*)?["']fastify["']\s*(?:\))?/;
  assert.match(source, detector);
});

test('backend runtime stays on the verified Node 24 major', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(pkg.engines.node, '24.x');
  assert.equal(lock.packages[''].engines.node, pkg.engines.node);
});
