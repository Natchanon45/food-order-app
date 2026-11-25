#!/bin/sh
# Isolated local QA only. Never inherit the developer's Firebase/GCloud credentials.
set -eu
cd "$(dirname "$0")/.."
DEMO_HOME="$(mktemp -d /tmp/penguin-web-demo-home.XXXXXX)"
CACHE="${FIREBASE_EMULATORS_PATH:-$HOME/.cache/firebase/emulators}"
JAVA="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
# The caller's environment, including cloud credentials, is intentionally absent.
exec env -i HOME="$DEMO_HOME" PATH="$JAVA/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" JAVA_HOME="$JAVA" TMPDIR=/tmp FIREBASE_EMULATORS_PATH="$CACHE" \
 GCLOUD_PROJECT=demo-penguin-hybrid GCP_PROJECT=demo-penguin-hybrid \
 VITE_USE_FIREBASE_EMULATORS=true VITE_HYBRID_DEMO_PAYMENT_E2E=true \
 VITE_DEMO_FIRESTORE_EMULATOR_PORT=8189 WEB_DEMO_ISOLATED_PORT=8189 HYBRID_DEMO_FUNCTIONS_ONLY=1 \
 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8189 \
 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 \
 firebase emulators:exec --project demo-penguin-hybrid --config firebase.web-demo-emulator.json --only auth,firestore,functions,storage 'node tools/seed-hybrid-browser-demo.mjs && node tools/seed-premium-delivery-demo.mjs && npm run dev:react:hybrid-demo -- --host 127.0.0.1'
