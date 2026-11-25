import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mayNavigateToCanonicalPage} from "../../react-app/src/auth/merchantLoginRouting.mjs";
const read=file=>readFileSync(new URL("../../"+file,import.meta.url),"utf8");
test("P2.3 Source web role matrix enforces Owner-only Users, bank/finance/platform and business separation",()=>{
 const delivery=new Set(["order_delivery"]),retail=new Set(["retail_pos"]),none=new Set();
 for(const [role,path,units,allowed] of [
  ["owner","/admin/users",delivery,true],
  ["admin","/admin/users",delivery,false],
  ["cashier","/admin",delivery,false],
  ["kitchen","/cashier",delivery,false],
  ["owner","/pos",none,false],
  ["owner","/pos",retail,true],
  ["owner","/cashier",retail,false],
  ["cashier","/cashier",delivery,true],
  ["super_admin","/platform",none,true],
  ["owner","/platform/pricing",delivery,false],
  ["super_admin","/admin",delivery,false],
  ["owner","/admin/billing-unknown",delivery,false],
  ["owner","/admin/tenants",delivery,false],
  ["owner","/pos/backup",retail,true],
  ["cashier","/pos/backup",retail,false],
 ]){
  assert.equal(mayNavigateToCanonicalPage(role,path,units),allowed,
   role+" -> "+path);
 }
});
test("P2.3 Login rejects unknown next paths and explicit businessUnits:[] means deny-all",()=>{
 const page=read("react-app/src/pages/LoginPage.jsx");
 const source=read("react-app/src/auth/merchantLoginRouting.mjs");
 assert.match(page,/AVAILABLE_AUTH_NEXT_ROUTES/);
 assert.match(page,/mayNavigateToCanonicalPage\(profile\.role,pathname,businessUnits\(profile\)\)/);
 assert.match(page,/if \(!units\.size\) return "\/"/);
 assert.match(page,/if \(Array\.isArray\(profile\.businessUnits\)\)/);
 assert.match(page,/pathname!=="\/pos\/forbidden"/);
 assert.match(page,/path\.startsWith\("\/\/"\)/);
 assert.match(source,/CANONICAL_WEB_ROLES/);
});
test("P2.3 Firebase signup reserves the Store atomically, never sends verify email before approved request",()=>{
 const page=read("react-app/src/pages/RegisterPage.jsx");
 const backend=read("functions/public-signup.js");
 const auth=read("react-app/src/auth/authFlow.js");
 assert.ok(page.indexOf("await requestSignup(payload)")<
  page.indexOf('await sendSignupVerification(credential.user, "/register?verify=1")'));
 assert.match(page,/pricing\?\.source !== "remote"/);
 assert.match(page,/MerchantServiceTerms locale=\{intlLocale\}/);
 assert.doesNotMatch(page,/name="billingMode"|name="restaurantRevenueShareScope"/);
 assert.match(backend,/const oldRef = oldSlug/);
 assert.match(backend,/if \(mayReleaseOld\) tx\.delete\(oldRef\)/);
 assert.match(backend,/previous\?\.status === "active"/);
 assert.match(backend,/currentPending\.status !== "email_verification_required"/);
 assert.match(backend,/pendingSlugSnap\.data\(\)\?\.status !== "pending"/);
 assert.match(backend,/normalizeEmail\(authUser\.email\) !== normalizeEmail\(pending\.email\)/);
 assert.match(auth,/await getIdToken\(user,true\)/);
});
test("P2.3 Native Firebase verification/return URL cannot manufacture a verified account",()=>{
 const page=read("react-app/src/pages/RegisterPage.jsx");
 assert.match(page,/new URLSearchParams\(location\.search\)\.get\("verify"\) !== "1"/);
 assert.match(page,/await reload\(user\)/);
 assert.match(page,/if \(!user\.emailVerified\)/);
 assert.match(page,/const result = await activateSignup\(\)/);
 assert.match(page,/automaticActivationUid\.current === user\.uid/);
 assert.match(page,/id="resumePendingSignup"/);
 assert.match(page,/signInWithEmailAndPassword\(/);
 assert.match(page,/onAuthStateChanged/);
 assert.doesNotMatch(page,/lukkaja_react_signup_id|verified=1|activateLaravelSignup/);
});
test("P2.3 Merchant Service Terms are Source-aligned but avoid legacy Slip2Go and stale price/quota",()=>{
 const source=read("react-app/src/components/MerchantServiceTerms.jsx");
 const page=read("react-app/src/pages/RegisterPage.jsx");
 assert.match(source,/PENGUIN service and billing terms/);
 assert.match(source,/pricing\?\.source === "remote"/);
 assert.match(source,/config\?\.monthlySlipQuota/);
 assert.match(source,/quotaText/);
 assert.doesNotMatch(source,/Slip2Go/);
 assert.match(page,/pricing\?\.source !== "remote"/);
});
