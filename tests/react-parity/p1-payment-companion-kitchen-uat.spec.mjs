import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const policy=require("../../functions/payment-companion-kitchen-policy.js");
const receiver=require("../../functions/payment-companion-receiver.js");
const qr=require("../../functions/payment-companion-qr-policy.js");
const storeRecord={bankName:"SCB",bankAccountNumber:"0000001234",bankAccountName:"Synthetic test",promptPayId:"0900005678",deliveryPromptPayEnabled:true};
const store={data:()=>storeRecord,updateTime:{seconds:1763800000,nanoseconds:0}};
const revision=receiver.receiverRevision(store);
const now=Date.now(),created=now-60000;
const link={enabled:true,revision,bankCode:"scb",accountLast4:"1234",confirmedAtMs:created-20000};
const consent={enabled:true,revision,confirmedAtMs:created-10000};
const recipient=receiver.receiverState(store,link,true);
const match={status:"candidate",notificationId:"a".repeat(64),orderId:"order-candidate-test",amountSatang:20000,hasSlip:false};
const notice={id:match.notificationId,source:"line_scb_connect",amountSatang:20000,receiverRevision:revision,receiverSuffix:"X-1234",
 bankMs:created+10000,receivedMs:created+15000};
const order={
 orderType:"delivery",deliveryProvider:"lalamove",paymentMethod:"promptpay",paymentQrMode:"confirmed_order_5m",
 paymentQrSlipFallbackStatus:"not_required",paymentStatus:"pending_verification",status:"pending",paymentSlipPath:"",
 totalAmount:200,createdAt:{toMillis:()=>created},paymentQrStartedAtUTC:new Date(created).toISOString(),
 paymentQrExpiresAtUTC:new Date(created+300000).toISOString(),
 paymentQrReceiverRevision:revision,promptPayQRRecipientId:storeRecord.promptPayId,
};
test("live, demo, emulator and missing signed project never enable unverified kitchen UAT",()=>{
 const values={GCLOUD_PROJECT:"isolated-uat-test",PENGUIN_PAYMENT_COMPANION_UAT_PROJECT_ID:"isolated-uat-test",
   PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID:"tenant-kitchen-uat-001",
   PENGUIN_PAYMENT_COMPANION_QR_ENABLED:"1",PENGUIN_PAYMENT_COMPANION_PILOT_ENABLED:"1",
   PENGUIN_PAYMENT_COMPANION_AUTO_KITCHEN_ENABLED:"1"};
 assert.equal(policy.configuredUatTenant({...values,GCLOUD_PROJECT:"penguin-food",PENGUIN_PAYMENT_COMPANION_UAT_PROJECT_ID:"penguin-food"}),"");
 assert.equal(policy.configuredUatTenant({...values,GCLOUD_PROJECT:"demo-tenant",PENGUIN_PAYMENT_COMPANION_UAT_PROJECT_ID:"demo-tenant"}),"");
 assert.equal(policy.configuredUatTenant({...values,FIRESTORE_EMULATOR_HOST:"127.0.0.1:18080"}),"");
 assert.equal(policy.configuredUatTenant({...values,PENGUIN_PAYMENT_COMPANION_AUTO_KITCHEN_ENABLED:"0"}),"");
 assert.equal(policy.configuredUatTenant({...values,PENGUIN_PAYMENT_COMPANION_UAT_PROJECT_ID:"someone-else"}),"");
 assert.equal(policy.configuredUatTenant(values),values.PENGUIN_PAYMENT_COMPANION_PILOT_TENANT_ID);
});
test("one fully bound UAT candidate can be admitted with no Paid or dispatch evidence",()=>{
 assert.equal(policy.admitEligible({order,match,notice,recipient,link,autoConsent:consent,store,now}),true);
 assert.equal(policy.consentState(link,consent,recipient,true),true);
 for(const [name,patch] of [
  ["no owner consent",{autoConsent:null}],
  ["consent after order",{autoConsent:{...consent,confirmedAtMs:created+1}}],
  ["account changed",{link:{...link,revision:"c".repeat(64)}}],
  ["wrong payee",{order:{...order,promptPayQRRecipientId:"0999999999"}}],
  ["amount mismatch",{order:{...order,totalAmount:200.01}}],
  ["already paid",{order:{...order,paymentStatus:"paid"}}],
  ["has slip",{order:{...order,paymentSlipPath:"tenants/t/payment-slips/o/x.png"}}],
  ["already admitted",{order:{...order,companionKitchenRelease:{status:"admitted_unverified"}}}],
  ["not Lalamove",{order:{...order,deliveryProvider:"self"}}],
  ["not original QR",{order:{...order,paymentQrStartedAtUTC:new Date(created+20000).toISOString()}}],
  ["late bank",{notice:{...notice,bankMs:created+301000}}],
  ["early bank",{notice:{...notice,bankMs:created-1000}}],
  ["late server receipt",{notice:{...notice,receivedMs:created+361000}}],
  ["not normal precision",{match:{...match,status:"time_precision_review"}}],
  ["overdue processing",{now:created+361000}],
 ])assert.equal(policy.admitEligible({order,match,notice,recipient,link,autoConsent:consent,store,now,...patch}),false,name);
});
test("existing paid-only Lalamove dispatch remains closed for UAT kitchen release",()=>{
 const source=readFileSync("functions/lalamove-dispatch.js","utf8");
 const start=source.indexOf("function readyToDispatch(order) {"),end=source.indexOf("async function ",start);
 const relevant=source.slice(start,end);
 assert.match(relevant,/payment === "paid"/);
 assert.match(relevant,/isCod && payment === "unpaid"/);
 assert.doesNotMatch(relevant,/companionKitchenRelease|admitted_unverified/);
 const client=readFileSync("react-app/src/data/deliveryKitchenGate.js","utf8");
 const server=readFileSync("functions/delivery-slip-policy.js","utf8");
 assert.match(client,/canDispatchRider === false/);
 assert.match(server,/canDispatchRider===false/);
 assert.match(readFileSync("firestore.rules","utf8"),/'companionKitchenAdmittedAt'/);
});
