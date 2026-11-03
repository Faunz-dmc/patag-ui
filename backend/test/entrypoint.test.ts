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


test('Vercel can finish importing the entrypoint before emitting the listening event', async () => {
  const { execFileSync } = await import('node:child_process');
  const entry = new URL('../src/index.ts', import.meta.url).href;
  const code = `
    import { registerHooks } from 'node:module';
    import http from 'node:http';
    const stubs = {
      'config.ts': 'export const config = {port:0,host:"127.0.0.1"}; export const createPool=()=>({}); export const lanUrls=()=>[]; export const requireEnv=()=>{};',
      'db.ts': 'export const pgDb=()=>({close:async()=>{}}); export const requireCurrentSchema=async()=>{};',
      'store.ts': 'export class Store {}',
      'blobs.ts': 'export class SupabaseBlobStore {}',
      'geocode.ts': 'export const createGeocoder=()=>{};',
      'http-app.ts': 'import Fastify from "fastify"; export const buildApp=()=>Fastify();'
    };
    registerHooks({load(url, context, next) {
      const name=url.split('/').at(-1);
      if(url.includes('/backend/src/') && stubs[name]) return {format:'module',source:stubs[name],shortCircuit:true};
      return next(url, context);
    }});
    http.Server.prototype.listen=function(){return this;};
    await import(${JSON.stringify(entry)});
    console.log('entrypoint imported');
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: new URL('../', import.meta.url), timeout: 8000, encoding: 'utf8',
    env: { ...process.env, VERCEL: '1' },
  });
  assert.match(output, /entrypoint imported/);
});
