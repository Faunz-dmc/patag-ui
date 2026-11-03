import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/http-app.ts';
import { MemoryBlobStore } from '../src/blobs.ts';
import type { Store } from '../src/store.ts';

test('maximum photo fits the host payload limit and larger photos are rejected before storage', async () => {
  const blobs = new MemoryBlobStore();
  const store = {
    sessionUser: async () => ({ id: 'synthetic', role: 'citizen' }),
    recordUpload: async () => {},
  } as unknown as Store;
  const app = buildApp({ store, blobs });
  try {
    const max = 3 * 1024 * 1024;
    for (const size of [max, max + 1]) {
      const bytes = Buffer.alloc(size);
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
      const payload = JSON.stringify({ data: 'data:image/png;base64,' + bytes.toString('base64'), name: 'boundary.png' });
      assert.ok(Buffer.byteLength(payload) < 4_500_000);
      const res = await app.inject({ method: 'POST', url: '/api/uploads', headers: {
        authorization: 'Bearer account:synthetic', 'content-type': 'application/json',
      }, payload });
      assert.equal(res.statusCode, size === max ? 201 : 400);
    }
    assert.equal(blobs.files.size, 1);
    const oversized = await app.inject({ method: 'POST', url: '/api/uploads', headers: {
      'content-type': 'application/json',
    }, payload: JSON.stringify({ data: 'A'.repeat(4_300_000) }) });
    assert.equal(oversized.statusCode, 413);
  } finally { await app.close(); }
});

test('cleanup fails closed, accepts only cron authorization and surfaces storage failures', async () => {
  let calls = 0;
  let broken = false;
  const store = { purgeExpiredSessions: async () => {
    calls++;
    if (broken) throw new Error('synthetic database failure');
  } } as unknown as Store;
  for (const cronSecret of ['', 'synthetic-cron-secret-at-least-32-characters']) {
    const app = buildApp({ store, blobs: new MemoryBlobStore(), cronSecret });
    try {
      for (const authorization of ['', 'Bearer wrong', 'Bearer account:admin', cronSecret]) {
        const res = await app.inject({ url: '/api/internal/purge-sessions', headers: { authorization } });
        assert.equal(res.statusCode, 401);
        assert.equal(res.headers['cache-control'], 'no-store');
      }
      assert.equal(calls, 0);
      const headers = { authorization: `Bearer ${cronSecret}` };
      const res = await app.inject({ url: '/api/internal/purge-sessions', headers });
      assert.equal(res.statusCode, cronSecret ? 200 : 401);
      if (cronSecret) {
        assert.equal(calls, 1);
        broken = true;
        const failure = await app.inject({ url: '/api/internal/purge-sessions', headers });
        assert.equal(failure.statusCode, 500);
        assert.ok(!failure.body.includes('synthetic database failure'));
      }
    } finally { await app.close(); }
  }
});

test('pool is bounded and Vercel refuses unverified database TLS', async () => {
  const { createPool } = await import('../src/config.ts');
  const keys = ['VERCEL', 'DATABASE_URL', 'DB_SSL_DISABLE', 'SUPABASE_DB_CA_CERT'];
  const saved = keys.map(key => process.env[key]);
  try {
    process.env.VERCEL = '1';
    process.env.DATABASE_URL = 'postgresql://synthetic:synthetic@localhost/synthetic';
    delete process.env.SUPABASE_DB_CA_CERT;
    delete process.env.DB_SSL_DISABLE;
    assert.throws(createPool, /requires SUPABASE_DB_CA_CERT/);
    process.env.SUPABASE_DB_CA_CERT = '-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----';
    process.env.DB_SSL_DISABLE = '1';
    assert.throws(createPool, /verified database TLS/);
    delete process.env.DB_SSL_DISABLE;
    for (const query of ['sslmode=disable', 'sslmode=no-verify', 'ssl=0', 'sslmode=require&uselibpqcompat=true', 'sslrootcert=/nonexistent']) {
      process.env.DATABASE_URL = `postgresql://synthetic:synthetic@localhost/synthetic?${query}`;
      const secured = createPool();
      try {
        const pg = (await import('pg')).default;
        const client = new pg.Client(secured.options);
        assert.equal((client as any).connectionParameters.ssl.rejectUnauthorized, true);
        assert.equal((client as any).connectionParameters.ssl.ca, process.env.SUPABASE_DB_CA_CERT);
      } finally { await secured.end(); }
    }
    const pool = createPool();
    try {
      assert.equal(pool.options.max, 2);
      assert.equal(pool.options.idleTimeoutMillis, 5000);
      assert.equal(pool.options.connectionTimeoutMillis, 10000);
      assert.equal((pool.options.ssl as { rejectUnauthorized: boolean }).rejectUnauthorized, true);
      assert.equal(pool.totalCount, 0);
    } finally { await pool.end(); }
    delete process.env.DATABASE_URL;
    const dbKeys = ['SUPABASE_DB_HOST', 'SUPABASE_DB_USER', 'SUPABASE_DB_PASSWORD'];
    const dbSaved = dbKeys.map(key => process.env[key]);
    try {
      dbKeys.forEach(key => { process.env[key] = 'synthetic'; });
      const split = createPool();
      try {
        assert.equal(split.options.max, 2);
        assert.equal((split.options.ssl as { rejectUnauthorized: boolean }).rejectUnauthorized, true);
        assert.equal(split.totalCount, 0);
      } finally { await split.end(); }
    } finally {
      dbKeys.forEach((key, i) => { if (dbSaved[i] === undefined) delete process.env[key]; else process.env[key] = dbSaved[i]; });
    }
  } finally {
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
  }
});
