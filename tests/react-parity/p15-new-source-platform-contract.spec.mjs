import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const page=read("react-app/src/pages/PlatformPage.jsx");
const pricing=read("react-app/src/pages/PlatformPricingPage.jsx");
const contact=read("react-app/src/pages/PlatformContactPage.jsx");
const methods=read("react-app/src/components/PlatformCollectionPreferences.jsx");
const receiver=read("react-app/src/data/platformReceiptReceiver.js");
const fn=read("functions/platform-receiver.js");
const index=read("functions/index.js");

test("new LUKKAJA Source Pricing hides only retired Slip2Go quota input and preserves stored quota",()=>{
 assert.doesNotMatch(pricing,/id="pricingMonthlySlipQuota"/);
 assert.match(pricing,/monthlySlipQuota: current.monthlySlipQuota/);
 assert.match(pricing,/<PlatformCollectionPreferences\s*\/>/);
 assert.match(pricing,/id="pricingDeliveryThreshold"[\s\S]{0,180}readOnly/);
 assert.match(pricing,/thresholdScheduleUnconfirmed/);
});
test("Source bank/Stripe collection is rendered but NEVER enables financial settlement without a verified Firebase provider",()=>{
 assert.match(methods,/value:"bank_transfer"/);
 assert.match(methods,/value:"stripe"/);
 assert.match(methods,/data-collection-readonly="true"/);
 assert.match(methods,/disabled aria-disabled="true"/);
 assert.match(methods,/paymentRoutingEnabled:false/);
 assert.doesNotMatch(methods,/updatePlatformPaymentCollection|setPaymentAsPaid|markInvoicePaid/);
 assert.match(methods,/platformReceiverSettings/);
 assert.match(methods,/platformStripeSettings/);
});
test("Platform receiver Source JSX has account, PromptPay and anchor; legacy Slip2Go panel is NOT exposed",()=>{
 for(const id of ["platformReceiverSettings","platformReceiptRecipientForm",
   "platformReceiptReceiverAccountType","platformReceiptReceiverAccountNumber",
   "platformReceiptReceiverNameTH","platformReceiptReceiverNameEN",
   "platformReceiptPromptPayType","savePlatformReceiptRecipientButton"]){
  assert.match(page,new RegExp(id));
 }
 assert.match(page,/<DynamicField/);
 assert.match(page,/dynamicLabel="ธนาคารผู้รับเงิน"/);
 assert.match(page,/receiverUnconfirmed/);
 assert.match(page,/await sweetConfirm/);
 assert.doesNotMatch(page,/id="platformSlipVerificationForm"/);
 assert.doesNotMatch(page,/id="platformSlip2GoSecret"/);
 assert.doesNotMatch(page,/savePlatformSlipVerification\(/);
});
test("dedicated Firebase receiver writes require Superadmin, fixed private document, revision CAS and independent canonical readback",()=>{
 assert.match(index,/exports.getPlatformReceiptReceiver = platformReceiver.getPlatformReceiptReceiver/);
 assert.match(index,/exports.updatePlatformReceiptReceiver = platformReceiver.updatePlatformReceiptReceiver/);
 assert.match(fn,/role!=="super_admin"/);
 assert.match(fn,/const DOC="receiptReceiver"/);
 assert.match(fn,/doc\("slipVerification"\)\.get\(\)/);
 assert.match(fn,/db\.runTransaction/);
 assert.match(fn,/current!==expectedRevision/);
 assert.match(fn,/RECEIVER_REVISION_CONFLICT/);
 assert.match(fn,/RECEIVER_SAVE_UNCONFIRMED/);
 assert.match(fn,/paymentRoutingEnabled:false/);
 assert.doesNotMatch(fn,/invoice\.set\(|markPaid|paymentStatus:"paid"/);
 assert.match(receiver,/RECEIVER_SAVE_UNCONFIRMED/);
 assert.match(receiver,/await loadPlatformReceiptReceiver\(\)/);
});
test("Source LK Shop wording changed without removing protected Firebase pairing",()=>{
 assert.match(contact,/เชื่อมต่ออุปกรณ์กับห้องแจ้งเตือนส่วนกลางของ Superadmin/);
 assert.match(contact,/LKShopPairingPanel scope="platform"/);
});
