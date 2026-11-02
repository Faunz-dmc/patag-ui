# How to run the PATAG mobile apps

There are two Flutter apps:

| App | Folder | Default language |
|---|---|---|
| Citizen (reports potholes) | `citizen-mobile` | English |
| Road crew (repairs) | `maintenance-mobile` | Tagalog |

You need **3 terminals**: one for the backend, one for the emulator, and one for each app. Run every command from the repo folder `C:\Moble dev\patag-ui` unless the step says `cd`.

---

## One-time setup (first time only)

1. Install **Node.js 24**, **Flutter** (at `C:\flutter`, a path without spaces) and **Android Studio**.
2. In Android Studio, open **Device Manager** and create a phone emulator. This PC already has one named `Small_Phone`.
3. Install the backend packages and create its settings file:
   ```bash
   cd backend
   npm install
   copy .env.example .env
   ```
   Fill in the Supabase values in `backend/.env` (see [backend/README.md](../backend/README.md)). Never commit or share this file.
4. Optional: to get the **demo** sign-in buttons, set `ALLOW_DEMO=true` in `backend/.env`.

---

## Every time

### Step 1: Start the backend (terminal 1)

```bash
npm run api
```

Wait for `PATAG API http://127.0.0.1:4100/api`. Leave this terminal open.

### Step 2: Start the emulator (terminal 2)

```bash
flutter emulators --launch Small_Phone
```

You can also press ▶ next to the phone in Android Studio's Device Manager. Wait until the phone's home screen appears, then check that Flutter can see it:

```bash
flutter devices
```

You should see a line with `emulator-5554`.

### Step 3: Run an app (terminal 3)

**Citizen app:**

```bash
cd citizen-mobile
flutter run --dart-define-from-file=env/emulator.json
```

**Road crew app** (use another terminal if the citizen app is still running):

```bash
cd maintenance-mobile
flutter run --dart-define-from-file=env/emulator.json
```

The first build takes a few minutes. After that, the app opens on the emulator.

While `flutter run` is running, you can press these keys in its terminal:

| Key | What it does |
|---|---|
| `r` | Hot reload (shows code changes instantly) |
| `R` | Full restart |
| `q` | Quit the app |

### Step 4: Sign in

| App | Sign in with |
|---|---|
| Citizen | **Create account**, or the demo option (needs `ALLOW_DEMO=true`) |
| Road crew | A crew account made by the LGU admin, or **Open maintenance demo** (needs `ALLOW_DEMO=true`) |

To change the language, go to **Settings → Language / Wika** (citizen) or **Profile** (crew).

---

## Using a real phone instead

| Connection | Backend command | App command |
|---|---|---|
| USB cable (USB debugging on) | `npm run api`, then `npm run mobile:usb` | `flutter run --dart-define-from-file=env/usb.json` |
| Same Wi-Fi | `npm run api:lan` (prints an address) | Copy `env/lan.example.json` to `env/lan.json`, put that address in it, then `flutter run --dart-define-from-file=env/lan.json` |

---

## Stopping

1. Press `q` in each `flutter run` terminal.
2. Press **Ctrl+C** in the backend terminal.
3. Close the emulator window.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `'C:\Moble' is not recognized` | Open `android/local.properties` in the app folder and set `flutter.sdk=C:\\flutter`. Close **all** terminals and VS Code, reopen, then run with `C:\flutter\bin\flutter run ...` |
| `No devices found` | The emulator isn't fully started yet. Wait, then run `flutter devices` again |
| "Can't reach the PATAG server" / connection timed out | The backend isn't running. Do Step 1 |
| "Endpoint not found" on a demo button | Set `ALLOW_DEMO=true` in `backend/.env`, then restart the backend |
| Port 4100 already in use | An old backend is still running. Run `Get-NetTCPConnection -LocalPort 4100 \| Select OwningProcess`, then `Stop-Process -Id <number>` |
| `adb` is not recognized | Not needed for the emulator. For USB phones, use `npm run mobile:usb`, which finds adb by itself |

For running the websites as well, see [LAUNCH.md](LAUNCH.md).
