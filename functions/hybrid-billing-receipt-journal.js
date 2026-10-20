"use strict";
// Internal, unexported source candidate: writes COD payment event in the
// SAME Firestore transaction as the trusted paid Delivery order.
// No production cutover, no migration and no bank/provider attestation.
const { createHash } = require("node:crypto");
const { paidDeliverySale } = require("./hybrid-billing-orders");
const { dateKey } = require("./hybrid-billing-core");
const SHARDS=16;
const ID=/^[A-Za-z0-9_-]{8,128}$/;
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
async function verifyJournaledCodOrders(tx,tenantRef,rows){
  if(!Array.isArray(rows)||rows.length>3000) throw Error("HYBRID_JOURNAL_COVERAGE_LIMIT");
  // An explicit strict-coverage flag cannot silently whitelist old paid orders.
  // Only COD currently emits journal entries, so every other paid Delivery
  // source must be migrated and independently verified before strict release.
  const selected=rows.filter(row=>row?.data?.orderType==="delivery"
    && row?.data?.paymentStatus==="paid");
  const docs=await Promise.all(selected.map(row=>tx.get(eventRef(tenantRef,row.id))));
  for(let i=0;i<selected.length;i++){
    const {id,data}=selected[i],record=docs[i].data()||{};
    if(!docs[i].exists || record.orderId!==id || record.tenantId!==tenantRef.id
      || record.source!=="hybrid_cod_cashier_server"
      || record.merchandiseCents!==Math.round(paidDeliverySale(data)?.amount*100)
      || record.paidAt?.toMillis?.()!==data.paidAt?.toMillis?.()
      || data.paymentReceiptSource!=="hybrid_cod_cashier_server") {
      throw Error("HYBRID_JOURNAL_SOURCE_INCOMPLETE");
    }
  }
  return {verified:selected.length};
}
module.exports={SHARDS,shardOf,prepareCodReceiptJournal,readJournalFences,verifyJournaledCodOrders};
