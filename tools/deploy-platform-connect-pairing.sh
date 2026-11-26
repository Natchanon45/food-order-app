#!/bin/sh
# Independently deploy only central Android pairing-only UAT endpoints.
# The primary codebase also contains secret-bound Stripe/Telegram functions;
# do not require unrelated provider credentials for this deployment.
# No secret files, .env files, triggers, rules or payment endpoints are packaged.
set -eu
cd "$(dirname "$0")/.."
ROOT="$PWD"
[ "$(git branch --show-current)" = "feature/react-firebase-port" ]
[ "${1:-}" = "--deploy" ] || { echo "Usage: sh tools/deploy-platform-connect-pairing.sh --deploy"; exit 2; }
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/penguin-connect-pairing-release.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT HUP INT TERM
mkdir "$STAGE/functions"
cp "$ROOT/functions/platform-connect-pairing.js" "$ROOT/functions/platform-connect-receiver-policy.js" "$ROOT/functions/payment-companion-policy.js" "$ROOT/functions/managed-email-callable.js" "$STAGE/functions/"
cat > "$STAGE/functions/index.js" <<'JS'
const {initializeApp}=require("firebase-admin/app");
initializeApp();
const setup=require("./platform-connect-pairing");
exports.getPlatformConnectPairing=setup.getPlatformConnectPairing;
exports.createPlatformConnectPairing=setup.createPlatformConnectPairing;
exports.revokePlatformConnectPairing=setup.revokePlatformConnectPairing;
exports.platformConnectDeviceStatus=setup.platformConnectDeviceStatus;
exports.platformConnectDeviceUnpair=setup.platformConnectDeviceUnpair;
exports.platformConnectDeviceTest=setup.platformConnectDeviceTest;
exports.confirmPlatformConnectReceiver=setup.confirmPlatformConnectReceiver;
JS
node - "$ROOT" "$STAGE" <<'JS'
const fs=require("fs"),path=require("path");
const [root,stage]=process.argv.slice(2);
const dependencies={};
for(const name of ["firebase-admin","firebase-functions"]){
 dependencies[name]=require(path.join(root,"functions","node_modules",name,"package.json")).version;
}
fs.writeFileSync(path.join(stage,"functions","package.json"),JSON.stringify({name:"penguin-platform-connect-pairing",private:true,main:"index.js",engines:{node:"22"},dependencies},null,2));
fs.writeFileSync(path.join(stage,"firebase.json"),JSON.stringify({functions:{source:"functions",codebase:"default",disallowLegacyRuntimeConfig:true,ignore:["node_modules","**/.*"]}},null,2));
JS
# Reuse installed dependencies solely for local function discovery. The
# deployment manifest contains exact package versions; node_modules excluded.
ln -s "$ROOT/functions/node_modules" "$STAGE/functions/node_modules"
(cd "$STAGE" && node -e 'const f=require("./functions");const expected=["getPlatformConnectPairing", "createPlatformConnectPairing", "revokePlatformConnectPairing", "platformConnectDeviceStatus", "platformConnectDeviceUnpair", "platformConnectDeviceTest", "confirmPlatformConnectReceiver"];if(JSON.stringify(Object.keys(f).sort())!==JSON.stringify(expected.sort()))process.exit(1);for(const n of expected){if((f[n].__endpoint.secretEnvironmentVariables||[]).length)process.exit(1)};console.log("Scoped Android connection manifest:",expected.join(", "))')
cd "$STAGE"
firebase deploy --config "$STAGE/firebase.json" --project chat-45754 --only functions:getPlatformConnectPairing,functions:createPlatformConnectPairing,functions:revokePlatformConnectPairing,functions:platformConnectDeviceStatus,functions:platformConnectDeviceUnpair,functions:platformConnectDeviceTest,functions:confirmPlatformConnectReceiver --non-interactive
