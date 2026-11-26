import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
test("Android pairing UAT has no registered notification listener, upload job or boot receiver",()=>{
 const base="tools/payment-companion-android/app/src/main/";
 const manifest=read(base+"AndroidManifest.xml");
 assert.doesNotMatch(manifest,/BIND_NOTIFICATION_LISTENER_SERVICE|QUERY_ALL_PACKAGES|RECEIVE_BOOT_COMPLETED|PendingUploadJob|BootRetryReceiver/);
 const client=read(base+"java/com/lukkaja/companion/CompanionClient.java");
 assert.match(client,/NOTIFICATION_INGEST_DISABLED/);
 assert.match(client,/https:\/\/penguin-food\.web\.app/);
 assert.match(client,/else throw new IllegalArgumentException\("PAIRING_ONLY"\)/);
});
test("platform setup allows connectivity testing, not money or notice capabilities",()=>{
 const s=read("functions/platform-connect-pairing.js");
 assert.match(s,/notificationEnabled:false,paymentRoutingEnabled:false,paymentVerified:false/);
 assert.doesNotMatch(s,/collection\("(?:orders|invoices|notices|wallets)"\)/);
 assert.match(s,/role!=="super_admin"/);
 assert.match(s,/rows.length>=3/);
 assert.match(s,/row.expiresMs>now/);
 const ui=read("react-app/src/components/PlatformCompanionPairing.jsx");
 assert.match(ui,/getPlatformConnectPairing/);assert.match(ui,/createPlatformConnectPairing/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage/);
});

test("paired device displays source configuration and a truthful disabled receive toggle",()=>{
 const base="tools/payment-companion-android/app/src/main/java/com/lukkaja/companion/";
 const activity=read(base+"MainActivity.java");
 assert.match(activity,/visible\(sourceCard,paired\)/);
 assert.match(activity,/visible\(consentCard,paired\)/);
 assert.match(activity,/settings\.chooseSource\(mode,bank,custom\)/);
 assert.match(activity,/enableCheckbox\.setEnabled\(false\)/);
 assert.match(activity,/visible\(openAccessButton,false\)/);
 assert.match(read(base+"SecureSettings.java"),/boolean enabled\(\) \{ return false; \}/);
});

test("explicit synthetic test can be displayed without enabling financial notifications",()=>{
 const server=read("functions/platform-connect-pairing.js");
 const app=read("tools/payment-companion-android/app/src/main/java/com/lukkaja/companion/MainActivity.java");
 const ui=read("react-app/src/components/PlatformCompanionPairing.jsx");
 assert.match(server,/exports.platformConnectDeviceTest=onRequest/);
 assert.match(server,/Object.keys\(req.body\).length!==1/);
 assert.match(server,/testReceived:true,duplicate:true/);
 assert.match(app,/ส่งเหตุการณ์ทดสอบไปยังเว็บไซต์/);
 assert.match(ui,/ได้รับเหตุการณ์ทดสอบ \(ไม่ใช่ยอดเงินเข้า\)/);
 assert.match(read("firebase.json"),/platformConnectDeviceTest/);
});

test("shared receiver binding is revision-bound, masked and does not authorize ingest",()=>{
 const source=read("functions/platform-connect-receiver-policy.js");
 assert.match(source,/account\.slice\(-4\)/);
 assert.match(source,/link\?\.revision===current\.revision/);
 assert.match(source,/notificationEnabled:false,paymentVerified:false/);
 const api=read("functions/platform-connect-pairing.js");
 assert.match(api,/data\.version!==current\.version/);
 assert.match(api,/confirmPlatformConnectReceiver=onCall/);
 assert.match(api,/mergeFields:\["receiverBinding"\]/);
});
