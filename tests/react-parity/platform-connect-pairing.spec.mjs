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
test("platform setup has only connection status and self-unpair, not money or notice capabilities",()=>{
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
