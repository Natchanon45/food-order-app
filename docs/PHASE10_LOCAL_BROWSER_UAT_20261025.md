# Phase 10 — Open the LOCAL Demo React UI (not Production)

**Repair:** Vite `serve` now uses Base `/` and reads the repository `public/`
assets, matching canonical React routes and `/react/parity/` CSS. Firebase
Hosting production builds retain Base `/react/` and their original publicDir.
The previous Development `/react/` entry was redirected by `main.jsx` to
`/`, but Vite with Base `/react/` redirected `/` back, and the CSS was
missing when served from the wrong Public Directory.

**Never use plain `npm run dev:react` for finance Demo UAT**: unless opted in,
the Frontend points at Production Firebase project `chat-45754`. This is a
read/write risk, not just a broken visual preview.

## Safe local Demo, three terminal windows

1. **Terminal 1 (keep running):** select Java 21, start AUTH/FIRESTORE/
   STORAGE/FUNCTIONS with `demo-penguin-hybrid` and loopback-only hosts:

```bash
cd ~/Desktop/Sites/food-order-app
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
GCLOUD_PROJECT=demo-penguin-hybrid GCP_PROJECT=demo-penguin-hybrid \
HYBRID_DEMO_FUNCTIONS_ONLY=1 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 \
npx firebase emulators:start --project demo-penguin-hybrid \
  --config firebase.hybrid-functions-emulator.json \
  --only auth,firestore,storage,functions
```

2. **Terminal 2:** seed ONLY synthetic demo records (once after restarting
   an empty Firestore Emulator). Guard rejects other project/hosts:

```bash
cd ~/Desktop/Sites/food-order-app
GCLOUD_PROJECT=demo-penguin-hybrid GCP_PROJECT=demo-penguin-hybrid \
HYBRID_DEMO_FUNCTIONS_ONLY=1 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 \
FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 \
npm run seed:hybrid-demo-browser
```

3. **Terminal 3 (keep running):** run the explicit Demo Vite server:

```bash
cd ~/Desktop/Sites/food-order-app
npm run dev:react:hybrid-demo
```

Open **http://127.0.0.1:5174/login** (NOT the old
`http://localhost:5174/react/` route).
Synthetic logins from seed output:
`hybrid-owner@demo.invalid` or `hybrid-reviewer@demo.invalid`,
password `EmulatorOnly123!` **for LOCAL Demo ONLY**.
Check `/reports/hybrid-billing` and `/platform/hybrid-invoices`
respectively for the Demo accounts. These are *synthetic* billing records;
do not infer bank authentication, real payment, or settlement.

**Caveats:** The seed's Demo invoice is `issued`, not bank verified/paid,
and the real Production finance callable remains OFF. Some financial steps
are intentionally unavailable outside the guarded Emulator test harness.
This setup is for manual UI/data preview; finance transaction UAT still
requires the explicit demo callable/Emulator workflows.

## Diagnostics

- If you see raw `กำลังโหลดข้อมูล...` without centered CSS/spinner, check
  DevTools → Network: `/src/main.jsx`, `/react/parity/css/app.css`,
  `/react/parity/css/page-ready-state.css` must return **200**
  with JavaScript/CSS MIME rather than 404/HTML.
- Verify terminal prints port **5174**, not 5175. Clear Vite cache with
  `npm run dev:react:hybrid-demo -- --force` if required; never clean or
  reset the Git working tree.
- If Firebase Auth / Firestore fails, confirm the 4 local emulators are
  running and the Vite console printed `demo-penguin-hybrid` configuration;
  never fall back to production project for a Demo UAT.

## Verification

```bash
npm run test:react-dev-preview
npm run test:react-foundation
npm run build:react
```

No `main` merge, Firebase production deploy, real payment or settlement.
