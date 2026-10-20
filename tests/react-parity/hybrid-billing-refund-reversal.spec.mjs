import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {verifyIndependentRefund,recordHybridVerifiedRefund}
 =require("../../functions/hybrid-billing-refund-reversal.js");
const now=new Date("2026-10-21T03:00:00Z");
const p=()=>({verified:true,source:"independent_bank_refund_record",
 tenantId:"tenant-refund-unit-001",orderId:"order-refund-unit-001",
 currency:"THB",refundSettled:true,recipientConfirmed:true,
 platformDebitConfirmed:true,reference:"BANK-REFUND-UNIT-001",
 evidenceSha256:"a".repeat(64),refundAmountCents:100000,
 refundAt:new Date("2026-10-21T02:30:00Z"),
 checkedAt:new Date("2026-10-21T02:59:00Z")});
test("refund requires independently verified settled bank debit, not a slip",()=>{
 const s=p(),c={tenantId:s.tenantId,orderId:s.orderId,now};
 assert.match(verifyIndependentRefund(s,c).referenceHash,/^[a-f0-9]{64}$/);
 for(const bad of [{...s,refundSettled:false},{...s,verified:false},
 {...s,source:"slip"},{...s,recipientConfirmed:false},
 {...s,platformDebitConfirmed:false},{...s,currency:"USD"},
 {...s,tenantId:"another-tenant"},{...s,orderId:"another-order"},
 {...s,evidenceSha256:"bad"},{...s,refundAmountCents:0},
 {...s,refundAt:"2026-10-20"},{...s,checkedAt:new Date("2026-10-21T02:40:00Z")}])
   assert.throws(()=>verifyIndependentRefund(bad,c),/INDEPENDENT_SETTLEMENT_PROOF_REQUIRED/);
});
test("refund never starts without server-owned independent resolver",async()=>{
 await assert.rejects(recordHybridVerifiedRefund({db:{},
 tenantId:"tenant-refund-unit-001",orderId:"order-refund-unit-001",
 reviewerUid:"super-refund-unit-001",now}),/PROVIDER_NOT_CONNECTED/);
});
test("refund remains unexported and does not initiate bank refund or settlement",()=>{
 const index=readFileSync("functions/index.js","utf8");
 const src=readFileSync("functions/hybrid-billing-refund-reversal.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-refund-reversal/);
 assert.match(src,/refundInitiated:false,invoiceApplied:false/);
 assert.doesNotMatch(src,/hybridBillingInvoices.*tx\.update/);
});
