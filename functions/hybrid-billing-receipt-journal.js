"use strict";
// Internal, unexported source candidate: writes COD payment event in the
// SAME Firestore transaction as the trusted paid Delivery order.
// No production cutover, no migration and no bank/provider attestation.
const { createHash } = require("node:crypto");
const { paidDeliverySale } = require("./hybrid-billing-orders");
const { dateKey } = require("./hybrid-billing-core");
const SHARDS=16;
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const ORDER_ID=/^[A-Za-z0-9_-]{1,256}$/;
const shardOf = id => {
  if (typeof id!=="string" || !ID.test(id)) throw Error("HYBRID_JOURNAL_BAD_ORDER");
  return createHash("sha256").update(id).digest().readUInt32BE(0)%SHARDS;
};
const eventRef=(t,id)=>t.collection("hybridBillingReceiptEvents").doc("cod-"+id);
const fenceRef=(t,n)=>t.collection("hybridBillingReceiptFences").doc("shard-"+String(n).padStart(2,"0"));
async function prepareCodReceiptJournal({tx,tenantRef,order,tenantId,orderId,actorUid,now,serverTimestamp}){
  if(!tx || !tenantRef || !ID.test(String(tenantId||"")) || !ID.test(String(actorUid||""))
    || !(now instanceof Date) || !Number.isFinite(now.getTime())
    || typeof serverTimestamp!=="function") throw Error("HYBRID_JOURNAL_BAD_INPUT");
  const shard=shardOf(orderId),e=eventRef(tenantRef,orderId),f=fenceRef(tenantRef,shard);
  // READ all references BEFORE first transaction write.
  const [oldEvent,oldFence]=await Promise.all([tx.get(e),tx.get(f)]);
  if(oldEvent.exists) throw Error("HYBRID_JOURNAL_DUPLICATE");
  const version=oldFence.exists?oldFence.data()?.version:0;
  if(!Number.isSafeInteger(version)||version<0||version>=Number.MAX_SAFE_INTEGER) throw Error("HYBRID_JOURNAL_BAD_FENCE");
  const sale=paidDeliverySale({...order,paymentStatus:"paid",paidAt:{toDate:()=>now}});
  if(!sale || !Number.isSafeInteger(Math.round(sale.amount*100))) throw Error("HYBRID_JOURNAL_BAD_SALE");
  const day=dateKey(now);
  const stamp=serverTimestamp();
  return ()=>{
    tx.create(e,{tenantId,orderId,source:"hybrid_cod_cashier_server",
      actorUid,shard,sourceDay:day,merchandiseCents:Math.round(sale.amount*100),
      grossCents:Math.round(order.totalAmount*100),currency:"THB",
      paidAt:stamp,createdAt:stamp});
    if(oldFence.exists) tx.update(f,{version:version+1,updatedAt:stamp});
    else tx.create(f,{version:1,shard,updatedAt:stamp});
  };
}
async function readJournalFences(tx,tenantRef){
  if(!tx||!tenantRef) throw Error("HYBRID_JOURNAL_FENCE_REQUIRED");
  const docs=await Promise.all(Array.from({length:SHARDS},(_,i)=>tx.get(fenceRef(tenantRef,i))));
  return docs.map((d,i)=>{
    const version=d.exists?d.data()?.version:0;
    if(!Number.isSafeInteger(version)||version<0) throw Error("HYBRID_JOURNAL_BAD_FENCE");
    return {shard:i,version};
  });
}

const moneyCents = amount => {
  if (typeof amount!=="number" || !Number.isFinite(amount) || amount<0
      || amount>1e9 || Math.abs(amount*100-Math.round(amount*100))>0.00001) return null;
  return Math.round(amount*100);
};
/** Pure integrity check usable both in strict transactional close and in an
 * untrusted/read-only historical inventory. An event merely existing is NOT
 * sufficient proof. Every financial field and server timestamp must agree.
 */
function journalReceiptIssue(orderId,order,event,tenantId,refundEvent=null){
  if (!ORDER_ID.test(String(orderId||"")) || !ID.test(String(tenantId||""))) return "invalid_identifier";
  if (!order || order.orderType!=="delivery" || order.paymentStatus!=="paid") return "invalid_paid_delivery";
  const paidAt=order.paidAt?.toDate?.();
  if (!(paidAt instanceof Date) || !Number.isFinite(paidAt.getTime())) return "noncanonical_paid_at";
  const source=order.paymentReceiptSource;
  const cod=source==="hybrid_cod_cashier_server";
  const bank=source==="hybrid_promptpay_bank_verified_server";
  if (!cod&&!bank) return "unsupported_payment_source";
  if (!event) return "missing_journal";
  if (event.source!==source) return "unsupported_payment_source";
  if (bank && (order.paymentMethod!=="promptpay" || !/^[a-f0-9]{64}$/.test(event.referenceHash||"")
      || !/^[a-f0-9]{64}$/.test(event.evidenceSha256||"")
      || event.referenceHash!==order.paymentBankReferenceHash
      || event.evidenceSha256!==order.paymentEvidenceSha256))
    return "journal_integrity_mismatch";
  const eventAt=event.paidAt?.toDate?.();
  if (!(eventAt instanceof Date) || !Number.isFinite(eventAt.getTime())) return "noncanonical_paid_at";
  if (paidAt.getTime()!==eventAt.getTime()) return "payment_time_mismatch";
  const gross=moneyCents(order.totalAmount);
  const merchandise=paidDeliverySale(order);
  const net=merchandise?moneyCents(merchandise.amount):null;
  if(gross===null||net===null||net<0)return "unreviewed_refund_or_financial_state";
  if(event.tenantId!==tenantId||event.orderId!==orderId||event.currency!=="THB"
   ||event.shard!==shardOf(orderId)||event.sourceDay!==dateKey(paidAt)
   ||event.grossCents!==gross||typeof event.actorUid!=="string"
   ||!ID.test(event.actorUid))return "journal_integrity_mismatch";
  const refunded=moneyCents(order.refundTotal??order.refundedAmount??order.refundAmount??0);
  if(refunded===null)return "unreviewed_refund_or_financial_state";
  if(refunded===0){
    if(refundEvent||order.refundReceiptSource||event.merchandiseCents!==net)
      return "unreviewed_refund_or_financial_state";
    return null;
  }
  if(order.refundReceiptSource!==REFUND_SOURCE||!refundEvent
    ||moneyCents(order.refundedAmount??0)!==0
    ||moneyCents(order.refundAmount??0)!==0
    ||event.merchandiseCents!==net+refunded)
      return "unreviewed_refund_or_financial_state";
  const at=order.refundSettledAt?.toDate?.(),proofAt=refundEvent.refundAt?.toDate?.();
  if(!(at instanceof Date)||!Number.isFinite(at.getTime())
    ||!(proofAt instanceof Date)||at.getTime()!==proofAt.getTime())
    return "refund_time_mismatch";
  if(refundEvent.source!==REFUND_SOURCE||refundEvent.tenantId!==tenantId
    ||refundEvent.orderId!==orderId||refundEvent.shard!==shardOf(orderId)
    ||refundEvent.sourceDay!==dateKey(at)||refundEvent.currency!=="THB"
    ||refundEvent.originalMerchandiseCents!==event.merchandiseCents
    ||refundEvent.refundCents!==refunded
    ||refundEvent.referenceHash!==order.refundBankReferenceHash
    ||refundEvent.evidenceSha256!==order.refundEvidenceSha256
    ||!/^[a-f0-9]{64}$/.test(refundEvent.referenceHash||"")
    ||!/^[a-f0-9]{64}$/.test(refundEvent.evidenceSha256||"")
    ||typeof refundEvent.actorUid!=="string"||!ID.test(refundEvent.actorUid))
    return "refund_integrity_mismatch";
  return null;
}
/**
 * Read-only page of ALL lifetime paid Delivery docs, including legacy ISO,
 * non-COD, refunded and out-of-cycle rows. Advisory ONLY: never flips any
 * tenant release flag. The server caller must authorize Super Admin separately.
 * Paged reads across requests are NOT a global snapshot or a certification.
 */
async function inspectHybridJournalCoveragePage({db,tenantId,afterId=null,pageSize=100}){
  if(!db || !ID.test(String(tenantId||""))
    || (afterId!==null && (typeof afterId!=="string" || !ORDER_ID.test(afterId)))
    || !Number.isSafeInteger(pageSize) || pageSize<1 || pageSize>200){
    throw Error("HYBRID_JOURNAL_AUDIT_BAD_REQUEST");
  }
  const tenantRef=db.collection("tenants").doc(tenantId);
  const tenant=await tenantRef.get();
  if(!tenant.exists || tenant.data()?.billingPolicyVersion!=="hybrid_v1"
    || tenant.data()?.hybridBillingEnabled!==true) throw Error("HYBRID_JOURNAL_AUDIT_TENANT_NOT_HYBRID");
  let query=tenantRef.collection("orders").where("orderType","==","delivery")
    .where("paymentStatus","==","paid").orderBy("__name__").limit(pageSize+1);
  if(afterId)query=query.startAfter(afterId);
  const snap=await query.get();
  if(!Array.isArray(snap?.docs)||snap.size!==snap.docs.length||snap.size>pageSize+1)
    throw Error("HYBRID_JOURNAL_AUDIT_SCAN_INCOMPLETE");
  const docs=snap.docs.slice(0,pageSize);
  const [events,refunds]=await Promise.all([
    Promise.all(docs.map(d=>journalEventRef(tenantRef,d.id,
      d.data()?.paymentReceiptSource).get())),
    Promise.all(docs.map(d=>(moneyCents(d.data()?.refundTotal??0)>0
      ||d.data()?.refundReceiptSource)
      ?refundRefFor(tenantRef,d.id).get():Promise.resolve(null)))
  ]);
  const issues=[];
  for(let i=0;i<docs.length;i++){
    let reason;
    try{reason=journalReceiptIssue(docs[i].id,docs[i].data(),
      events[i].exists?events[i].data():null,tenantId,
      refunds[i]?.exists?refunds[i].data():null)}
    catch{reason="unreviewed_refund_or_financial_state"}
    if(reason)issues.push({orderId:docs[i].id,reason});
  }
  const hasMore=snap.docs.length>pageSize,nextAfterId=hasMore?docs.at(-1)?.id:null;
  if(hasMore&&!nextAfterId)throw Error("HYBRID_JOURNAL_AUDIT_MISSING_CURSOR");
  return {tenantId,scanned:docs.length,issues,issueCount:issues.length,
    hasMore,nextAfterId,coverageCertified:false,
    note:"read_only_pagination_not_a_consistent_snapshot_no_auto_activation"};
}


/** Independently attested PromptPay SOURCE-ONLY event. Must be invoked inside
 * the same Firestore transaction as a bank-ref claim and order paid update.
 * A future adapter cannot accept browser-supplied proof.
 */
async function prepareBankReceiptJournal({tx,tenantRef,tenantId,orderId,actorUid,
  order,proof,serverTimestamp}){
 if(!tx || !tenantRef || !ID.test(tenantId) || !ID.test(orderId)
  || !ID.test(actorUid) || typeof serverTimestamp!=="function"
  || !proof || !/^[a-f0-9]{64}$/.test(proof.referenceHash||"")
  || !/^[a-f0-9]{64}$/.test(proof.evidenceSha256||"")
  || !(proof.paidAt instanceof Date) || !Number.isFinite(proof.paidAt.getTime())
  || !Number.isSafeInteger(proof.grossAmountCents) || proof.grossAmountCents<=0)
   throw Error("HYBRID_PROMPTPAY_JOURNAL_INVALID_INPUT");
 const shard=shardOf(orderId);
 const ev=tenantRef.collection("hybridBillingReceiptEvents").doc("bank-"+orderId);
 const fence=fenceRef(tenantRef,shard);
 const [existing,oldFence]=await Promise.all([tx.get(ev),tx.get(fence)]);
 if(existing.exists) throw Error("HYBRID_PROMPTPAY_JOURNAL_DUPLICATE");
 const version=oldFence.exists?oldFence.data()?.version:0;
 if(!Number.isSafeInteger(version)||version<0||version>=Number.MAX_SAFE_INTEGER)
   throw Error("HYBRID_JOURNAL_BAD_FENCE");
 const stamp=require("firebase-admin/firestore").Timestamp.fromDate(proof.paidAt);
 const sale=paidDeliverySale({...order,paymentStatus:"paid",paidAt:stamp});
 const net=sale?moneyCents(sale.amount):null;
 if(net===null || net<=0 || moneyCents(order.totalAmount)!==proof.grossAmountCents)
   throw Error("HYBRID_PROMPTPAY_JOURNAL_AMOUNT_MISMATCH");
 const now=serverTimestamp();
 return ()=>{
   tx.create(ev,{tenantId,orderId,source:"hybrid_promptpay_bank_verified_server",
     actorUid,shard,sourceDay:dateKey(proof.paidAt),
     merchandiseCents:net,grossCents:proof.grossAmountCents,currency:"THB",
     referenceHash:proof.referenceHash,evidenceSha256:proof.evidenceSha256,
     paidAt:stamp,createdAt:now});
   if(oldFence.exists)tx.update(fence,{version:version+1,updatedAt:now});
   else tx.create(fence,{version:1,shard,updatedAt:now});
 };
}

const REFUND_SOURCE="hybrid_refund_bank_verified_server";
const refundRefFor=(t,id)=>t.collection("hybridBillingReceiptEvents").doc("refund-"+id);
async function prepareRefundJournal({tx,tenantRef,tenantId,orderId,actorUid,proof,
 originalNet,serverTimestamp}){
 if(!tx||!tenantRef||!ID.test(tenantId)||!ID.test(orderId)||!ID.test(actorUid)
  ||!Number.isSafeInteger(originalNet)||originalNet<=0
  ||!proof||!Number.isSafeInteger(proof.refundAmountCents)
  ||proof.refundAmountCents<=0||proof.refundAmountCents>originalNet
  ||!(proof.refundAt instanceof Date)||!Number.isFinite(proof.refundAt.getTime())
  ||!/^[a-f0-9]{64}$/.test(proof.referenceHash||"")
  ||!/^[a-f0-9]{64}$/.test(proof.evidenceSha256||"")
  ||typeof serverTimestamp!=="function")throw Error("HYBRID_REFUND_JOURNAL_BAD_PROOF");
 const shard=shardOf(orderId),ev=refundRefFor(tenantRef,orderId),
  fence=fenceRef(tenantRef,shard);
 const [prior,oldFence]=await Promise.all([tx.get(ev),tx.get(fence)]);
 if(prior.exists)throw Error("HYBRID_REFUND_JOURNAL_DUPLICATE");
 const version=oldFence.exists?oldFence.data()?.version:0;
 if(!Number.isSafeInteger(version)||version<0||version>=Number.MAX_SAFE_INTEGER)
   throw Error("HYBRID_JOURNAL_BAD_FENCE");
 const at=require("firebase-admin/firestore").Timestamp.fromDate(proof.refundAt),
  stamp=serverTimestamp();
 return ()=>{
   tx.create(ev,{tenantId,orderId,source:REFUND_SOURCE,actorUid,shard,
     sourceDay:dateKey(proof.refundAt),currency:"THB",
     originalMerchandiseCents:originalNet,refundCents:proof.refundAmountCents,
     referenceHash:proof.referenceHash,evidenceSha256:proof.evidenceSha256,
     refundAt:at,createdAt:stamp});
   if(oldFence.exists)tx.update(fence,{version:version+1,updatedAt:stamp});
   else tx.create(fence,{version:1,shard,updatedAt:stamp});
 };
}

function journalEventRef(t,id,source){
 return t.collection("hybridBillingReceiptEvents").doc(
  (source==="hybrid_promptpay_bank_verified_server"?"bank-":"cod-")+id);
}

async function verifyJournaledCodOrders(tx,tenantRef,rows){
  if(!Array.isArray(rows)||rows.length>3000) throw Error("HYBRID_JOURNAL_COVERAGE_LIMIT");
  // An explicit strict-coverage flag cannot silently whitelist old paid orders.
  // Only COD currently emits journal entries, so every other paid Delivery
  // source must be migrated and independently verified before strict release.
  const selected=rows.filter(row=>row?.data?.orderType==="delivery"
    && row?.data?.paymentStatus==="paid");
  const [docs,refunds]=await Promise.all([
    Promise.all(selected.map(row=>tx.get(journalEventRef(
      tenantRef,row.id,row.data?.paymentReceiptSource)))),
    Promise.all(selected.map(row=>(moneyCents(row.data?.refundTotal??0)>0
      ||row.data?.refundReceiptSource)
      ?tx.get(refundRefFor(tenantRef,row.id)):Promise.resolve(null)))
  ]);
  for(let i=0;i<selected.length;i++){
    const {id,data}=selected[i];
    let problem;
    try{problem=journalReceiptIssue(id,data,docs[i].exists?docs[i].data():null,
      tenantRef.id,refunds[i]?.exists?refunds[i].data():null)}
    catch{problem="unreviewed_refund_or_financial_state"}
    if(problem) throw Error("HYBRID_JOURNAL_SOURCE_INCOMPLETE:"+problem);
  }
  return {verified:selected.length};
}
module.exports={SHARDS,shardOf,prepareCodReceiptJournal,readJournalFences,
  verifyJournaledCodOrders,journalReceiptIssue,inspectHybridJournalCoveragePage,
  prepareBankReceiptJournal,prepareRefundJournal};
