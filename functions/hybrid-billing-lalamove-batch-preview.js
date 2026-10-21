"use strict";
// Phase3AG: SOURCE-ONLY / UNEXPORTED / READ-ONLY Lalamove COD batch preview.
// Fixture-shaped proofs are NOT authenticated production integrations.
// Never changes Order.paymentStatus, trusted receipt journals or invoice/AR.
const {createHash}=require("node:crypto");
const ID=/^[A-Za-z0-9_-]{8,128}$/;
const SHA=/^[a-f0-9]{64}$/;
const MAX_ROWS=20,MAX_AGE=15*60*1000,MAX_CENTS=100000000000;
const digest=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX_CENTS;
const positive=n=>cents(n)&&n>0;
function money(amount){
 if(typeof amount!=="number"||!Number.isFinite(amount)||amount<=0
  ||amount>1000000000||Math.abs(amount*100-Math.round(amount*100))>0.00001)
   return null;
 return Math.round(amount*100);
}
function validTime(time,now){
 return time instanceof Date&&Number.isFinite(time.getTime())
  &&time<=now&&time.getTime()>=now.getTime()-MAX_AGE;
}
function reconcileHybridLalamoveCodBatch({
 tenantId,orders,provider,bank,accountScopeSha256,recipientAccountSha256,now
}={}){
 const fail=()=>{throw Error("HYBRID_LALAMOVE_BATCH_INDEPENDENT_POSTED_CREDIT_REQUIRED");};
 if(!ID.test(String(tenantId||""))||!(now instanceof Date)
  ||!Number.isFinite(now.getTime())
  ||!SHA.test(accountScopeSha256||"")||!SHA.test(recipientAccountSha256||"")
  ||!Array.isArray(orders)||orders.length<2||orders.length>MAX_ROWS
  ||!provider||provider.source!=="authenticated_lalamove_batch_remittance_lookup"
  ||provider.authenticated!==true||provider.tenantId!==tenantId
  ||provider.market!=="TH"||provider.currency!=="THB"
  ||provider.status!=="PAID_OUT"||provider.batchPayout!==true
  ||!ID.test(provider.batchId||"")||!SHA.test(provider.transferReferenceSha256||"")
  ||!SHA.test(provider.evidenceSha256||"")
  ||provider.accountScopeSha256!==accountScopeSha256
  ||provider.recipientAccountSha256!==recipientAccountSha256
  ||!validTime(provider.checkedAt,now)
  ||!(provider.paidOutAt instanceof Date)
  ||!Number.isFinite(provider.paidOutAt.getTime())||provider.paidOutAt>now
  ||!Array.isArray(provider.allocations)||provider.allocations.length!==orders.length
  ||provider.orderCount!==orders.length||!positive(provider.collectedCodCents)
  ||!cents(provider.feeCents)||!positive(provider.remittedCents)
  ||!bank||bank.source!=="independent_bank_posted_credit_lookup"
  ||bank.authenticated!==true||bank.tenantId!==tenantId
  ||bank.status!=="POSTED"||bank.currency!=="THB"
  ||bank.recipientConfirmed!==true
  ||bank.recipientAccountSha256!==recipientAccountSha256
  ||bank.transferReferenceSha256!==provider.transferReferenceSha256
  ||!SHA.test(bank.evidenceSha256||"")
  ||bank.evidenceSha256===provider.evidenceSha256
  ||bank.bankAccountScopeSha256!==recipientAccountSha256
  ||!positive(bank.creditedCents)||bank.creditedCents!==provider.remittedCents
  ||!validTime(bank.checkedAt,now)
  ||!(bank.postedAt instanceof Date)||!Number.isFinite(bank.postedAt.getTime())
  ||bank.postedAt>now||bank.postedAt<provider.paidOutAt)fail();
 const byOrder=new Map();
 for(const row of orders){
  if(!row||!ID.test(String(row.orderId||""))||byOrder.has(row.orderId)
   ||!row.order||row.order.orderType!=="delivery"
   ||row.order.deliveryProvider!=="lalamove"
   ||row.order.paymentMethod!=="cod"
   ||row.order.lalamoveCodEnabled!==true
   ||row.order.paymentStatus!=="unpaid"
   ||typeof row.order.lalamoveOrderId!=="string"
   ||!row.order.lalamoveOrderId.trim()
   ||money(row.order.totalAmount)===null)fail();
  const p=row.deliveryProof;
  if(!p||p.tenantId!==tenantId||p.orderId!==row.orderId
   ||p.providerOrderId!==row.order.lalamoveOrderId
   ||p.accountScopeSha256!==accountScopeSha256
   ||p.deliveryVerified!==true||p.codSettlementVerified!==false
   ||p.bankReconciled!==false
   ||p.status!=="delivery_verified_settlement_pending"
   ||!SHA.test(p.eventHash||"")||!SHA.test(p.providerEvidenceSha256||""))
    fail();
  byOrder.set(row.orderId,row);
 }
 let collected=0,fees=0,remitted=0;
 const keys=new Set(),providerIds=new Set(),allocations=[];
 for(const item of provider.allocations){
  if(!item||!ID.test(String(item.orderId||""))||keys.has(item.orderId)
   ||!byOrder.has(item.orderId)
   ||typeof item.providerOrderId!=="string"||!item.providerOrderId.trim()
   ||providerIds.has(item.providerOrderId)
   ||!positive(item.collectedCodCents)||!cents(item.feeCents)
   ||!positive(item.remittedCents)
   ||item.remittedCents!==item.collectedCodCents-item.feeCents
   ||item.collectedCodCents!==money(byOrder.get(item.orderId).order.totalAmount)
   ||item.providerOrderId!==byOrder.get(item.orderId).order.lalamoveOrderId)
    fail();
  keys.add(item.orderId);providerIds.add(item.providerOrderId);
  collected+=item.collectedCodCents;fees+=item.feeCents;remitted+=item.remittedCents;
  if(![collected,fees,remitted].every(Number.isSafeInteger))fail();
  const p=byOrder.get(item.orderId).deliveryProof;
  allocations.push({orderId:item.orderId,providerOrderId:item.providerOrderId,
   collectedCodCents:item.collectedCodCents,feeCents:item.feeCents,
   remittedCents:item.remittedCents,deliveryEvidenceDigest:p.eventHash});
 }
 if(keys.size!==orders.length||collected!==provider.collectedCodCents
  ||fees!==provider.feeCents||remitted!==provider.remittedCents
  ||collected-fees!==remitted)fail();
 allocations.sort((a,b)=>a.orderId.localeCompare(b.orderId,"en"));
 const witness=digest(["hybrid_lalamove_batch_preview_v1",
  tenantId,provider.batchId,provider.transferReferenceSha256,
  accountScopeSha256,recipientAccountSha256,provider.paidOutAt.toISOString(),
  bank.postedAt.toISOString(),provider.evidenceSha256,bank.evidenceSha256,
  collected,fees,remitted,
  allocations.map(a=>[a.orderId,a.providerOrderId,a.collectedCodCents,
    a.feeCents,a.remittedCents,a.deliveryEvidenceDigest])]);
 return {tenantId,batchId:provider.batchId,transferReferenceSha256:provider.transferReferenceSha256,orderCount:allocations.length,
  collectedCodCents:collected,providerFeeCents:fees,matchedPostedCreditCents:remitted,
  allocations,witnessDigest:witness,
  status:"mock_only_batch_evidence_shape_match_not_settlement",
  independentProviderConnected:false,independentBankConnected:false,
  claimsCreated:false,sourceAttested:false,settlementCertified:false,
  paidOrdersChanged:false,canMarkPaid:false,canIssueInvoice:false,
  coverageCertified:false};
}
// Privileged internal READ-ONLY orchestration. resolvers MUST be server-only,
// never supplied through request JSON. Does NOT create financial journal/claims.
async function previewHybridLalamoveCodBatch({
 db,tenantId,batchId,orderIds,reviewerUid,
 resolveProviderBatch,resolveIndependentBankCredit,now=new Date()
}={}){
 if(!db||![tenantId,batchId,reviewerUid].every(v=>ID.test(String(v||"")))
  ||!Array.isArray(orderIds)||orderIds.length<2||orderIds.length>MAX_ROWS
  ||new Set(orderIds).size!==orderIds.length
  ||orderIds.some(x=>!ID.test(String(x||"")))
  ||typeof resolveProviderBatch!=="function"
  ||typeof resolveIndependentBankCredit!=="function"
  ||!(now instanceof Date)||!Number.isFinite(now.getTime()))
  throw Error("HYBRID_LALAMOVE_BATCH_BAD_REQUEST");
 const t=db.collection("tenants").doc(tenantId);
 const [tenant,user,...results]=await Promise.all([
  t.get(),db.collection("users").doc(reviewerUid).get(),
  ...orderIds.map(id=>Promise.all([
    t.collection("orders").doc(id).get(),
    t.collection("hybridLalamoveCodCompletionProof").doc(id).get()
  ]))
 ]);
 if(!user.exists||user.data()?.role!=="super_admin"
  ||user.data()?.active!==true)
  throw Error("HYBRID_LALAMOVE_BATCH_SUPER_ADMIN_REQUIRED");
 const data=tenant.data()||{};
 if(!tenant.exists||data.billingPolicyVersion!=="hybrid_v1"
  ||data.hybridBillingEnabled!==true||data.active!==true
  ||data.hybridBillingSuspended===true||data.businessType==="retail"
  ||!SHA.test(data.lalamoveAccountScopeSha256||"")
  ||!SHA.test(data.lalamoveCodRecipientAccountSha256||"")
  ||results.some(([o,p])=>!o.exists||!p.exists))
  throw Error("HYBRID_LALAMOVE_BATCH_TENANT_OR_PROOF_NOT_READY");
 const scope={tenantId,batchId,
  accountScopeSha256:data.lalamoveAccountScopeSha256,
  recipientAccountSha256:data.lalamoveCodRecipientAccountSha256};
 // Independently queried trusted-server sources are ABSENT today;
 // these arguments are injectable test doubles, never production adapters.
 const [provider,bank]=await Promise.all([
  resolveProviderBatch({...scope,orderIds:[...orderIds]}),
  resolveIndependentBankCredit({...scope})
 ]);
 if(provider?.batchId!==batchId)
  throw Error("HYBRID_LALAMOVE_BATCH_REFERENCE_MISMATCH");
 return reconcileHybridLalamoveCodBatch({...scope,provider,bank,now,
  orders:orderIds.map((id,i)=>({orderId:id,
   order:results[i][0].data(),deliveryProof:results[i][1].data()}))});
}
module.exports={reconcileHybridLalamoveCodBatch,previewHybridLalamoveCodBatch};
