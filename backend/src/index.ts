// Vercel detects Fastify only when the entrypoint imports the framework directly.
import 'fastify';
import { buildApp } from './http-app.ts';
import { SupabaseBlobStore } from './blobs.ts';
import { config, createPool, lanUrls, requireEnv } from './config.ts';
import { requireCurrentSchema, pgDb } from './db.ts';
import { createGeocoder } from './geocode.ts';
import { Store } from './store.ts';

requireEnv('SUPABASE_URL', 'SUPABASE_SECRET_KEY');
if (process.env.VERCEL) requireEnv('CRON_SECRET');
const db = pgDb(createPool());
await requireCurrentSchema(db);
const store = new Store(db);
const blobs = new SupabaseBlobStore(config.supabaseUrl, config.supabaseSecretKey, config.bucket);
const app = buildApp({
  store, blobs, cronSecret: config.cronSecret, corsOrigins: config.corsOrigins, trustProxy: config.trustProxy, logger: true,
  geocode: createGeocoder({ token: config.mapboxToken, log: m => console.warn(m) }),
});

// Vercel finishes server binding after the entrypoint import completes.
app.listen({ port: config.port, host: config.host }).then(() => {
  if (config.host === '0.0.0.0') {
    console.log(`PATAG API listening on all interfaces, port ${config.port}`);
    console.log('  This PC / Android emulator: http://127.0.0.1:%d/api  (emulator: http://10.0.2.2:%d/api)', config.port, config.port);
    for (const url of lanUrls(config.port)) console.log(`  Phones on the same Wi-Fi:   ${url}`);
  } else {
    console.log(`PATAG API http://${config.host}:${config.port}/api`);
  }

}).catch(err => {
  app.log.error(err);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => { await app.close(); await db.close(); process.exit(0); });
}
