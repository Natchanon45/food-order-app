#!/bin/sh
# Roll out all existing central threshold consumers before enabling publication.
# No pricing document, invoice, or payment is written by this release script.
# No new scheduler, provider credentials, Firestore rules, or unrelated functions.
set -eu
cd "$(dirname "$0")/.."
ROOT="$PWD"
[ "$(git branch --show-current)" = "feature/react-firebase-port" ]
case "${1:-}" in
 --deploy) ;;
 --resume-verified) [ "$#" -eq 3 ]; [ -f "$2" ]; RESUME_LOG="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"; RESUME_START="$3";;
 *) echo "Usage: sh tools/deploy-delivery-threshold-rollout.sh --deploy | --resume-verified SUCCESS_LOG UTC_START"; exit 2;;
esac
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/penguin-threshold-rollout.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT HUP INT TERM
mkdir "$STAGE/functions"
for module in subscription-pricing subscription-pricing-core delivery-threshold-schedule billing-anniversary managed-email-callable revenue-share revenue-share-policy finance-manual-review-policy finance-slip-claims slip-verification delivery-slip merchant-slip-quota delivery-slip-policy hybrid-billing-orders hybrid-billing-core public-signup; do
 cp "$ROOT/functions/$module.js" "$STAGE/functions/"
done
node - "$ROOT" "$STAGE" <<'JS'
const fs=require("fs"),path=require("path");
const [root,stage]=process.argv.slice(2);
const dependencies={};
for(const n of ["firebase-admin","firebase-functions"])dependencies[n]=require(path.join(root,"functions","node_modules",n,"package.json")).version;
fs.writeFileSync(path.join(stage,"functions","package.json"),JSON.stringify({name:"penguin-threshold-rollout",private:true,main:"index.js",engines:{node:"22"},dependencies},null,2));
fs.writeFileSync(path.join(stage,"firebase.json"),JSON.stringify({functions:{source:"functions",codebase:"default",disallowLegacyRuntimeConfig:true,ignore:["node_modules","**/.*"]}},null,2));
JS
ln -s "$ROOT/functions/node_modules" "$STAGE/functions/node_modules"
cd "$STAGE"
cat > functions/index.js <<'JS'
const {initializeApp}=require("firebase-admin/app");
initializeApp();
const pricing=require("./subscription-pricing");
const revenue=require("./revenue-share");
const delivery=require("./delivery-slip");
const signup=require("./public-signup");
exports.getPublicSubscriptionPricing=pricing.getPublicSubscriptionPricing;
exports.getSubscriptionPricing=pricing.getSubscriptionPricing;
exports.updateSubscriptionPricing=pricing.updateSubscriptionPricing;
exports.getTenantRevenueShareAccess=revenue.getTenantRevenueShareAccess;
exports.getTenantRevenueShareSummary=revenue.getTenantRevenueShareSummary;
exports.getPlatformRevenueShareSummary=revenue.getPlatformRevenueShareSummary;
exports.submitTenantRevenueSharePayment=revenue.submitTenantRevenueSharePayment;
exports.reviewRevenueSharePayment=revenue.reviewRevenueSharePayment;
exports.unlockTenantRevenueShare=revenue.unlockTenantRevenueShare;
exports.reconcileRevenueShare=revenue.reconcileRevenueShare;
exports.syncRevenueShareTenants=revenue.syncRevenueShareTenants;
exports.verifyDeliveryPaymentSlip=delivery.verifyDeliveryPaymentSlip;
exports.requestTrialTenantSignup=signup.requestTrialTenantSignup;
exports.activateTrialTenantSignup=signup.activateTrialTenantSignup;
JS
ONLY=$(node - <<'JS'
const f=require("./functions"),names=Object.keys(f);
if(names.length!==14)process.exit(1);
for(const n of names){
 const secrets=(f[n].__endpoint.secretEnvironmentVariables||[]).map(v=>v.key);
 if(n==="submitTenantRevenueSharePayment"){if(JSON.stringify(secrets)!=='["GOOGLE_VISION_API_KEY"]')process.exit(1)}
 else if(secrets.length)process.exit(1);
}
const scheduler=f.syncRevenueShareTenants.__endpoint.scheduleTrigger;
if(scheduler.schedule!=="every day 00:20"||scheduler.timeZone!=="Asia/Bangkok")process.exit(1);
console.log(names.map(n=>"functions:"+n).join(","));
JS
)
echo "Consumer manifest: $ONLY"
if [ -n "${RESUME_LOG:-}" ]; then
 START="$RESUME_START"
 python3 - "$RESUME_LOG" "$ONLY" <<'PYVERIFY'
import sys
s=open(sys.argv[1]).read()
assert "Deploy complete!" in s
for v in sys.argv[2].split(","):
 n=v.split(":")[1]
 assert "functions["+n+"(asia-southeast1)] Successful update operation." in s,n
print("Prior completed consumer deployment log verified")
PYVERIFY
else
 START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
 echo "Consumer deployment started UTC: $START"
 firebase deploy --config "$STAGE/firebase.json" --project chat-45754 --only "$ONLY" --non-interactive
fi
# Verify the live consumers before the publication flag can be enabled.
export CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.13
gcloud functions list --project chat-45754 --regions=asia-southeast1 --format=json --quiet > "$STAGE/live.json"
python3 - "$STAGE/live.json" "$ONLY" "$START" <<'PY'
import json,sys,datetime
rows={r['name'].split('/')[-1]:r for r in json.load(open(sys.argv[1]))}
names=[v.split(':')[1] for v in sys.argv[2].split(',')]
start=datetime.datetime.fromisoformat(sys.argv[3].replace('Z','+00:00'))
for n in names:
 r=rows[n]
 assert r['state']=='ACTIVE', n
 assert datetime.datetime.fromisoformat(r['updateTime'][:19]+'+00:00')>=start,n
 print('VERIFIED_CONSUMER',n)
PY
gcloud scheduler jobs describe firebase-schedule-syncRevenueShareTenants-asia-southeast1 --location asia-southeast1 --project chat-45754 --format=json --quiet > "$STAGE/scheduler.json"
python3 - "$STAGE/scheduler.json" <<'PY'
import sys,json
x=json.load(open(sys.argv[1]))
assert x["state"]=="ENABLED" and x["schedule"]=="every day 00:20" and x["timeZone"]=="Asia/Bangkok"
print("EXISTING_SCHEDULE_UNCHANGED")
PY
# Publication gate is enabled only after successful consumer deployment and verification.
cat > functions/index.js <<'JS'
const {initializeApp}=require("firebase-admin/app");
initializeApp();
const pricing=require("./subscription-pricing");
exports.getDeliveryThresholdVersions=pricing.getDeliveryThresholdVersions;
exports.appendDeliveryThresholdVersion=pricing.appendDeliveryThresholdVersion;
JS
printf 'PENGUIN_DELIVERY_THRESHOLD_SCHEDULE_ENABLED=true\n' > functions/.env.chat-45754
node -e 'const f=require("./functions");if(Object.keys(f).length!==2||Object.values(f).some(v=>(v.__endpoint.secretEnvironmentVariables||[]).length))process.exit(1)'
firebase deploy --config "$STAGE/firebase.json" --project chat-45754 --only functions:getDeliveryThresholdVersions,functions:appendDeliveryThresholdVersion --non-interactive
gcloud functions list --project chat-45754 --regions=asia-southeast1 --format=json --quiet > "$STAGE/live.json"
python3 - "$STAGE/live.json" <<'PY'
import json,sys
rows={r['name'].split('/')[-1]:r for r in json.load(open(sys.argv[1]))}
for name in ("getDeliveryThresholdVersions","appendDeliveryThresholdVersion"):
 r=rows[name]
 assert r['state']=='ACTIVE'
 assert r['serviceConfig']['environmentVariables']['PENGUIN_DELIVERY_THRESHOLD_SCHEDULE_ENABLED']=='true'
 print('VERIFIED_PUBLICATION_GATE',name)
PY
