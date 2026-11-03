import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesGlob } from 'node:path';
import { readFile } from 'node:fs/promises';

test('Fastify bundle settings match its synthetic runtime entrypoint', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  // Vercel's Fastify preset uses index.js as its build entrypoint before resolving src/index.ts.
  const matches = Object.entries(config.functions).filter(([pattern]) => matchesGlob('index.js', pattern));
  assert.equal(matches.length, 1);
  assert.equal((matches[0][1] as { includeFiles: string }).includeFiles, '{migrations,legacy}/**');
});
