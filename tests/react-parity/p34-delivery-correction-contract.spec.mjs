import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import {
  slipUploadPercent,slipUploadAnimatedPercent,slipUploadDisplayHoldMs,
  isSupportedRetrySlip,
} from "../../react-app/src/utils/slipUploadProgress.mjs";
const require=createRequire(import.meta.url);
const {__test:policy}=require("../../functions/public-delivery-correction.js");
const src=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const cap="a".repeat(64),tenantId="p34-tenant-000001",orderId="p34-order-00000001";
const now=Date.now();
const owned=()=>({
 tenantId,orderType:"delivery",paymentMethod:"promptpay",
 status:"pending",paymentStatus:"pending_verification",totalAmount:150,
 customerCorrectionCapabilityDigest:createHash("sha256").update(cap).digest("hex"),
 createdAtText:new Date(now-1000).toISOString(),paymentCorrectionRevision:0,
});
test("P3.4 signed browser correction ownership requires exact 256-bit secret, tenant, original order and 14-day expiry",()=>{
 assert.equal(policy.owned(owned(),tenantId,cap,now),true);
 assert.equal(policy.owned(owned(),"other-tenant",cap,now),false);
 assert.equal(policy.owned(owned(),tenantId,"b".repeat(64),now),false);
 assert.equal(policy.owned({...owned(),orderType:"takeaway"},tenantId,cap,now),false);
 assert.equal(policy.owned({...owned(),paymentQrMode:"confirmed_order_5m"},tenantId,cap,now),false);
 assert.equal(policy.owned({...owned(),createdAtText:new Date(now-15*86400000).toISOString()},tenantId,cap,now),false);
 assert.throws(()=>policy.parse({tenantId,orderId,capability:"bad"}),/DELIVERY_CORRECTION_REFERENCE_INVALID/);
});
test("P3.4 correction never admits Kitchen/COD and opens only missing or explicitly rejected original slip",()=>{
 const initial=policy.rights(owned());
 assert.equal(initial.canUploadNewSlip,true);
 assert.equal(initial.canRequestCODReview,false);
 assert.equal(initial.canRecheckSlip,false);
 assert.equal(initial.paymentVerified,false);
 for(const row of [
   {paymentStatus:"paid"}, {status:"accepted"},
   {paymentCorrectionRevision:3},{companionKitchenRelease:{status:"admitted_unverified"}},
   {paymentSlipPath:"tenants/p34/slip.png",slipCheckStatus:"manual_review"},
 ]){
   assert.equal(policy.rights({...owned(),...row}).canUploadNewSlip,false,JSON.stringify(row));
 }
 assert.equal(policy.rights({...owned(),paymentSlipPath:"original.png",slipCheckStatus:"rejected"}).canUploadNewSlip,true);
});
test("P3.4 order-bound storage path cannot point to another bill or leave image directory",()=>{
 assert.equal(policy.expectedPath(tenantId,orderId,
  "tenants/"+tenantId+"/payment-slips/"+orderId+"/original.png"),true);
 for(const path of [
  "tenants/"+tenantId+"/payment-slips/other-order/original.png",
  "tenants/"+tenantId+"/payment-slips/"+orderId+"/../other/original.png",
  "tenants/"+tenantId+"/payment-slips/"+orderId+"/file.svg",
  "tenants/"+tenantId+"/payment-slips/"+orderId+"/file.pdf",
 ]){
  assert.equal(policy.expectedPath(tenantId,orderId,path),false,path);
 }
});
test("P3.4 real Storage progress never exceeds observed bytes; visual hold 9 seconds, 100 only after upload",()=>{
 assert.equal(slipUploadPercent({loaded:999,total:1000}),99);
 assert.equal(slipUploadPercent({loaded:1000,total:1000}),99);
 assert.equal(slipUploadAnimatedPercent(80,1000),11);
 assert.equal(slipUploadAnimatedPercent(50,9000),50);
 assert.equal(slipUploadAnimatedPercent(0,9000),0);
 assert.equal(slipUploadDisplayHoldMs(1000,1500),8500);
 assert.equal(slipUploadDisplayHoldMs(1000,11000),0);
 assert.equal(isSupportedRetrySlip({size:100,type:"image/png",name:"slip.png"}),true);
 assert.equal(isSupportedRetrySlip({size:9*1024*1024,type:"image/png",name:"too-big.png"}),false);
});
test("P3.4 checkout automatically stages exactly one slip before verification and keeps original order ID",()=>{
 const checkout=src("react-app/src/pages/DeliveryPage.jsx");
 const data=src("react-app/src/data/publicStorefrontData.js");
 for(const line of [
  "const chooseSlip = async file =>",
  "stagedCheckoutSlipRef.current = { file, orderId, path: staged.path }",
  "slipUploadDisplayHoldMs(start)",
  "slipUploadPhase !== \"finished\"",
  "slip.orderId !== orderId",
  "const slip = paymentMethod",
  "id=\"checkoutSlipUploadProgress\"",
  "aria-valuenow={slipUploadPercentValue}",
 ]) assert.ok(checkout.includes(line),line);
 const uploads=checkout.match(/await uploadPublicPaymentSlip\(/g)||[];
 assert.equal(uploads.length,1,"Checkout must not resend same file on submit");
 assert.match(data,/uploadBytesResumable\(fileRef, file,/);
 assert.match(data,/onUploadProgress\(\{ loaded: snapshot.bytesTransferred, total: snapshot.totalBytes \}\)/);
});
test("P3.4 no public read can recover customer capability, signed correction persists only hash and manual audit",()=>{
 const server=src("functions/public-delivery-submit.js");
 const fn=src("functions/public-delivery-correction.js");
 const ui=src("react-app/src/components/DeliveryPaymentCorrection.jsx");
 assert.match(server,/customerCorrectionCapabilityDigest:capabilityHash/);
 assert.match(server,/paymentCorrectionCapability:capability/);
 assert.doesNotMatch(fn,/paymentStatus:"paid"|paymentStatus:\s*"paid"|kitchenReleased:true/);
 assert.match(fn,/paymentVerified:false,kitchenReleased:false/);
 assert.match(fn,/tx.create\(claim/);
 assert.match(fn,/tx.create\(audit/);
 assert.match(fn,/tx.update\(ref,\{paymentSlipPath:path/);
 assert.match(ui,/getPublicDeliveryCorrectionState/);
 assert.match(ui,/submitPublicDeliveryCorrectionSlip/);
 assert.match(ui,/sessionStorage.getItem\(secretKey/);
 assert.match(ui,/อัปโหลดครบ 100% ไม่ได้หมายความว่าชำระเงินสำเร็จ/);
 assert.match(ui,/data-customer-correction/);
});


test("P3.4 review dialog owns an explicit confirmation without letting the public cart mutate inside review",()=>{
 const checkout=src("react-app/src/pages/DeliveryPage.jsx");
 const review=src("react-app/src/components/DeliveryCheckoutReviewDialog.jsx");
 const cart=src("react-app/src/components/PublicStorefront.jsx");
 assert.match(checkout,/setCheckoutReviewOpen\(true\)/);
 assert.match(checkout,/<DeliveryCheckoutReviewDialog/);
 assert.match(checkout,/setCheckoutReviewOpen\(false\);\s+void submit\(\);/);
 assert.match(review,/readOnly/);
 assert.match(review,/aria-modal="true"/);
 assert.match(review,/id="confirmCheckoutOrder"/);
 assert.match(review,/paymentEnabled&&paymentMethod==="promptpay"/);
 assert.doesNotMatch(review,/"cod"|stripe_connect|Stripe Sandbox/);
 assert.match(cart,/readOnly = false/);
 assert.match(cart,/disabled=\{readOnly\}/);
});
