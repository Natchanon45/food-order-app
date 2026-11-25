import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {validateWalletHistory,verifyWalletReviewReadback} from
  "../../react-app/src/data/tenantWalletHistory.mjs";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {makeHistory,exactSatang,safeSlip}=require("./wallet-unified-history-policy");
const read=file=>readFileSync(new URL("../../"+file,import.meta.url),"utf8");
const tenantId="test-tenant-w";
const proof={provider:"slip2go",status:"manual_review",reason:"slip2go_bank_error",
 code:"200502",fallbackAllowed:true,amountMatched:null};
function topup(id="wallet-pending",overrides={}){
 return {id,amount:500,status:"pending",paymentChannel:"01004",
  submittedAt:"2026-11-25T03:00:00Z",verificationStatus:"manual_review",
  verificationProvider:"slip2go",ocr:proof,
  slip:{path:`tenants/${tenantId}/lalamove-wallet-topups/${id}/receipt.png`,mime:"image/png"},
  ...overrides};
}
const ledger=id=>({id:"ledger-"+id,reference:"TOPUP:"+id,
 type:"topup",direction:"credit",amount:500});
function view(topups,transactions=[]){
 return {storageReady:true,balance:500,currency:"THB",topups,transactions,
  topupHistory:makeHistory(topups,transactions,tenantId),
  topupHistoryOrigin:"firebase_real_wallet_only"};
}
test("P1.5 Source topup history uses only canonical Lalamove topups and never Stripe TEST",()=>{
 const rows=[topup("p16-ref-old"),topup("p16-ref-two",{paymentChannel:"bank_transfer"}),
 topup("p16-ref-unknown",{paymentChannel:"stripe_promptpay"})];
 const projected=validateWalletHistory(view(rows));
 assert.equal(projected.topupHistory.length,3);
 assert.deepEqual(projected.topupHistory.map(row=>row.provider),[
  "slip_transfer","bank_transfer","unknown"]);
 assert.equal(projected.topupHistory.every(row=>row.postedToRealWallet===false),true);
 assert.equal(projected.topupHistoryOrigin,"firebase_real_wallet_only");
 assert.equal(projected.topupHistory[0].amountSatang,50000);
});
test("P1.5 bank appeal is rejectable but never approvable without authoritative bank evidence",()=>{
 const row=makeHistory([topup("p16-appeal",{verificationStatus:"appeal_pending"})],[],tenantId)[0];
 assert.equal(row.bankEvidenceRequired,true);
 assert.equal(row.reviewable,false);
 assert.equal(row.rejectable,true);
 assert.equal(row.appealStatus,"pending");
});
test("P1.5 mismatched or forged review cannot expose an approval action",()=>{
 const forged=topup("p16-mismatch",{ocr:{...proof,amountMatched:false}});
 const item=makeHistory([forged],[],tenantId)[0];
 assert.equal(item.reviewable,false);
 assert.equal(item.rejectable,true);
 assert.equal(item.status,"pending");
});
test("P1.5 ledger proof is required before displaying successful wallet credit",()=>{
 const base=topup("p16-approved",{status:"approved",walletTransactionId:"ledger-p16-approved"});
 assert.equal(makeHistory([base],[],tenantId)[0].status,"under_review");
 assert.equal(makeHistory([base],[{...ledger(base.id),amount:499}],tenantId)[0].status,"under_review");
 assert.equal(makeHistory([base],[{...ledger(base.id),direction:"debit"}],tenantId)[0].status,"under_review");
 const valid=view([base],[ledger(base.id)]);
 assert.equal(valid.topupHistory[0].status,"approved");
 assert.equal(valid.topupHistory[0].postedToRealWallet,true);
 assert.equal(verifyWalletReviewReadback(valid,base.id,"approve"),valid);
 assert.throws(()=>verifyWalletReviewReadback(view([base],[]),base.id,"approve"),
  /WALLET_REVIEW_WRITE_UNCONFIRMED/);
});
test("P1.5 rejected topups require status proof and never claim a wallet transaction",()=>{
 const row=topup("p16-rejected",{status:"rejected",reviewNote:"Wrong receiver",walletTransactionId:""});
 const valid=view([row]);
 assert.equal(valid.topupHistory[0].status,"rejected");
 assert.equal(valid.topupHistory[0].reviewable,false);
 assert.equal(verifyWalletReviewReadback(valid,row.id,"reject"),valid);
 assert.throws(()=>verifyWalletReviewReadback(view([row], [ledger(row.id)]),row.id,"approve"),
  /WALLET_REVIEW_WRITE_UNCONFIRMED/);
});
test("P1.5 forged/partial history and malformed amount cannot be treated as real money",()=>{
 assert.equal(exactSatang(-1),null);
 assert.equal(exactSatang("NaN"),null);
 assert.equal(exactSatang("12.123"),null);
 assert.equal(exactSatang(12.34),1234);
 assert.equal(safeSlip({id:"x",slip:{url:"https://attacker.example/receipt"}},tenantId),null);
 assert.equal(safeSlip(topup("p16-x",{slip:{path:"tenants/another/lalamove-wallet-topups/p16-x/a.png"}}),tenantId),null);
 const good=view([topup("p16-canonical")]);
 for(const forged of [
  {...good,topupHistoryOrigin:"stripe_sandbox"},
  {...good,topupHistory:[]},
  {...good,topupHistory:[{...good.topupHistory[0],postedToRealWallet:true,status:"approved"}]},
  {...good,topupHistory:[{...good.topupHistory[0],reviewable:true,bankEvidenceRequired:true}]},
 ])assert.throws(()=>validateWalletHistory(forged),/WALLET_HISTORY_CANONICAL/);
});
test("P1.5 latest JSX unified component + Firebase UI show protected actions, separate Sandbox and no auto-approval of appeals",()=>{
 const history=read("react-app/src/components/BankalertStripeHistory.jsx");
 const page=read("react-app/src/pages/AdminTenantsPage.jsx");
 const server=read("functions/tenant-lalamove-wallet.js");
 assert.match(history,/import \{ httpsCallable \} from "firebase\/functions"/);
 assert.match(history,/import \{ functions \} from "@\/firebase\/client"/);
 assert.match(history,/unified = false/);
 assert.match(history,/data-wallet-topup-row/);
 assert.match(history,/wallet-history-channel/);
 assert.match(history,/renderActions\?\.\(item\)/);
 assert.match(page,/<BankalertStripeHistory items=\{wallet\?\.topupHistory\} unified compact/);
 assert.match(page,/PlatformStripeWalletSandboxHistory/);
 assert.match(page,/tenant-wallet-sandbox-separate/);
 assert.match(page,/verifyWalletReviewReadback/);
 assert.match(page,/uncertainWalletReviews/);
 assert.match(page,/data-wallet-refresh/);
 assert.match(page,/refreshWallet\(walletTenant,walletFocusTopupId\)/);
 assert.match(page,/focusReference=\{walletFocusTopupId\}/);
 assert.match(page,/!item\.reviewable/);
 assert.doesNotMatch(page,/getDownloadURL\(storageRef\(storage, path\)\) : directUrl/);
 assert.match(server,/WALLET_APPEAL_BANK_EVIDENCE_REQUIRED/);
 assert.match(server,/topupHistoryOrigin: "firebase_real_wallet_only"/);
 const sandbox=read("functions/stripe-wallet-sandbox-checkout.js");
 assert.match(sandbox,/getPlatformStripeWalletSandboxHistory=onCall\(\s*\{region:"asia-southeast1",timeoutSeconds:25\}/);
 assert.match(sandbox,/if\(!viewAllowed\|\|configuredTenant!==tenantId\)/);
 assert.doesNotMatch(sandbox,/getPlatformStripeWalletSandboxHistory=onCall\(options/);
});
