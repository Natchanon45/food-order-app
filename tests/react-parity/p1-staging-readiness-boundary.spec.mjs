import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {readStagingFirebaseConfig} from "../../react-app/src/firebase/stagingConfig.mjs";

const require=createRequire(import.meta.url);
const productionProjectId="chat-45754";
const seed={
 VITE_STAGING_FIREBASE_PROJECT_ID:"penguin-staging-qa",
 VITE_STAGING_FIREBASE_API_KEY:"AIza"+"Z".repeat(34),
 VITE_STAGING_FIREBASE_AUTH_DOMAIN:"penguin-staging-qa.firebaseapp.com",
 VITE_STAGING_FIREBASE_STORAGE_BUCKET:"penguin-staging-qa.firebasestorage.app",
 VITE_STAGING_FIREBASE_MESSAGING_SENDER_ID:"123456789012",
 VITE_STAGING_FIREBASE_APP_ID:"1:123456789012:web:abcdef1234567890",
};
const prod={
 projectId:productionProjectId,
 apiKey:"AIza"+"A".repeat(34),
 authDomain:"penguin-food.web.app",
 storageBucket:"chat-45754.firebasestorage.app",
 appId:"1:1046915702525:web:869e1a0d1407375610e894",
};
test("staging requires a complete independent Firebase Web project config",()=>{
 const config=readStagingFirebaseConfig(seed,prod);
 assert.equal(config.projectId,"penguin-staging-qa");
 assert.equal(config.authDomain,"penguin-staging-qa.firebaseapp.com");
 assert.equal(config.messagingSenderId,"123456789012");
 assert.equal(Object.isFrozen(config),true);
 assert.equal("databaseURL" in config,false,"No production RTDB URL can leak to staging");
});
test("all accidental Production/Demo/mismatched staging values fail closed",()=>{
 const cases=[
  {VITE_STAGING_FIREBASE_PROJECT_ID:""},{VITE_STAGING_FIREBASE_PROJECT_ID:productionProjectId},
  {VITE_STAGING_FIREBASE_PROJECT_ID:"demo-penguin-hybrid"},
  {VITE_STAGING_FIREBASE_PROJECT_ID:"../bad"},
  {VITE_STAGING_FIREBASE_API_KEY:prod.apiKey},
  {VITE_STAGING_FIREBASE_AUTH_DOMAIN:prod.authDomain},
  {VITE_STAGING_FIREBASE_STORAGE_BUCKET:prod.storageBucket},
  {VITE_STAGING_FIREBASE_APP_ID:prod.appId},
  {VITE_STAGING_FIREBASE_MESSAGING_SENDER_ID:"123456789099"},
  {VITE_STAGING_FIREBASE_STORAGE_BUCKET:"penguin-food.appspot.com"},
  {VITE_USE_FIREBASE_EMULATORS:"true"},
  {VITE_HYBRID_DEMO_PAYMENT_E2E:"true"},
 ];
 for(const override of cases){
  assert.throws(()=>readStagingFirebaseConfig({...seed,...override},prod),
   /STAGING_FIREBASE_/,
   "Unexpected staging configuration accepted: "+JSON.stringify(Object.keys(override)));
 }
});
test("client only allows Emulator port override for the double-opted-in demo",()=>{
 const client=readFileSync(new URL("../../react-app/src/firebase/client.js",import.meta.url),"utf8");
 assert.match(client,/VITE_HYBRID_DEMO_PAYMENT_E2E === "true"/);
 assert.match(client,/VITE_USE_FIREBASE_EMULATORS === "true"/);
 assert.match(client,/deploymentStage === "staging"/);
 assert.match(client,/readStagingFirebaseConfig\(import.meta.env, productionFirebaseConfig\)/);
 assert.match(client,/isHybridDemoMode\s*\? Number\(import.meta.env.VITE_DEMO_FIRESTORE_EMULATOR_PORT/);
 assert.match(client,/app.options.projectId !== firebaseConfig.projectId/);
 assert.match(client,/FIREBASE_DEFAULT_APP_PROJECT_MISMATCH/);
});
test("offline preflight refuses current production-default-only .firebaserc, never contacts provider or sends emails",()=>{
 const cleanEnv={...process.env};
 for(const name of Object.keys(cleanEnv))
  if(/^VITE_STAGING_|^VITE_FIREBASE_STAGE$|^VITE_USE_FIREBASE_EMULATORS$|^VITE_HYBRID_DEMO_PAYMENT_E2E$|^PENGUIN_STAGING_/.test(name))
   delete cleanEnv[name];
 const script=new URL("../../tools/p13-staging-offline-preflight.mjs",import.meta.url);
 const run=spawnSync(process.execPath,[script.pathname],{
  env:cleanEnv,encoding:"utf8",timeout:5000,
 });
 assert.equal(run.status,2,run.stderr);
 const output=JSON.parse(run.stdout);
 assert.equal(output.audit,"P1.3_STAGING_OFFLINE_PREFLIGHT");
 assert.equal(output.status,"blocked");
 assert.equal(output.hasProductionDefault,true);
 assert.equal(output.hasDedicatedStagingAlias,false);
 assert.equal(output.hasValidatedStagingWebConfig,false);
 assert.ok(output.blockers.includes("DEDICATED_STAGING_FIREBASE_ALIAS_MISSING"));
 assert.equal(output.externalServicesContacted,false);
 assert.equal(output.emailSent,false);
 assert.equal(output.deployApproved,false);
 assert.equal(run.stderr,"");
});
test("Source Contact structure remains while collapsed Telegram and LK Shop do not invoke providers",()=>{
 const view=readFileSync(new URL("../../react-app/src/pages/PlatformContactPage.jsx",import.meta.url),"utf8");
 assert.match(view,/expandedCards\.telegram && \(\s*<TelegramSettingsPanel/);
 assert.match(view,/expandedCards\.lkShop && <LKShopPairingPanel scope="platform"/);
 assert.match(view,/hidden=\{!expandedCards\.telegram\}/);
 assert.match(view,/hidden=\{!expandedCards\.lkShop\}/);
});

test("local Browser runner refuses a staging context before starting emulators",()=>{
 const runner=new URL("../../tools/p13-run-local-browser-uat.mjs",import.meta.url);
 const run=spawnSync(process.execPath,[runner.pathname],{
  env:{...process.env,VITE_FIREBASE_STAGE:"staging"},
  encoding:"utf8",timeout:5000,
 });
 assert.equal(run.status,3,run.stderr);
 assert.match(run.stderr,/P13F_REFUSES_STAGING_PRODUCTION_OR_EXISTING_TEMP_CONFIG/);
 const source=readFileSync(runner,"utf8");
 assert.match(source,/--project/);
 assert.match(source,/demo-penguin-hybrid/);
 assert.match(source,/--only/);
 assert.match(source,/Trying to access secret/);
 assert.match(source,/unlinkSync\(temp\)/);
});
