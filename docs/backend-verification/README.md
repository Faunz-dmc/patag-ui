> **Later hosted acceptance:** The user subsequently authorized hosted setup. Migration, admin bootstrap, real sign-in/API/logout and browser route checks passed. See [the hosted record](hosted-acceptance-2026-10-27.md). The earlier records below preserve the pre-authorization state.

# Backend verification — 27 October 2026

Local implementation is ready for hosted acceptance. The configured Supabase project has **not** been migrated, and `admin@patag.test` has **not** been created there. No private server credential/password was available, and the request explicitly reserves hosted mutation for authorization.

## Exact checks

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `npm test` | 29 passed, 0 failed, 0 skipped | 25 backend tests plus four frontend map/analytics tests. Isolated PostgreSQL and Auth/Storage boundary stubs. |
| `npm run test:api` | 7 passed, 0 failed, 0 skipped | Existing separate dev-mock suite; not Supabase acceptance. |
| `npm run build` | Passed | TypeScript project build and Vite production bundle. Existing >500 kB bundle warning remains. |
| `npm run lint` | Exit 0; four warnings | Existing Date-in-render, two set-state-in-effect and dialog-ref cleanup warnings. No suppression added. |
| `npm run test:browser` | 10 checks passed | Built admin → actual Node API → isolated PostgreSQL; external Auth/Storage stubs. 0 page errors, 0 failed API responses, 0 demo-auth requests. Includes real modal payloads, CSV formula protection and PDF downloads. |
| Root `npm audit` | 0 vulnerabilities | Installed locked root dependencies. |
| Admin `npm audit` | 0 vulnerabilities | Installed locked admin dependencies. |
| Migration runner + SQL repeatability | Passed | Actual runner applies once, repeat is no-op, edited checksum rejected; raw SQL applies twice. PGlite auth/storage schema stand-ins are not a hosted Supabase instance. |
| Ownership-guard mutation experiment | Caught | Temporarily removing the maintenance ownership condition fails the regression; original source restored. |
| Unconfigured `npm run dev:api` / `db:migrate` | Expected refusal | `SUPABASE_SERVICE_ROLE_KEY` missing; no hosted connection/mutation. |
| Unconfigured `npm run seed:admin` | Expected refusal | Missing password; CLI now identifies `PATAG_TEST_ADMIN_PASSWORD`. No account created. |
| `git diff --check` | Passed | Whitespace check; Git reports normal LF/CRLF conversion notices. |

[Browser result JSON](browser-results.json) and [resolved report screenshot](admin-report.png) use synthetic data. Earlier browser runs found a selector race and malformed duplicate SQL; both were corrected, and the final run passed. Historical passes are not substituted for the results above.

## Affected files and callers

| Area | Files / responsibility |
| --- | --- |
| Supabase-only server | `backend/server.mjs`, `config.mjs`, `db.mjs`, `auth.mjs` — routes, fail-closed configuration, transactions, role context, cookies, Auth/MFA/recovery and shared rate limits. |
| Queries/workflows | `backend/queries.mjs`, `workflow.mjs`, `service.mjs` — compatible models, scoped bounded reads, exact transitions, evidence attachment, recipient notifications, teams/settings, audit and export authorization. |
| Accounts/evidence | `backend/accounts.mjs`, `evidence.mjs` — protected roles, Supabase Auth provisioning compensation and private object upload/streaming. |
| Setup commands | `backend/migrate.mjs`, `seed-admin.mjs`, `backend/.env.example`, root `package.json`/`package-lock.json`/`.env.example`/`.gitignore`. |
| SQL | `supabase/migrations/202610270001_admin.sql`. |
| Frontend callers | `admin-web/src/api.ts` replaces bearer/demo transport and handles bootstrap pages. `App.tsx` updates Login/Shell, report decision and duplicate callers, map, teams/users, statistics and authorized export preparation. `ResetPassword.tsx`, `map.ts`, `analytics.ts`, `types.ts`, `vite.config.ts`, `index.html`, `.env.example`. Existing route/view composition is retained. |
| Backend tests | `backend/tests/{accounts,auth,config,database,evidence,http,mfa-recovery,regressions,seed,service,workflow}.test.mjs`; `database.mjs` is the isolated PostgreSQL harness. |
| Frontend checks | `admin-web/tests/{map,analytics}.test.mjs`, `supabase-browser.mjs`. |
| Documentation | README, `docs/{api-contract,architecture,status-transitions,requirements-matrix,screen-inventory,supabase-connection,supabase-backend}.md`, this record, and `docs/decisions/0001-supabase-admin.md`. |

One execution-scope mistake occurred: the earlier admin npm install/audit used a relative cache path which npm resolved to `C:\Users\Admin\Documents\ChatGPT\.npm-cache`, outside the requested directory. The corrected commands use an absolute cache under patag-ui. That outside cache was not inspected, removed or modified further. Project source edits remain within patag-ui.

No source from another checkout was inspected, imported or modified. `dev-mock`, maintenance-web, citizen-mobile, preview implementations and their existing test sources were preserved. The task branch is `codex/supabase-admin-backend`; no remote push or deployment occurred.

## Tables, policies and API

Eleven public tables: `patag_profiles`, `patag_teams`, `patag_reports`, `patag_assignments`, `patag_evidence`, `patag_report_history`, `patag_repair_updates`, `patag_completions`, `patag_notifications`, `patag_audit_events`, `patag_settings`. Private tables: `sessions`, `rate_limits`, and the migration checksum registry in `patag_private`.

All application tables enable RLS. Browser roles have scoped SELECT policies and no INSERT/UPDATE/DELETE privileges. Protected profile role/active/municipality and live Auth session/MFA determine visibility. Report-scoped history, evidence, assignments and completion policies prevent cross-jurisdiction access; notice policies require the recipient. The trusted NOLOGIN NOBYPASSRLS API role has scoped mutation policies; audit/history are append-only to it. Session/rate tables also enable RLS and are not granted to browser roles. A private `patag-evidence` bucket is declared; no public object read policy is added.

[The complete route table](../api-contract.md) covers health; password/MFA/recovery/logout/current-user Auth; bootstrap/report listing/detail/events/history; duplicates; teams/users/settings; notices/read state; statistics; audited export preparation; activity; private uploads/evidence streaming. There is no demo endpoint, citizen intake API switch, fallback persistence, public evidence publication, or automatic hosted provisioning.

## Review resolutions

Separate read-only correctness, security and test/maintainability reviews were performed. Actionable findings were fixed and checked:

- Strict action payloads now match the real modal FormData; duplicate callers use the stored report ID and one bounded candidate query.
- Replay rechecks current action permission and report scope before returning a prior result.
- Session IDs must remain in Auth sessions, including direct RLS reads; recovery deletes local sessions. Enrolled MFA cannot be skipped.
- Maintenance requires the current assigned team; former citizen ownership cannot grant repair access after a role change.
- Canonical duplicates are serialized, targets are locked, and referenced originals cannot later be rejected/marked duplicate.
- Completion/update photos are loaded independently of the bounded before-photo collection, with uploader checks and SQL rollback on invalid attachment.
- Newly created Auth identities/Storage objects are compensated on SQL failure; explicit reset partial failures remain documented.
- Inherited sort/role keys fail validation. Literal search treats %, underscore and backslash as text. History pagination works, date charts use full dates, and resolution duration uses the actual resolve timestamp.
- API quotas use verified user IDs; trusted proxy address mode is explicit. Origin-only referrers support restricted Mapbox tokens.

## Outstanding acceptance

Configure private credentials outside chat and obtain explicit hosted authorization before running the documented migration/seed commands. Then verify real sign-in, schema/constraints/RLS under multiple identities, private Storage, recovery email/template, enrolled MFA, and actual browser operations against the selected Supabase project. Real database concurrency/TLS, backup/restore, retention/cleanup, production proxy and restricted Mapbox-token checks remain unperformed. Provider stubs and single-connection PostgreSQL tests cannot establish these outcomes.

Skills actually used: Ponytail full, Context7, security-and-hardening, test-driven-development, incremental-implementation, code-review-and-quality, git-workflow-and-versioning, documentation-and-adrs. Current Supabase/Auth/Storage, Mapbox, pg, Vite, PGlite and Playwright documentation was queried through Context7.
