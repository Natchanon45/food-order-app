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

const MAX_REFUND_CHAIN=8; // hard safety cap: transactional reads remain bounded
const HASH64=/^[a-f0-9]{64}$/;
const digest=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const partRefFor=(t,id,seq)=>t.collection("hybridBillingReceiptEvents")
  .doc("refundpart-"+id+"-"+String(seq).padStart(6,"0"));
const chainRefFor=(t,id)=>t.collection("hybridBillingRefundChains").doc(id);
const milli=stamp=>stamp?.toMillis?.();
function refundAnchorDigest(e){
 if(!e || e.source!==REFUND_SOURCE || !HASH64.test(e.referenceHash||"")
   || !HASH64.test(e.evidenceSha256||"") || !Number.isSafeInteger(e.refundCents)
   || e.refundCents<=0 || !Number.isSafeInteger(milli(e.refundAt))) return null;
 return digest(["hybrid-refund-anchor-v1",e.tenantId,e.orderId,e.shard,
   e.originalMerchandiseCents,e.refundCents,e.referenceHash,
   e.evidenceSha256,milli(e.refundAt),e.actorUid,e.sourceDay]);
}
function refundPartDigest(e){
 if(!e || !HASH64.test(e.previousDigest||"")
   || !HASH64.test(e.referenceHash||"") || !HASH64.test(e.evidenceSha256||"")
   || !Number.isSafeInteger(milli(e.refundAt))) return null;
 return digest(["hybrid-refund-part-v1",e.tenantId,e.orderId,
   e.sequence,e.previousDigest,e.refundCents,e.cumulativeCents,
   e.originalMerchandiseCents,e.referenceHash,e.evidenceSha256,
   milli(e.refundAt),e.actorUid,e.shard,e.sourceDay]);
}
async function loadRefundChain(read,tenantRef,orderId,order){
 const count=order?.refundChainCount;
 if(count==null || count===0)return null;
 if(!Number.isSafeInteger(count)||count<2||count>MAX_REFUND_CHAIN) return {invalid:true};
 const [head,...parts]=await Promise.all([
   read(chainRefFor(tenantRef,orderId)),
   ...Array.from({length:count-1},(_,i)=>read(partRefFor(tenantRef,orderId,i+2)))
 ]);
 return {head:head.exists?head.data():null,
   parts:parts.map(s=>s.exists?s.data():null)};
}
/**
 * Pure integrity validation: preserve immutable refund-{id} as first anchor,
 * verify EVERY subsequent event, hashes, amounts and chronological order.
 * No client may supply a chain to the actual Firestore call.
 */
function verifyRefundChain(orderId,order,payment,first,chain,tenantId){
 const count=order?.refundChainCount,head=chain?.head,parts=chain?.parts;
 if(!Number.isSafeInteger(count)||count<2||count>MAX_REFUND_CHAIN
   || !head || !Array.isArray(parts) || parts.length!==count-1
   || !first || first.tenantId!==tenantId || first.orderId!==orderId
   || first.currency!=="THB" || first.shard!==shardOf(orderId)
   || first.originalMerchandiseCents!==payment.merchandiseCents)
    return "refund_chain_missing";
 const anchor=refundAnchorDigest(first);
 if(!anchor || first.sourceDay!==dateKey(first.refundAt.toDate())
   || head.anchorDigest!==anchor || head.tenantId!==tenantId
   || head.orderId!==orderId || head.count!==count
   || head.originalMerchandiseCents!==payment.merchandiseCents
   || order.refundReceiptSource!==REFUND_SOURCE
   || moneyCents(order.refundedAmount??0)!==0
   || moneyCents(order.refundAmount??0)!==0)
    return "refund_chain_integrity_mismatch";
 const seen=new Set([first.referenceHash]);
 let previous=anchor,total=first.refundCents,lastAt=milli(first.refundAt);
 for(let i=0;i<parts.length;i++){
   const e=parts[i],seq=i+2;
   if(!e || e.source!==REFUND_SOURCE || e.sequence!==seq
     || e.tenantId!==tenantId || e.orderId!==orderId || e.currency!=="THB"
     || e.shard!==shardOf(orderId) || e.previousDigest!==previous
     || !Number.isSafeInteger(e.refundCents) || e.refundCents<=0
     || !Number.isSafeInteger(e.cumulativeCents)
     || e.cumulativeCents!==total+e.refundCents
     || e.originalMerchandiseCents!==payment.merchandiseCents
     || !Number.isSafeInteger(milli(e.refundAt)) || milli(e.refundAt)<lastAt
     || e.sourceDay!==dateKey(e.refundAt.toDate())
     || !ID.test(e.actorUid||"") || seen.has(e.referenceHash)
     || e.digest!==refundPartDigest(e))
      return "refund_chain_integrity_mismatch";
   total=e.cumulativeCents;lastAt=milli(e.refundAt);previous=e.digest;
   seen.add(e.referenceHash);
 }
 const final=parts.at(-1),net=paidDeliverySale(order),
  netCents=net?moneyCents(net.amount):null;
 if(total>payment.merchandiseCents || total!==moneyCents(order.refundTotal)
   || total!==head.totalRefundCents
   || total+netCents!==payment.merchandiseCents
   || previous!==head.headDigest || previous!==order.refundChainHeadDigest
   || order.refundSettledAt?.toMillis?.()!==lastAt
   || final.referenceHash!==order.refundBankReferenceHash
   || final.evidenceSha256!==order.refundEvidenceSha256
   || head.lastRefundAt?.toMillis?.()!==lastAt)
    return "refund_chain_total_mismatch";
 return null;
}

function journalReceiptIssue(orderId,order,event,tenantId,refundEvent=null,chain=null){
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
  if(order.refundChainCount!=null && order.refundChainCount!==0)
    return verifyRefundChain(orderId,order,event,refundEvent,chain,tenantId);
  if(order.refundChainHeadDigest)return "refund_chain_missing";
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
  const chains=await Promise.all(docs.map(d=>loadRefundChain(
    ref=>ref.get(),tenantRef,d.id,d.data())));
  const issues=[];
  for(let i=0;i<docs.length;i++){
    let reason;
    try{reason=journalReceiptIssue(docs[i].id,docs[i].data(),
      events[i].exists?events[i].data():null,tenantId,
      refunds[i]?.exists?refunds[i].data():null,chains[i])}
    catch{reason="unreviewed_refund_or_financial_state"}
    if(reason)issues.push({orderId:docs[i].id,reason});
  }
  const hasMore=snap.docs.length>pageSize,nextAfterId=hasMore?docs.at(-1)?.id:null;
  if(hasMore&&!nextAfterId)throw Error("HYBRID_JOURNAL_AUDIT_MISSING_CURSOR");
  // Financial-source page witness is bound to the ACTUAL source fields and
  // trusted journal evidence, never merely issue IDs. No PII or secrets leave
  // this helper. This remains advisory, not a cross-page snapshot.
  const witness=docs.map((d,i)=>{
    const order=d.data()||{},payment=events[i].exists?events[i].data()||{}:{},
      refund=refunds[i]?.exists?refunds[i].data()||{}:{},
      chain=chains[i]?.head||{};
    return [d.id,order.paymentStatus,order.paymentReceiptSource,
      order.paidAt?.toMillis?.()??null,moneyCents(order.totalAmount),
      moneyCents(order.subtotalAmount),moneyCents(order.deliveryFee??0),
      moneyCents(order.refundTotal??0),order.refundChainCount??null,
      order.refundChainHeadDigest??null,payment.source??null,
      payment.sourceDay??null,payment.paidAt?.toMillis?.()??null,
      payment.grossCents??null,payment.merchandiseCents??null,
      payment.referenceHash??null,payment.evidenceSha256??null,
      refund.refundCents??null,refund.referenceHash??null,
      refund.evidenceSha256??null,chain.headDigest??null];
  });
  const pageDigest=createHash("sha256").update(JSON.stringify(witness)).digest("hex");
  return {tenantId,scanned:docs.length,issues,issueCount:issues.length,
    hasMore,nextAfterId,pageDigest,coverageCertified:false,
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
  const chains=await Promise.all(selected.map(row=>loadRefundChain(
    ref=>tx.get(ref),tenantRef,row.id,row.data)));
  for(let i=0;i<selected.length;i++){
    const {id,data}=selected[i];
    let problem;
    try{problem=journalReceiptIssue(id,data,docs[i].exists?docs[i].data():null,
      tenantRef.id,refunds[i]?.exists?refunds[i].data():null,chains[i])}
    catch{problem="unreviewed_refund_or_financial_state"}
    if(problem) throw Error("HYBRID_JOURNAL_SOURCE_INCOMPLETE:"+problem);
  }
  return {verified:selected.length};
}
module.exports={SHARDS,shardOf,prepareCodReceiptJournal,readJournalFences,
  verifyJournaledCodOrders,journalReceiptIssue,inspectHybridJournalCoveragePage,
  prepareBankReceiptJournal,prepareRefundJournal,MAX_REFUND_CHAIN,
  refundAnchorDigest,refundPartDigest,loadRefundChain,verifyRefundChain,
  partRefFor,chainRefFor};
