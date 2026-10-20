import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {SHARDS,shardOf}=require("../../functions/hybrid-billing-receipt-journal.js");
test("journal uses 16 deterministic shards and rejects path traversal",()=>{
 assert.equal(SHARDS,16);
 const ids=Array.from({length:150},(_,n)=>shardOf("order-shard-"+String(n).padStart(4,"0")));
 assert.equal(new Set(ids).size,16);
 assert.equal(shardOf("order-shard-0001"),shardOf("order-shard-0001"));
 assert.throws(()=>shardOf("../../foo"),/HYBRID_JOURNAL_BAD_ORDER/);
});
test("COD journal and strict read fence remain source-only and disabled in production",()=>{
 const index=readFileSync("functions/index.js","utf8");
 const ledger=readFileSync("functions/hybrid-billing-ledger.js","utf8");
 const cod=readFileSync("functions/hybrid-billing-cod-payment.js","utf8");
 assert.doesNotMatch(index,/hybrid-billing-receipt-journal|hybrid-billing-cod-payment/);
 assert.match(ledger,/hybridReceiptJournalCoverageReady !== true/);
 assert.match(cod,/prepareCodReceiptJournal/);
});


test("strict receipt verifier detects financial/time/shard tampering and unjournaled sources",()=>{
 const {journalReceiptIssue,shardOf}=require("../../functions/hybrid-billing-receipt-journal.js");
 const tenant="tenant-journal-unit-048",id="order-journal-unit-048";
 const paid=new Date("2026-10-20T12:00:00Z");
 const stamp={toDate:()=>paid};
 const order={orderType:"delivery",paymentStatus:"paid",status:"delivered",
   paymentReceiptSource:"hybrid_cod_cashier_server",paidAt:stamp,
   totalAmount:105,deliveryFee:5,subtotalAmount:100};
 const journal={tenantId:tenant,orderId:id,source:"hybrid_cod_cashier_server",
   shard:shardOf(id),sourceDay:"2026-10-20",currency:"THB",
   grossCents:10500,merchandiseCents:10000,paidAt:stamp,actorUid:"cashier-journal-unit-048"};
 assert.equal(journalReceiptIssue(id,order,journal,tenant),null);
 assert.equal(journalReceiptIssue(id,order,{...journal,grossCents:10000},tenant),"journal_integrity_mismatch");
 assert.equal(journalReceiptIssue(id,order,{...journal,sourceDay:"2026-10-21"},tenant),"journal_integrity_mismatch");
 assert.equal(journalReceiptIssue(id,order,{...journal,shard:99},tenant),"journal_integrity_mismatch");
 assert.equal(journalReceiptIssue(id,{...order,totalAmount:95},journal,tenant),"journal_integrity_mismatch");
 assert.equal(journalReceiptIssue(id,{...order,refundTotal:10},journal,tenant),"unreviewed_refund_or_financial_state");
 assert.equal(journalReceiptIssue(id,{...order,paymentReceiptSource:"promptpay"},journal,tenant),"unsupported_payment_source");
 assert.equal(journalReceiptIssue(id,order,null,tenant),"missing_journal");
 assert.equal(journalReceiptIssue(id,{...order,paidAt:"2026-10-20"},journal,tenant),"noncanonical_paid_at");
});
