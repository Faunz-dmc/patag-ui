# Cloudflare Pages + Vercel

Deploy only `admin-web` to Pages and `backend` to Vercel. Do not run the root
`build:web` script: it also builds maintenance-web. Both Flutter apps use the same API.

## Release order

1. Back up the intended database. From backend, run `npm run check:migrations`.
   Review and apply pending migrations with `npm run migrate` separately before
   starting the new API. Startup checks the schema read-only and refuses pending
   migrations. Do not seed or recreate existing accounts as part of deployment.
2. In Vercel import the repository with Root Directory `backend`, preset Fastify,
   Node 24.x and install command `npm ci`. Keep the preset build/output defaults.
   The sole Fastify entrypoint is `src/index.ts`; `vercel.json` includes the SQL
   and exact legacy archive bytes required by the startup compatibility check.
3. Configure the existing SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_DB_HOST,
   SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD,
   SUPABASE_DB_CA_CERT (trusted PEM), STORAGE_BUCKET=report-photos and exact
   CORS_ORIGINS. MAPBOX_TOKEN remains optional. Never expose server secrets in
   VITE_* or Flutter configuration. Vercel startup requires verified database TLS.
4. Set a random CRON_SECRET of at least 32 characters privately in Vercel.
   The production cron calls GET /api/internal/purge-sessions daily at 00:00 UTC
   (08:00 Manila). Missing or wrong Bearer authorization is rejected. No recurring
   in-process timer is used. Other hosts need an authenticated external scheduler.
   Session expiry remains enforced on every authenticated request even between runs.
5. Deploy the API and check /api/health, then login, workflow, and photo operations.
   Use an isolated test database/bucket for preview deployments. Do not point
   untrusted preview branches at production credentials.
6. In Pages connect the repository with root `admin-web`, preset React/Vite,
   build `npm run build`, output `dist`, NODE_VERSION=24 and
   VITE_API_URL=https://<api-host>/api. Rebuild after changing this public value.
   Add the final Pages origin to API CORS_ORIGINS and redeploy the API.
7. Rebuild citizen-mobile and maintenance-mobile against the HTTPS API using an
   env/production.json containing only API_URL, with /api exactly once:
   `flutter build apk --release --dart-define-from-file=env/production.json`.

## Limits and acceptance

New photos are limited to 3 MiB (3,145,728 bytes) in all deployed clients and the
API. Base64 is 4,194,304 bytes; the API body limit adds 64 KiB for JSON and remains
below Vercel's 4.5 MB limit. Oversized images must be resized before upload.
Existing stored photos are unchanged; old photos larger than the platform's
response limit need a separate delivery path or a smaller derivative before
they can be served by Vercel. Do not delete originals. Storage remains private.
The setup-storage command sets the new limit when creating a bucket; an existing
bucket need not be changed because API upload validation enforces the limit.

Each process reuses one PostgreSQL pool capped at two connections, with a 5-second
idle timeout and a 10-second connection timeout. Total connections still multiply
with instance count: use the Supabase pooler and size deployment concurrency to
the database capacity. This cap is not a global connection limit.

Before production test login/logout, citizen uploads, report assignment, crew
mobile completion, admin verification, unauthorized access, direct admin route
refresh, maximum-size photo upload, and cleanup authorization in a hosted preview.
The daily job is idempotent. Verify the production cron in Vercel after release.
Local tests are not hosted acceptance.

Official references:
- https://vercel.com/docs/frameworks/backend/fastify
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/functions/limitations
- https://developers.cloudflare.com/pages/configuration/build-configuration/
