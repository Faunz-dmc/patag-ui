import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('configured Fastify entrypoint satisfies Vercel framework detection', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.framework, 'fastify');
  const entrypoint = 'src/index.ts';
  assert.ok(config.functions[entrypoint]);
  const source = await readFile(new URL('../' + entrypoint, import.meta.url), 'utf8');
  // Match Vercel's Fastify detector; imports through the app builder do not count.
  const detector = /(?:from|require|import)\s*(?:\(\s*)?["']fastify["']\s*(?:\))?/;
  assert.match(source, detector);
});
