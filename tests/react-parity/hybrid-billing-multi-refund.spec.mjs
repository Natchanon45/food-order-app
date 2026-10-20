import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {appendHybridVerifiedPartialRefund}=require("../../functions/hybrid-billing-multi-refund.js");
const {MAX_REFUND_CHAIN,refundAnchorDigest,refundPartDigest,verifyRefundChain,shardOf}
  =require("../../functions/hybrid-billing-receipt-journal.js");
const stamp=v=>({toMillis:()=>Date.parse(v),toDate:()=>new Date(v)});
test("refund chain is hard bounded and immutable digest binds original source and each partial",()=>{
 assert.equal(MAX_REFUND_CHAIN,8);
 const base={source:"hybrid_refund_bank_verified_server",tenantId:"tenant-refund-chain-001",
  orderId:"order-refund-chain-001",shard:shardOf("order-refund-chain-001"),
  originalMerchandiseCents:1550000,refundCents:100000,
  referenceHash:"a".repeat(64),evidenceSha256:"b".repeat(64),
  refundAt:stamp("2026-10-21T01:00:00Z"),
  actorUid:"super-chain-001",sourceDay:"2026-10-21",currency:"THB"};
 const anchor=refundAnchorDigest(base);
 assert.match(anchor,/^[a-f0-9]{64}$/);
 const event={...base,sequence:2,previousDigest:anchor,refundCents:200000,
  cumulativeCents:300000,referenceHash:"c".repeat(64)};
 const digest=refundPartDigest(event);
 assert.notEqual(digest,refundPartDigest({...event,refundCents:200001}));
 assert.notEqual(digest,refundPartDigest({...event,previousDigest:"0".repeat(64)}));
 const order={orderType:"delivery",paymentStatus:"paid",status:"delivered",
   paidAt:stamp("2026-10-20T12:00:00Z"),paymentReceiptSource:"hybrid_cod_cashier_server",
   totalAmount:15540,subtotalAmount:15500,deliveryFee:40,
   refundTotal:3000,refundReceiptSource:"hybrid_refund_bank_verified_server",
   refundChainCount:2,refundChainHeadDigest:digest,
   refundBankReferenceHash:event.referenceHash,
   refundEvidenceSha256:event.evidenceSha256,
   refundSettledAt:event.refundAt};
 const payment={merchandiseCents:1550000};
 const chain={head:{tenantId:base.tenantId,orderId:base.orderId,count:2,
   anchorDigest:anchor,headDigest:digest,totalRefundCents:300000,
   originalMerchandiseCents:1550000,lastRefundAt:event.refundAt},
   parts:[{...event,digest}]};
 assert.equal(verifyRefundChain(base.orderId,order,payment,base,chain,base.tenantId),null);
 assert.equal(verifyRefundChain(base.orderId,order,payment,base,{...chain,
   parts:[{...event,digest:"0".repeat(64)}]},base.tenantId),"refund_chain_integrity_mismatch");
 assert.equal(verifyRefundChain(base.orderId,{...order,refundTotal:4000},
   payment,base,chain,base.tenantId),"refund_chain_total_mismatch");
});
test("partial refund has no live bank adapter, unexported and never initiates refunds",async()=>{
 await assert.rejects(appendHybridVerifiedPartialRefund({db:{},
  tenantId:"tenant-refund-chain-001",orderId:"order-refund-chain-001",
  reviewerUid:"super-chain-001"}),/PROVIDER_NOT_CONNECTED/);
 const idx=readFileSync("functions/index.js","utf8");
 const src=readFileSync("functions/hybrid-billing-multi-refund.js","utf8");
 assert.doesNotMatch(idx,/hybrid-billing-multi-refund/);
 assert.match(src,/refundInitiated:false,invoiceApplied:false/);
 assert.doesNotMatch(src,/hybridBillingInvoices.*tx\.update/);
});
