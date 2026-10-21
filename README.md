# PATAG

Pa-tag lubak, lubak patag.

Academic IT 305 project: a native Flutter citizen application and two independent React/TypeScript/Vite portals for LGU review and road maintenance. Source covers all 55 expanded route entries. Both web portals build and pass a tested cross-role demonstration. Android source and project scaffolding are included, but native compilation/device validation is blocked in this Codex environment. This is not a production-ready system.

## Structure

```
citizen-mobile/     Flutter/Dart Android application
admin-web/          Independent LGU Vite website :5173
maintenance-web/    Independent maintenance Vite website :5174
dev-mock/           Optional LOCAL development API :4100
references/         Unmodified PDFs, original images, extracted brand assets
docs/               Compliance matrix, 55 routes, contract, design and QA
```

Use fictional accounts/data only. There are no real LGU partnerships, repair records or official statistics. The mock service must not be exposed publicly. It supports cross-process state through HTTP and local JSON, not shared localStorage.

## Prerequisites and observed environment

Node 24.22.0, npm 11.19.1 and Git 2.55.0 were available. The web lockfiles record the installed dependency versions. Flutter was found at `C:\Users\user\Downloads\flutter_windows_3.47.6-stable\flutter`, Android SDK and Android Studio were present, and AVD `Medium_Phone_API_37.0` was listed. No device was running. Dart launch fails here with `Empty value for option resolved_executable_name` / `Failed to canonicalize path ... OS error (5)`, including direct runtime checks. Therefore flutter create, pub get, analyze, test and APK build have not succeeded. Android files were rendered from the installed SDK templates as a recoverable source scaffold; do not treat them as a verified flutter-create build.

Flutter/Dart VS Code extension installation was attempted but blocked by EPERM cache rename/chdir failures. Install outside this sandbox:

```powershell
code --install-extension Dart-Code.flutter
code --install-extension Dart-Code.dart-code
flutter doctor -v
flutter devices
```

If Flutter is not in PATH for the current shell:

```powershell
$env:Path = "C:\Users\user\Downloads\flutter_windows_3.47.6-stable\flutter\bin;" + $env:Path
```

If the same Dart runtime error occurs in an ordinary terminal, repair/re-extract the stable Flutter SDK from the official Flutter distribution before running the native checks. Do not overwrite your source while troubleshooting. The Android project may be regenerated with `flutter create --platforms=android --project-name patag_citizen .` in a backup copy if required.

## Run locally (PowerShell)

Open three terminal tabs. Start in this extracted PATAG directory.

API tab:

```powershell
npm run demo:api
```

LGU tab:

```powershell
cd admin-web
npm install
npm run dev
```

Open http://127.0.0.1:5173/admin/login and choose **Continue as LGU administrator**.

Maintenance tab:

```powershell
cd maintenance-web
npm install
npm run dev
```

Open http://127.0.0.1:5174/maintenance/login and choose **Continue as Road Crew Alpha**. Seeded accounts use demo access, not invented passwords. New citizen accounts can register with hashed passwords on the local API.

Native citizen app, after toolchain repair:

```powershell
cd citizen-mobile
flutter doctor -v
flutter pub get
flutter devices
flutter run --dart-define=API_URL=http://10.0.2.2:4100/api
```

For a USB-connected Android device, run `adb reverse tcp:4100 tcp:4100` and use `flutter run --dart-define=API_URL=http://127.0.0.1:4100/api`. Cleartext HTTP is allowed only by the debug manifest for the local demo; use HTTPS for production. Camera/gallery and GPS require real Android validation. Android emulator localhost is the emulator itself; `10.0.2.2` commonly reaches the host. The API binds 127.0.0.1, so do not assume LAN reachability.

## Configuration

Each web folder includes `.env.example`; copy to `.env.local` only when overriding the default API. No secrets belong in frontend environment variables. The native API URL is a Dart compile-time define. Tiles require internet access and follow OSM policy. There is no geocoding service or offline tile cache.

## Demonstrate the workflow

1. Citizen: demo access or register → report → upload photo → GPS/manual location → description/severity → duplicate review → submit.
2. LGU: verification queue → inspect evidence/location → verify → assign a crew.
3. Maintenance: assignment → start → progress → repair documentation → after photo/notes → submit for administrative verification.
4. LGU: repair verification → compare evidence → resolve or request additional work.
5. Citizen: refresh/poll → status/history/notification → feedback after Resolved.

The API/browser part of this flow was exercised automatically. The Flutter device portion remains unverified. A completion submission retains In Progress until the LGU confirms resolution.

## Builds and checks

```powershell
npm --prefix admin-web run build
npm --prefix maintenance-web run build
npm run test:api
node admin-web/tests/browser-qa.mjs
cd citizen-mobile
flutter analyze
flutter test
flutter test integration_test/app_test.dart -d <device-id>
flutter build apk --debug --dart-define=API_URL=http://10.0.2.2:4100/api
```

Stop retained servers before browser-qa: the script starts an isolated API and serves both built `dist` directories on the usual ports. Requires installed Google Chrome. It writes reports/screenshots in docs. Native browser download saving is canceled by this sandbox; the test validates and saves the generated CSV/PDF blobs instead. Build warnings identify a large initial web bundle; lazy jsPDF loading reduces initial cost, with further route splitting left for optimization.

## Documentation and limitations

See `docs/requirements-matrix.md`, `docs/screen-inventory.md`, `docs/api-contract.md`, `docs/status-transitions.md`, `docs/test-results.md`, `docs/architecture.md` and `docs/design-system.md`. Flutter/native QA, full screen-reader review, production auth/database/storage/notifications, transactional audit and deployment remain outstanding. Recovery is explicitly a demo and sends no email. Drafts are device-local; no automatic offline synchronization exists. Agency forwarding changes a local label and records history; it does not contact another agency. Team membership management is limited to workload/details; no employee system is implied.

## GitHub

GitHub MCP returned account `lee-creatives` and no accessible repositories. It exposes no repository-creation tool in this session; the account-scoped repository search also returned 422. No remote repository or push was completed. Local Git history is prepared. The source ZIP contains tracked files only; the companion `PATAG-history.bundle` preserves the commits and can be cloned with `git clone .\PATAG-history.bundle PATAG-with-history`. If using the ZIP without that bundle, run `git init -b main`, `git add .`, and `git commit -m "Initial PATAG source"` first. After installing/authenticating GitHub CLI with permission to create a private repository:

```powershell
gh auth login
gh repo list lee-creatives --limit 100
gh repo create patag-road-reporting-system --private --source . --remote origin --description "PATAG — A web and mobile-based pothole reporting and monitoring system connecting Philippine citizens, LGUs, and road maintenance teams."
git push -u origin main
```

Check for an existing repository before running create. If one exists, add its verified remote instead. No secrets, `.env` files, build outputs, node_modules or local demo records are tracked.
