# Verification results — 21 October 2026

## Passed

- Admin and maintenance: TypeScript checking and Vite production builds. A large-bundle warning remains (about 838 kB uncompressed initial JS; PDF generation is loaded on demand).
- Local Node API: 2 tests with lifecycle, duplicate heuristic, required evidence, image-signature rejection, unauthorized/team ownership, completion verification, feedback-once and public-identity assertions.
- Project-local Playwright with installed Chrome: 20 LGU content routes + 13 maintenance content routes and both role login screens opened (35 specified web screens). This is route smoke coverage; not every secondary action was clicked.
- Browser lifecycle: citizen report created/uploaded through API → admin verifies/assigns through UI → crew starts and saves progress through UI → after photo uploaded through UI → completion submitted → admin verifies resolution → citizen API receives final state/notification and submits feedback.
- Search and severity filter; mobile sidebar selection; scrollable report table; map zoom, recenter and report-marker popup; maintenance frontend route guard for user management.
- Dashboard widths: 320, 375, 390, 430, 768, 1024, 1280, 1366, 1440 and 1920 on both portals. No document-level horizontal overflow. Separate 390px report-table screenshot confirms internal table scrolling.
- No JavaScript page exceptions and no browser console errors in the latest run. See `browser-results.json` for actual observations.
- CSV data escaped and generated PDF signature validated from browser export blobs. PDF rendered with Poppler and visually reviewed: readable columns, pagination and explicit fictional-data label. Browser native download file writes were canceled by the sandbox; generated blobs were saved by the test runner instead.
- Screenshot review at desktop and phone widths. Fixed animated chart snapshots, colliding mobile date ticks, secondary metric captions and undersized labels. A final table-page screenshot exposed an absolutely positioned accessibility label escaping its scrolling container; containing/anchoring the label fixes the overflow, and the harness now asserts the table page width as well. Screenshots are in `screenshots/`.
- Taste source lint: 0 failures. Intentional warnings: time-series dates resemble decorative numbering; toast/dialog shadows are overlays; em dashes occur in evidence labels and data punctuation.

## Unavailable or incomplete

- Playwright MCP is available but timed out connecting to the retained local dev server. Project-local Playwright was used successfully with API and static servers in the same execution context. It does not test Android.
- Taste standalone inspector failed launching its own Chrome crashpad process in this sandbox. The screenshot/overflow loop used the project-local browser harness instead.
- Installed Flutter/Dart runtime fails before tool execution: `Empty value for option resolved_executable_name` and direct VM `Failed to canonicalize path ... OS error (5)`. Explicit filesystem grants did not resolve it. Flutter create/pub get/analyze/test/integration/APK builds have NOT passed or run to completion. Native code is source-only delivery, not a validated Android binary.
- Android SDK/Studio and AVD `Medium_Phone_API_37.0` exist. `adb devices` returned no attached/running device. No native screenshots, camera/gallery checks, GPS grant/denial tests, text-scale tests or end-to-end Flutter flow were run. Widget/model/integration test sources are included for the repaired toolchain.
- VS Code Flutter/Dart extension installation was attempted but failed with EPERM during cache rename/chdir. README contains commands to run outside the sandbox.
- A Tree-sitter Dart WASM syntax check parsed all 12 Dart files without errors after fixing map/detail bracket issues. This does not substitute for Flutter analyze or package resolution. Native acceptance remains outstanding regardless of source checks.
- GitHub MCP returned login `lee-creatives`, no accessible repositories, and an account-scoped search error 422. No create-repository tool is exposed in this session. Private repository creation and pushing are not completed. Local commits and setup commands are provided.
- No production authentication, push/email, deployed persistence, storage or security audit. No complete WCAG/screen-reader certification. Browser responsive checks primarily target the dashboards, plus the mobile report table; every form at every width is not certified.

## Reproduce

From PATAG, install each web app's dependencies, build both, then run `npm run test:api` and `node admin-web/tests/browser-qa.mjs`. Stop other servers on 4100/5173/5174 first. The browser harness uses an isolated in-memory database and a test PNG; these files are test fixtures, not proof of actual repaired roads. API source tests write uploaded test images into ignored dev-mock/data; no test records are published.

After repairing Flutter, run `flutter pub get`, `dart format lib test integration_test`, `flutter analyze`, `flutter test`, then integration tests and Android device scenarios in README. Validate reporting interruption, gallery/camera permission handling, GPS failure/manual selection, duplicate review, accessible text scaling and post-resolution feedback before calling the native app complete.
