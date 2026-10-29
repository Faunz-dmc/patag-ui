import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, password, fields, HttpError } from '../config.mjs';

test('missing Supabase configuration fails with a setup error', () => {
  assert.throws(() => configuration({}), /SUPABASE_URL/);
});
test('private keys and TLS are required, with explicit trusted browser origins', () => {
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key', SUPABASE_PUBLISHABLE_KEY: 'public-key', SUPABASE_DB_URL: 'postgresql://postgres:secret@db.example.supabase.co/postgres', ADMIN_ORIGIN: 'http://127.0.0.1:5173' };
  assert.equal(configuration(env).origin, env.ADMIN_ORIGIN);
  assert.throws(() => configuration({ ...env, SUPABASE_URL: 'http://example.supabase.co' }), /HTTPS/);
  assert.throws(() => configuration({ ...env, NODE_ENV: 'production' }), /HTTPS/);
  assert.throws(() => configuration({ ...env, SUPABASE_SERVICE_ROLE_KEY: '' }), /SERVICE_ROLE/);
});
test('password and request shape validation reject weak inputs and mass assignment', () => {
  for (const value of [undefined, '', 'short', 'a'.repeat(14), 'a'.repeat(129)]) assert.throws(() => password(value));
  assert.equal(password('correct horse battery staple'), 'correct horse battery staple');
  assert.throws(() => fields({ name: 'Test', role: 'administrator' }, ['name']), HttpError);
  assert.throws(() => fields(null, ['name']), HttpError);
});

