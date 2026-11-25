#!/bin/sh
# Independently deploy only PG Notify scoped notification endpoints and FCM triggers.
# The primary codebase also contains secret-bound Stripe/Telegram functions;
# do not require unrelated provider credentials for this deployment.
# Only notification callables, device gateway and notification triggers are exported. No Telegram or financial functions are released.
set -eu
cd "$(dirname "$0")/.."
ROOT="$PWD"
[ "$(git branch --show-current)" = "feature/react-firebase-port" ]
[ "${1:-}" = "--deploy" ] || { echo "Usage: sh tools/deploy-pg-notify.sh --deploy"; exit 2; }
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/penguin-pg-notify-release.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT HUP INT TERM
mkdir "$STAGE/functions"
cp "$ROOT/functions/lk-shop-firebase.js" "$ROOT/functions/lk-shop-policy.js" "$ROOT/functions/lk-shop-device-gateway.js" "$ROOT/functions/lk-shop-notifications.js" "$ROOT/functions/managed-email-callable.js" "$ROOT/functions/tenant-telegram-events.js" "$ROOT/functions/platform-telegram-finance-events.js" "$ROOT/functions/platform-telegram.js" "$ROOT/functions/tenant-telegram.js" "$ROOT/functions/finance-manual-review-policy.js" "$ROOT/functions/delivery-slip-policy.js" "$STAGE/functions/"
cat > "$STAGE/functions/.env.chat-45754" <<'ENV'
PENGUIN_LK_SHOP_PILOT_ENABLED=1
PENGUIN_LK_SHOP_FCM_ENABLED=1
ENV
cat > "$STAGE/functions/index.js" <<'JS'
const {initializeApp}=require("firebase-admin/app");
initializeApp();
const pairing=require("./lk-shop-firebase"),gateway=require("./lk-shop-device-gateway"),notices=require("./lk-shop-notifications");
exports.getLKShopPairingDevices=pairing.getLKShopPairingDevices;
exports.issueLKShopPairingChallenge=pairing.issueLKShopPairingChallenge;
exports.revokeLKShopPairingDevice=pairing.revokeLKShopPairingDevice;
exports.queuePGNotifyTestPush=pairing.queuePGNotifyTestPush;
exports.lkShopDeviceGateway=gateway.lkShopDeviceGateway;
exports.notifyLKShopTenantOrder=notices.notifyLKShopTenantOrder;
exports.notifyLKShopPlatformWalletTopup=notices.notifyLKShopPlatformWalletTopup;
exports.notifyLKShopPlatformRevenueShare=notices.notifyLKShopPlatformRevenueShare;
exports.notifyLKShopWalletTopup=notices.notifyLKShopWalletTopup;
exports.notifyLKShopRevenueShare=notices.notifyLKShopRevenueShare;
exports.notifyLKShopHybridPlatformFee=notices.notifyLKShopHybridPlatformFee;
exports.pushLKShopNotice=notices.pushLKShopNotice;
JS
node - "$ROOT" "$STAGE" <<'JS'
const fs=require("fs"),path=require("path");
const [root,stage]=process.argv.slice(2);
const dependencies={};
for(const name of ["firebase-admin","firebase-functions"]){
 dependencies[name]=require(path.join(root,"functions","node_modules",name,"package.json")).version;
}
fs.writeFileSync(path.join(stage,"functions","package.json"),JSON.stringify({name:"penguin-pg-notify",private:true,main:"index.js",engines:{node:"22"},dependencies},null,2));
fs.writeFileSync(path.join(stage,"firebase.json"),JSON.stringify({functions:{source:"functions",codebase:"default",disallowLegacyRuntimeConfig:true,ignore:["node_modules","**/.*"]}},null,2));
JS
# Reuse installed dependencies solely for local function discovery. The
# deployment manifest contains exact package versions; node_modules excluded.
ln -s "$ROOT/functions/node_modules" "$STAGE/functions/node_modules"
(cd "$STAGE" && node -e 'const f=require("./functions");const expected=["getLKShopPairingDevices", "issueLKShopPairingChallenge", "revokeLKShopPairingDevice", "queuePGNotifyTestPush", "lkShopDeviceGateway", "notifyLKShopTenantOrder", "notifyLKShopPlatformWalletTopup", "notifyLKShopPlatformRevenueShare", "notifyLKShopWalletTopup", "notifyLKShopRevenueShare", "notifyLKShopHybridPlatformFee", "pushLKShopNotice"];if(JSON.stringify(Object.keys(f).sort())!==JSON.stringify(expected.sort()))process.exit(1);for(const n of expected){if((f[n].__endpoint.secretEnvironmentVariables||[]).length)process.exit(1)};console.log("Scoped PG Notify manifest:",expected.join(", "))')
cd "$STAGE"
firebase deploy --config "$STAGE/firebase.json" --project chat-45754 --only functions:getLKShopPairingDevices,functions:issueLKShopPairingChallenge,functions:revokeLKShopPairingDevice,functions:queuePGNotifyTestPush,functions:lkShopDeviceGateway,functions:notifyLKShopTenantOrder,functions:notifyLKShopPlatformWalletTopup,functions:notifyLKShopPlatformRevenueShare,functions:notifyLKShopWalletTopup,functions:notifyLKShopRevenueShare,functions:notifyLKShopHybridPlatformFee,functions:pushLKShopNotice --non-interactive
