#!/bin/sh
# Independently deploy only merchant notification settings and read-only Android dashboard.
# The primary codebase also contains secret-bound Stripe/Telegram functions;
# do not require unrelated provider credentials for this deployment.
# Existing Telegram encryption secret only; no secret values, payment mutations, device ingest, or triggers.
set -eu
cd "$(dirname "$0")/.."
ROOT="$PWD"
[ "$(git branch --show-current)" = "feature/react-firebase-port" ]
[ "${1:-}" = "--deploy" ] || { echo "Usage: sh tools/deploy-merchant-notification-settings.sh --deploy"; exit 2; }
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/penguin-merchant-notify-release.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT HUP INT TERM
mkdir "$STAGE/functions"
cp "$ROOT/functions/tenant-telegram.js" "$ROOT/functions/platform-telegram.js" "$ROOT/functions/payment-companion.js" "$ROOT/functions/payment-companion-policy.js" "$ROOT/functions/payment-companion-receiver.js" "$ROOT/functions/payment-companion-kitchen-policy.js" "$ROOT/functions/payment-companion-qr-policy.js" "$ROOT/functions/managed-email-callable.js" "$STAGE/functions/"
cat > "$STAGE/functions/index.js" <<'JS'
const {initializeApp}=require("firebase-admin/app");
initializeApp();
const telegram=require("./tenant-telegram");
const companion=require("./payment-companion");
exports.getTenantTelegramSettings=telegram.getTenantTelegramSettings;
exports.saveTenantTelegramSettings=telegram.saveTenantTelegramSettings;
exports.testTenantTelegramSettings=telegram.testTenantTelegramSettings;
exports.getPaymentCompanionDashboard=companion.getPaymentCompanionDashboard;
JS
node - "$ROOT" "$STAGE" <<'JS'
const fs=require("fs"),path=require("path");
const [root,stage]=process.argv.slice(2);
const dependencies={};
for(const name of ["firebase-admin","firebase-functions"]){
 dependencies[name]=require(path.join(root,"functions","node_modules",name,"package.json")).version;
}
fs.writeFileSync(path.join(stage,"functions","package.json"),JSON.stringify({name:"penguin-merchant-notification-settings",private:true,main:"index.js",engines:{node:"22"},dependencies},null,2));
fs.writeFileSync(path.join(stage,"firebase.json"),JSON.stringify({functions:{source:"functions",codebase:"default",disallowLegacyRuntimeConfig:true,ignore:["node_modules","**/.*"]}},null,2));
JS
# Reuse installed dependencies solely for local function discovery. The
# deployment manifest contains exact package versions; node_modules excluded.
ln -s "$ROOT/functions/node_modules" "$STAGE/functions/node_modules"
(cd "$STAGE" && node -e 'const f=require("./functions");const expected=["getTenantTelegramSettings", "saveTenantTelegramSettings", "testTenantTelegramSettings", "getPaymentCompanionDashboard"];if(JSON.stringify(Object.keys(f).sort())!==JSON.stringify(expected.sort()))process.exit(1);for(const n of expected){const a=f[n].__endpoint.secretEnvironmentVariables||[];if(a.some(x=>x.secret!=="PENGUIN_TELEGRAM_ENCRYPTION_KEY"&&x.key!=="PENGUIN_TELEGRAM_ENCRYPTION_KEY"))process.exit(1);if(n==="getPaymentCompanionDashboard"&&a.length)process.exit(1)};console.log("Scoped merchant notification settings manifest:",expected.join(", "))')
cd "$STAGE"
firebase deploy --config "$STAGE/firebase.json" --project chat-45754 --only functions:getTenantTelegramSettings,functions:saveTenantTelegramSettings,functions:testTenantTelegramSettings,functions:getPaymentCompanionDashboard --non-interactive
