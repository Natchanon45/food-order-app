import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require=createRequire(import.meta.url);
const {verifyPromptPayBankProof,recordHybridVerifiedPromptPay}=require("../../functions/hybrid-billing-promptpay-payment.js");
const now=new Date("2026-10-20T10:00:00Z");
const valid=()=>({verified:true,source:"independent_bank_record",
 tenantId:"tenant-promptpay-test-001",orderId:"order-promptpay-test-001",
 currency:"THB",recipientConfirmed:true,platformBankAccountVerified:true,
 reference:"BANK-TEST-PROMPTPAY-12345",evidenceSha256:"a".repeat(64),
 grossAmountCents:10500,paidAt:new Date("2026-10-20T02:00:00Z"),
 checkedAt:new Date("2026-10-20T09:59:00Z")});
test("server-only promptpay attestation requires independent exact fresh evidence",()=>{
 const c={tenantId:valid().tenantId,orderId:valid().orderId,now};
 assert.match(verifyPromptPayBankProof(valid(),c).referenceHash,/^[a-f0-9]{64}$/);
 for(const p of [
  {...valid(),verified:false},{...valid(),source:"user_slip"},
  {...valid(),tenantId:"tenant-another-001"},{...valid(),orderId:"other-order"},
  {...valid(),currency:"USD"},{...valid(),recipientConfirmed:false},
  {...valid(),platformBankAccountVerified:false},{...valid(),evidenceSha256:"bad"},
  {...valid(),grossAmountCents:10499.1},{...valid(),paidAt:"2026-10-20"},
  {...valid(),checkedAt:new Date("2026-10-20T09:30:00Z")},
  {...valid(),paidAt:new Date("2026-10-21T02:00:00Z")},
 ])assert.throws(()=>verifyPromptPayBankProof(p,c),/BANK_PROOF_REQUIRED/);
});
test("bank candidate fails closed with no independent adapter",async()=>{
 await assert.rejects(recordHybridVerifiedPromptPay({db:{},
   tenantId:"tenant-promptpay-test-001",orderId:"order-promptpay-test-001",
   reviewerUid:"super-promptpay-test-01",now}),/BANK_ADAPTER_NOT_CONNECTED/);
});
test("bank candidate is unexported and never makes an unreviewed bank refund",()=>{
 const index=readFileSync("functions/index.js","utf8");
 const source=readFileSync("functions/hybrid-billing-promptpay-payment.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-promptpay-payment|recordHybridVerifiedPromptPay/);
 assert.match(source,/HYBRID_PROMPTPAY_SUPER_ADMIN_REQUIRED/);
 assert.doesNotMatch(source,/hybridBillingSettlements.*tx\.create|refundInitiated:\s*true/);
});
