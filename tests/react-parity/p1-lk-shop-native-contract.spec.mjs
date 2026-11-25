import test from "node:test";
import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
const require=createRequire(import.meta.url);
const fs=async name=>readFile(name,"utf8");
test("native PG Notify is a distinct Target app with unique package and version, not old LUKKAJA",async()=>{
 const pub=await fs("apps/lk-shop/pubspec.yaml");
 const gradle=await fs("apps/lk-shop/android/app/build.gradle.kts");
 const xcode=await fs("apps/lk-shop/ios/Runner.xcodeproj/project.pbxproj");
 const manifest=await fs("apps/lk-shop/android/app/src/main/AndroidManifest.xml");
 assert.match(pub,/version: 1\.0\.0\+2/);
 assert.match(gradle,/applicationId = "com\.natchanon45\.penguin\.lkshop"/);
 assert.match(gradle,/namespace = "com\.natchanon45\.penguin\.lkshop"/);
 assert.match(xcode,/PRODUCT_BUNDLE_IDENTIFIER = com\.natchanon45\.penguin\.lkShop;/);
 assert.match(manifest,/android:label="PG Notify"/);
 assert.doesNotMatch(gradle,/applicationId = "com\.lukkaja/);
});
test("native pairing and navigation never accept old Source or caller-controlled origins",async()=>{
 const qr=await fs("apps/lk-shop/lib/src/pairing.dart");
 const runtime=await fs("apps/lk-shop/lib/src/lk_runtime.dart");
 const api=await fs("apps/lk-shop/lib/src/lk_api.dart");
 const main=await fs("apps/lk-shop/lib/main.dart");
 assert.match(qr,/penguin-food\.web\.app/);
 assert.doesNotMatch(qr,/www\.lukkaja\.com/);
 assert.match(runtime,/static const origin = 'https:\/\/penguin-food\.web\.app'/);
 assert.match(runtime,/role\).*\{/s);
 assert.match(api,/penguin_lk_shop_pair_v1/);
 assert.match(api,/request\.followRedirects = false/);
 assert.match(api,/LKRuntime\.origin/);
 assert.match(main,/LKRuntime\.allowedTarget/);
 assert.match(main,/getInitialMessage/);
 assert.match(main,/FirebaseMessaging\.onMessageOpenedApp/);
 assert.match(main,/updatePushToken/);
});
test("FCM setup stays disabled until registered native Firebase config is supplied; no Source native config shipped",async()=>{
 const runtime=await fs("apps/lk-shop/lib/src/lk_runtime.dart");
 const entry=await fs("apps/lk-shop/lib/main.dart");
 const cfg=await fs("apps/lk-shop/firebase-app-defines.example.json");
 const ignore=await fs(".gitignore");
 assert.match(runtime,/LK_FIREBASE_APP_ID/);
 assert.match(runtime,/LK_FIREBASE_PROJECT_ID/);
 assert.match(entry,/if \(!LKRuntime\.nativeFirebaseConfigured\)/);
 assert.match(entry,/Firebase\.initializeApp\(\s*options:/);
 assert.match(ignore,/apps\/lk-shop\/android\/app\/google-services\.json/);
 assert.match(ignore,/apps\/lk-shop\/ios\/Runner\/GoogleService-Info\.plist/);
 assert.match(ignore,/apps\/lk-shop\/firebase-app-defines\.json/);
 assert.equal(JSON.parse(cfg).LK_FIREBASE_APP_ID,"");
 await assert.rejects(access("apps/lk-shop/android/app/google-services.json"));
 await assert.rejects(access("apps/lk-shop/ios/Runner/GoogleService-Info.plist"));
});
test("monotonic notification cursor is allocated in one Firestore transaction",async()=>{
 const notify=await fs("functions/lk-shop-notifications.js");
 const rest=await fs("functions/lk-shop-device-gateway.js");
 assert.match(notify,/async function createNotice/);
 assert.match(notify,/tx\.get\(deviceRef\)/);
 assert.match(notify,/lastNoticeSequence:sequence/);
 assert.match(notify,/tx\.create\(ref,/);
 assert.match(rest,/orderBy\("sequence","desc"\)/);
 assert.match(rest,/id:n\.sequence/);
 assert.match(notify,/data:\{eventId:String\(notice\.sequence\)\}/);
});
test("native Source remains read-only and both platform bundle IDs avoid source package conflict",async t=>{
 try{await access("../lukkhaja_bankalert_stripe/.git");}
 catch{t.skip("Source checkout not available in this CI checkout");return;}
 const source=execFileSync("git",["-C","../lukkhaja_bankalert_stripe",
  "status","--porcelain"],{encoding:"utf8"});
 assert.equal(source.trim(),"");
 const ignored=execFileSync("git",["check-ignore",
   "apps/lk-shop/android/app/google-services.json",
   "apps/lk-shop/firebase-app-defines.json"],{encoding:"utf8"});
 assert.match(ignored,/google-services\.json/);
 assert.match(ignored,/firebase-app-defines\.json/);
});
