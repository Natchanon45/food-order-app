import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
test("P3.4 refreshed Source 7e47e85f retains the pinned 65-page denominator and 15 accepted",()=>{
 const generator=file("tools/update-port-master-checklist.mjs");
 const snapshot=file("docs/LUKKAJA_JSX_SOURCE_REBASELINE_20261125.md");
 assert.match(generator,/7e47e85f9012e4b084b68d816b32b6e60b15f3d2/);
 assert.match(snapshot,/65 pages, 36,006 lines/);
 assert.match(snapshot,/15 of 65 accepted\/dispositioned/);
 assert.match(generator,/if\(sourcePages.length!==65\|\|originalTarget.length!==53\)/);
});
test("P3.4 Thai PNG Source artwork uses local PENGUIN QR payload and byte-matched branding assets",()=>{
 const component=file("react-app/src/components/ThaiPaymentQR.jsx");
 const style=file("react-app/src/ui/thai-payment-qr.css");
 for(const fragment of [
   'import {qrSvg} from "@/utils/localQr"',
   "const W=440,H=466,SCALE=3;",
   "qrSvg(payload,{size:900,margin:4})",
   '/assets/images/payment-branding/',
   '/assets/fonts/Kanit-SemiBold.ttf',
   'return canvas.toDataURL("image/png")',
   "data-thai-payment-card-image",
 ]) assert.ok(component.includes(fragment),fragment);
 assert.match(style,/image-rendering:auto!important/);
 assert.doesNotMatch(component,/https?:\/\/|fetch\(|qrcode\.react|quickchart\.io/i);
});
test("P3.4 observed payment uses non-scannable progress, never a blurred active QR",()=>{
 const component=file("react-app/src/components/ThaiPaymentQR.jsx");
 const companion=file("react-app/src/components/CompanionConfirmedQr.jsx");
 assert.match(component,/props\.processing\?<ThaiPaymentProgress/);
 assert.match(component,/sessionStorage\.setItem\(key,"1"\)/);
 assert.match(component,/penguin:thai-qr-observed:v1:/);
 assert.match(component,/lk-thai-payment-guard-backdrop/);
 assert.match(companion,/observedUnverified=order\?\.companionKitchenRelease\?\.status==="admitted_unverified"/);
 assert.match(companion,/server\?\.reason==="kitchen_admitted"/);
 assert.match(companion,/!observedUnverified&&seconds>0/);
 assert.match(companion,/observedUnverified&&<ThaiPaymentProgress/);
 assert.match(companion,/server\?\.active===true/);
});
test("P3.4 Delivery locks exact receiver and total against live admin settings changes",()=>{
 const checkout=file("react-app/src/pages/DeliveryPage.jsx");
 for(const fragment of [
  "const paymentAmount = paymentLocked ? Number(lockedTotal?.total) : total;",
  "recipientId: String(settings.promptPayId",
  "recipientName: String(settings.promptPayName",
  "String(lockedTotal?.recipientId || \"\") !==",
  "<ThaiPaymentQR payload={promptPayQr.payload}",
  'imageId="promptPayQr"',
  "const codEnabled = false",
 ]) assert.ok(checkout.includes(fragment),fragment);
});
test("P3.4 payment status still belongs to trusted Firebase QR state, not raw bank notification",()=>{
 const companion=file("react-app/src/components/CompanionConfirmedQr.jsx");
 const server=file("functions/payment-companion-qr-policy.js");
 assert.match(companion,/getPublicCompanionQrState/);
 assert.match(companion,/server\?\.active===true/);
 assert.match(companion,/ยังไม่ใช่ธนาคารยืนยันชำระ/);
 assert.match(server,/reason:"kitchen_admitted"/);
 assert.match(server,/paymentStatus!=="pending_verification"/);
 assert.doesNotMatch(companion,/paymentStatus="paid"|paymentStatus:\s*"paid"/);
});
