# Migration recovery and compatibility

The checksum blocker reported in the older contract has been resolved locally. The original `202610270001_admin.sql` was recovered from the original 27 October setup operations, preserving their mixed LF/CRLF line endings. Its exact bytes match the live `patag_private.migrations` ledger:

```text
backend/legacy/202610270001_admin.sql
SHA-256: c00208a781b81c0fd1a00874ab7d76042d9221719cc71240f03e2e0fe611a733
```

The archive is an immutable reference. It is outside `backend/migrations/`, is never executed by the current runner, and has a `-text` Git attribute to prevent newline normalization. The backend image includes it, and a raw-byte hash regression check protects it. Do not reformat or re-save it in an editor that changes line endings.

## Current configured database

Read-only inspection on 3 November 2026 confirmed two existing migration histories:

- Current backend: `001_init.sql` and `002_unassigned_crew.sql` in `public.schema_migrations`, with populated current `users`, `teams`, `reports`, and related tables.
- Older admin backend: `202610270001_admin.sql` and its matching checksum in `patag_private.migrations`, with preserved `public.patag_*` tables.

Both current migrations were already applied before this repair. Replaying the old initializer or converting the legacy tables was unnecessary. The previous unconditional rejection of any legacy table was too strict for this existing coexistence.

Current API authentication uses `public.users`. Legacy profiles remain separate; this repair does not merge identities, transfer passwords, rename accounts, remove Auth users, or convert legacy reports. The recovered SQL's policies and helper functions address the older `patag_*` tables; checksum recognition does not establish full live schema or permissions acceptance.

## Read-only diagnosis

From the repository root, with the intended connection configured in `backend/.env`:

```powershell
npm --prefix backend run check:migrations
```

This command opens a read-only transaction. On the configured database it now reports `Recognized migration lineage. Pending: none.` It does not run migrations, seed, provision a password, or contact Storage. Success verifies the recognized migration histories and required baseline table presence, not every column, constraint, policy, data row, or application flow.

The shared check runs before migration writes in API startup, `migrate`, `seed`, and `create-admin`. It accepts fresh initialization, recognized current migration prefixes, and current/legacy coexistence only when all current baseline tables exist and the entire legacy ledger contains exactly the recovered migration name and checksum. It also hashes the bundled reference bytes before accepting coexistence.

Legacy-only databases, legacy relations without their ledger, missing baseline tables, malformed current registries, unknown or incomplete current histories, changed checksums, and extra legacy migration records remain blocked before migration writes. Neither migration ledger is rewritten or adopted to bypass validation. The diagnostic command itself remains read-only even for a supported database; ordinary startup and provisioning commands may perform their documented writes after validation.

## If a different database is rejected

Keep it intact and obtain a restorable backup before an approved upgrade. Inspect its actual ledgers and schema read-only. Do not delete records, replace checksums, stamp a current baseline over older data, or replay the archived SQL. An older-only database still needs an explicit reviewed upgrade, rehearsed on an isolated restored copy with account IDs, hashes, ownership, foreign keys and authorization checked.

Verify the recovered file without altering it:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath './backend/legacy/202610270001_admin.sql'
```

## Verification and limits

- The full backend suite passed 49/49 tests, with no failures or skips. The focused migration suite passed 18/18 synthetic PGlite tests. It covers raw archive bytes and packaging, fresh/idempotent initialization, the crew upgrade, read-only diagnosis, valid coexistence preserving registries and account/report/team data, and rejection paths before mutation. Backend TypeScript validation passed.
- Read-only inspection also confirmed RLS enabled on current tables, no SELECT/INSERT/UPDATE/DELETE privileges there for `anon`, `authenticated`, or legacy `patag_api`, and no current-table policies or non-internal triggers. This is a scoped permissions check, not a complete security audit.
- Live access was limited to read-only schema, migration ledger, permissions and aggregate count queries, plus the read-only diagnostic. No hosted migrations, ledger/checksum changes, seeding, password provisioning, Storage operations, or deployment were performed.
- The configured client reported that `SUPABASE_DB_CA_CERT` is unset: encryption is enabled but it does not verify the server certificate. Configure the trusted CA before production acceptance.
- Full hosted login/workflow acceptance, a restored-backup rehearsal, and a Docker build were not performed. Storage setup and deployment are separate operations outside the database guard.
