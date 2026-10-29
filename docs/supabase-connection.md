> **Later hosted acceptance:** The user subsequently authorized hosted setup. Migration, admin bootstrap, real sign-in/API/logout and browser route checks passed. See [the hosted record](backend-verification/hosted-acceptance-2026-10-27.md). The earlier records below preserve the pre-authorization state.

> **Current consumer — 27 October 2026:** backend/ now explicitly loads the existing root public metadata plus a separate ignored backend/.env.local for private credentials. See [the current setup guide](supabase-backend.md). The 25 October connection-only handoff below is retained as dated evidence; statements that no backend consumes configuration are historical. No hosted resource was mutated by the backend implementation task.

# Supabase connection handoff

Connection configuration only, checked on 2026-10-25 (Asia/Manila).

## Selected existing project

- Project: PATAG; organization: TestiGOATS; branch: main / PRODUCTION.
- Reference: `fzivdpjaceoegetsnbta`.
- URL: `https://fzivdpjaceoegetsnbta.supabase.co`.
- Identity, publishable key and session pooler metadata were read from the existing authenticated Supabase dashboard.
- The dashboard reported Healthy at inspection time. This does not establish acceptance of individual services.

## Local configuration and use

Root `.env.local` contains only public connection metadata and the existing publishable key. Git ignores it through `.gitignore` rule `.env.*`. Root `.env.example` contains placeholders and a commented future database-password name. Neither file is automatically loaded by the current applications.

| Variable | Location and intended use |
| --- | --- |
| `SUPABASE_PROJECT_REF` | Root .env.local; identifies the hosted project for later backend tooling. |
| `SUPABASE_URL` | Root .env.local; base URL for later backend service clients. |
| `SUPABASE_PUBLISHABLE_KEY` | Root .env.local; existing browser-safe key, value omitted here. Send in the apikey header for direct HTTP requests. It is not a user session or server secret. |
| `SUPABASE_DB_HOST` | Root .env.local; existing session pooler host. |
| `SUPABASE_DB_PORT` | Root .env.local; session pooler port 5432. |
| `SUPABASE_DB_NAME` | Root .env.local; database name from the connection dialog. |
| `SUPABASE_DB_USER` | Root .env.local; project-scoped session pooler user from the connection dialog. |
| `SUPABASE_DB_PASSWORD` | Commented placeholder in .env.example only; absent from local configuration. Configure privately in the future backend's existing ignored server environment or secret manager. |

No current backend requires a server secret key, so none was retrieved, added or stored. No existing ignored server-side environment file or configured secret manager was found in this project. Root .env.local is reserved for public metadata; do not add database passwords, secret/service-role keys or user tokens to it. Do not put secrets in either web application's environment, VITE_* variables, Dart defines, logs, commits or documentation.

The backend developer can read the root metadata explicitly when implementing the backend later. This task adds no loader, SDK, dependency, Supabase client, backend switch or runtime consumer. Both web applications retain their existing VITE_API_URL and API/authentication adapters. The local mock API and Flutter application are unchanged.

This checkout contains two React web portals, a Flutter application and a Node development mock API. No PHP or SQLite backend was found here. No files from the separate AdvWebProject checkout were changed.

## Service references

Derive these from SUPABASE_URL; additional environment variables are unnecessary.

| Service | Existing project endpoint or reference |
| --- | --- |
| Data API | https://fzivdpjaceoegetsnbta.supabase.co/rest/v1/ |
| Auth | https://fzivdpjaceoegetsnbta.supabase.co/auth/v1 |
| Storage | https://fzivdpjaceoegetsnbta.supabase.co/storage/v1 |
| Realtime | https://fzivdpjaceoegetsnbta.supabase.co/realtime/v1 |
| Edge Functions base | https://fzivdpjaceoegetsnbta.supabase.co/functions/v1 |
| PostgreSQL session pooler | aws-0-ap-northeast-1.pooler.supabase.com:5432; database postgres; user postgres.fzivdpjaceoegetsnbta |
| Direct PostgreSQL host | db.fzivdpjaceoegetsnbta.supabase.co:5432; the dashboard identifies direct connections as IPv6 by default. |

Endpoint references do not prove functionality. The Edge Functions dashboard showed the first-function deployment screen, with no deployed functions listed; no function URL was invented or invoked.

## Read-only verification

HTTP requests used the existing publishable key in the apikey header, normal TLS validation, a 15-second timeout and no redirect following. No row queries, SQL, user login, uploads, function invocations, channel subscriptions or broadcasts were performed.

| Check | Exact result and limit |
| --- | --- |
| Selected project identity | Dashboard matched PATAG / TestiGOATS / fzivdpjaceoegetsnbta, main PRODUCTION. |
| GET /auth/v1/health | HTTP 200. Health endpoint reachable. Signup, sign-in, recovery, providers and MFA not verified. |
| GET /storage/v1/status | HTTP 200. Status endpoint reachable. Bucket access, file reads/writes and policies not verified. |
| GET /rest/v1/ | HTTP 401. HTTP endpoint responded; anonymous Data API access not verified. One repeat for error classification also returned an error; no permissions changed. |
| GET /realtime/v1/api/health | HTTP 401. HTTP endpoint responded; Realtime health and authenticated access not verified. |
| Session pooler TCP connection | TCP 5432 accepted a connection. PostgreSQL authentication, TLS negotiation and queries not verified. |
| Edge Functions dashboard | No deployed functions listed; invocation intentionally not verified. |
| Ignore rule | git check-ignore matched .env.local to .gitignore line 10, .env.*. |
| Developer tooling | Supabase plugin remains unconnected; CLI not found on PATH; no Supabase MCP server configured. No dependency or tool installed. |

The existing dashboard session allowed identity/configuration inspection; it does not authenticate the local application, plugin, MCP or CLI. To complete developer-tool authentication later, connect the Supabase integration privately. If using hosted MCP instead, scope it to this reference with read_only=true: https://mcp.supabase.com/mcp?project_ref=fzivdpjaceoegetsnbta&read_only=true. This URL is a handoff reference, not an active MCP connection.

Database login remains blocked by the absence of an approved private credential source. Data API/Realtime authorization and hosted settings are outside this connection-only task. No fallback backend was introduced.

No Supabase backend resources or application backend behavior were created or modified.

## Official references

- [API keys](https://supabase.com/docs/guides/api/api-keys)
- [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase MCP configuration](https://supabase.com/docs/guides/ai-tools/mcp)
