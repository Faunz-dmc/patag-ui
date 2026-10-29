# Password recovery compatibility verification - 2026-10-27

Cause: the reset page read only query token_hash; Supabase's standard recovery verification redirects with an access_token fragment. The page now accepts both recovery callback formats, strips query/fragment data, keeps tokens in memory, and handles a new recovery fragment in the same tab.

The password endpoint requires exactly one token, validates the user through Supabase Auth and checks token claims and a live auth.sessions record before using that user's token to update the password. It retains local session deletion and global Auth logout. A post-update cleanup outage reports truthfully that the password already changed and clears the browser cookie.

Verification:
- Initial regressions failed before their corresponding fixes.
- Full local suite: 33 passed, 0 failed/skipped before adding the cleanup-outage regression.
- Final focused parser/Auth/MFA/recovery suite: 8 passed, 0 failed/skipped, including both cleanup failure paths.
- Final isolated Chrome recovery checks: 4 groups passed, 0 page errors. Both link formats submitted through the actual local Node API and isolated PostgreSQL with synthetic Auth; missing/expired/wrong-flow callbacks, provider rejection and revoked sessions were checked.
- Production frontend build passed. Existing large-chunk warning remains.
- Final lint passed with four existing App.tsx warnings. git diff --check passed.
- Separate read-only correctness, security and test reviews completed; the correctness cleanup finding was corrected and retested.

No recovery email was sent and no hosted password was changed. Hosted SMTP, redirect allowlist/template settings and enrolled-MFA recovery behavior remain unverified. A new recovery email is needed for an expired, consumed or previously stripped link.

Reproduce locally from patag-ui: npm test; npm run build; node admin-web/tests/recovery-browser.mjs. The browser test uses only synthetic Auth and an isolated database; it does not load private hosted environment files.
