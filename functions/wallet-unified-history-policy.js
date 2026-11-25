"use strict";
// Latest LUKKAJA JSX history contract adapted ONLY to PENGUIN's canonical
// Lalamove credit ledger. Stripe TEST has its own ledger and is never merged
// or represented as real redeemable credit.
const { walletTopupManualReviewAllowed } = require("./finance-manual-review-policy");

const STATUSES = new Set(["pending","approved","rejected"]);
const BANK_CODE = /^01[0-9]{3}$/;
const TOPUP_ID = /^[A-Za-z0-9_-]{8,128}$/;
const MONEY_MAX = 100000000;

function exactSatang(value) {
  const number=Number(value);
  if (!Number.isFinite(number)||number<0||number>MONEY_MAX
    ||Math.abs(number*100-Math.round(number*100))>0.000001) return null;
  return Math.round(number*100);
}
function classifyChannel(topup={}) {
  if(topup.paymentChannel==="bank_transfer") return "bank_transfer";
  if(topup.paymentChannel==="slip_transfer" || BANK_CODE.test(String(topup.paymentChannel||"")))
    return "slip_transfer";
  // The source may introduce Stripe later, but only a REAL Stripe writer
  // authorized by a bank/Stripe webhook may mark it verified. Sandbox uses
  // another store and can never claim to be a real wallet top-up.
  return "unknown";
}
function safeSlip(topup={},tenantId="") {
  const id=String(topup.id||"");
  const path=String(topup.slip?.path||"");
  const prefix=`tenants/${tenantId}/lalamove-wallet-topups/${id}/`;
  if (!TOPUP_ID.test(id)||!path.startsWith(prefix)||path.includes(".."))return null;
  return {path,mime:String(topup.slip?.mime||"").slice(0,80)};
}
function makeHistory(topups=[],transactions=[],tenantId=""){
  const ledgerById=new Map((Array.isArray(transactions)?transactions:[])
    .filter(row=>row&&typeof row.id==="string")
    .map(row=>[row.id,row]));
  return (Array.isArray(topups)?topups:[]).map(row=>{
    const id=String(row.id||"");
    const amountSatang=exactSatang(row.amount);
    const rawStatus=String(row.status||"");
    const status=STATUSES.has(rawStatus)?rawStatus:"under_review";
    const ledger=ledgerById.get(row.walletTransactionId);
    const posted=Boolean(status==="approved" && ledger &&
      ledger.type==="topup" && ledger.direction==="credit" &&
      ledger.reference===`TOPUP:${id}` &&
      exactSatang(ledger.amount)===amountSatang && amountSatang!==null);
    const appealPending=String(row.verificationStatus||"")==="appeal_pending";
    const pending=status==="pending";
    const slip=safeSlip(row,tenantId);
    return {
      id,referenceId:id,
      amountSatang:amountSatang??0,
      amountValid:amountSatang!==null,
      provider:classifyChannel(row),
      // A settled-looking row without independent Ledger evidence is NOT
      // rendered as successful money.
      status:status==="approved"&&!posted?"under_review":status,
      createdAt:row.submittedAt||null,
      verificationStatus:String(row.verificationStatus||"").slice(0,60),
      appealStatus:appealPending?"pending":"",
      reviewNote:status==="rejected"?String(row.reviewNote||"").slice(0,240):"",
      slip,
      reviewable:pending && !appealPending &&
        amountSatang!==null && walletTopupManualReviewAllowed(row),
      rejectable:pending,
      bankEvidenceRequired:appealPending,
      postedToRealWallet:posted,
    };
  });
}
module.exports={exactSatang,classifyChannel,safeSlip,makeHistory};
