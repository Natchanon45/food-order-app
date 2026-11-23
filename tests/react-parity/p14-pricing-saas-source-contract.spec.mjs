import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const saasPage=source("react-app/src/pages/SaasSetupPage.jsx");
const saasData=source("react-app/src/data/saasMigrationService.js");
const saasServer=source("functions/saas-migration.js");
const pricingPage=source("react-app/src/pages/PlatformPricingPage.jsx");
const pricingData=source("react-app/src/data/subscriptionPricing.js");
const pricingServer=source("functions/subscription-pricing.js");
const history=source("functions/delivery-threshold-schedule.js");

test("P1.4 SaaS UI strictly mirrors Source inspection-only: nullable target summary and disabled migration controls",()=>{
 for(const id of ["migrationState","migrationSummary","menuCount","tableCount",
  "orderCount","settingCount","refreshMigration","startMigration","saasInspectionNotice"]){
  assert.ok(saasPage.includes('id="'+id+'"'),"Missing Source SaaS control "+id);
 }
 assert.match(saasPage,/id="startMigration"[\s\S]{0,150}disabled aria-disabled="true"/);
 assert.doesNotMatch(saasPage,/onClick=\{startMigration\}/);
 assert.doesNotMatch(saasPage,/migrateLegacyStore/);
 assert.doesNotMatch(saasPage,/id="overwriteData"/);
 assert.match(saasPage,/Number\.isInteger\(summary\?\.menus\)/);
 assert.match(saasPage,/typeof summary\?\.settings === "boolean"/);
 assert.match(saasPage,/data-saas-auth-error/);
 assert.match(saasPage,/profile\.role !== "super_admin"/);
 assert.match(saasPage,/source_unavailable/);
});
test("P1.4 SaaS Firebase client never sends a destructive migration action",()=>{
 assert.match(saasData,/httpsCallable\(functions, "inspectLegacySaasMigration"\)/);
 assert.doesNotMatch(saasData,/migrateLegacySaasStore|migrateCallable|onProgress/);
 assert.match(saasData,/sourceInspectable !== false/);
 assert.match(saasData,/migrationEnabled !== false/);
 assert.match(saasData,/summary\.target\?\.id !== SAAS_TARGET_TENANT\.id/);
 assert.match(saasData,/SAAS_INSPECTION_TARGET_MISSING_COUNTS_INVALID/);
});
test("P1.4 SaaS server never copies Source data, mints Tenant/owner or edits financial fields",()=>{
 assert.match(saasServer,/SAAS_SOURCE_MIGRATION_DISABLED_INSPECTION_ONLY/);
 assert.match(saasServer,/failed-precondition/);
 assert.match(saasServer,/firebase_target_only/);
 assert.match(saasServer,/sourceInspectable: false/);
 assert.match(saasServer,/migrationEnabled: false/);
 assert.match(saasServer,/getFirestore\(\)/);
 assert.doesNotMatch(saasServer,/FieldValue|\btx\.|\.set\(|\.update\(|\.create\(|\.delete\(/);
 assert.doesNotMatch(saasServer,/collection\("shops"\)/);
 assert.match(saasServer,/profile\.active !== true/);
});
test("P1.4 Premium pricing preserves Source control IDs and locked Delivery history",()=>{
 for(const id of ["pricingForm","pricingMonthlyPrice","pricingMonthlySlipQuota",
  "pricingDeliveryThreshold","pricingDeliveryShareRate","pricingAnnualMonths",
  "pricingDiscountType","pricingDiscountValue","pricingVatMode","pricingVatRate",
  "pricingReset","pricingSave","previewMonthly","previewRegular",
  "previewDiscounted","previewVatLabel","previewPayable",
  "platformThresholdSchedule","deliveryThresholdBaselineAmount",
  "deliveryThresholdEffectiveOn","deliveryThresholdScheduledAmount",
  "saveScheduledDeliveryThreshold"]){
  assert.ok(pricingPage.includes('id="'+id+'"'),"Missing Source pricing control "+id);
 }
 assert.match(pricingPage,/id="pricingDeliveryThreshold"[\s\S]{0,180}readOnly/);
 assert.match(pricingPage,/id="deliveryThresholdBaselineAmount"[\s\S]{0,200}readOnly/);
 assert.match(pricingPage,/thresholdScheduleUnconfirmed/);
 assert.match(pricingPage,/saveUnconfirmed/);
 assert.match(pricingPage,/setSaveUnconfirmed\(true\)/);
 assert.match(pricingData,/SUBSCRIPTION_PRICING_WRITE_UNCONFIRMED/);
 assert.match(pricingData,/invalid-argument", "unauthenticated", "permission-denied"/);
 assert.match(pricingData,/response = await httpsCallable\(functions, "updateSubscriptionPricing"\)/);
 assert.match(pricingPage,/profile\.role !== "super_admin"/);
 assert.match(pricingPage,/readOnly aria-readonly="true"/);
});
test("P1.4 Premium server serializes threshold/version writes and validates original economic inputs",()=>{
 assert.match(pricingServer,/db\.runTransaction/);
 assert.match(pricingServer,/DELIVERY_THRESHOLD_BASELINE_LOCKED/);
 assert.match(pricingServer,/readThresholdHistory\(raw\)/);
 assert.match(pricingServer,/appendThresholdVersion\(raw,request\.data\)/);
 assert.match(pricingServer,/function centsExact/);
 assert.match(pricingServer,/Number\.isInteger\(annualMonths\)/);
 assert.match(pricingServer,/config\.vatMode === "none" && vatRate !== 0/);
 assert.match(history,/input\.effectiveOn <= today/);
 assert.match(history,/input\.effectiveOn <= \(history\.at\(-1\)\?\.effectiveOn/);
 assert.match(history,/return \[\.\.\.history,\{effectiveOn:/);
 assert.doesNotMatch(pricingPage,/onChange=.*deliveryThreshold:/);
});
test("SaaS inspection-only status is translated in all five supported locales",()=>{
 const translations=JSON.parse(source("react-app/src/i18n/saas-setup-master-translations.json"));
 for(const locale of ["th","en","my","lo","km"]){
  const data=translations[locale];
  assert.ok(data.hero.title.length>1);
  assert.ok(data.hero.description.length>1);
  for(const key of ["inspection_only","source_unavailable","target_not_found"])
   assert.ok(data.runtime.state[key]?.length>3,locale+" missing "+key);
 }
});
