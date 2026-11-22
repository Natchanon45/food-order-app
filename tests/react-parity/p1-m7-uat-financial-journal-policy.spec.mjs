import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {fixture,H}=require("../fixtures/m7-source-migration.synthetic.cjs");
const ledger=require("../../functions/m7-uat-operational-ledger-policy.js");
const journal=require("../../functions/m7-uat-financial-journal-policy.js");
const clone=x=>structuredClone(x);
test("UAT Source export generates balanced 7-leg immutable double-entry shadow; BANK still not verified",()=>{
 const r=ledger.plan(fixture()).shadow;
 const j=r.unverifiedDoubleEntryJournal;
 assert.equal(j.version,journal.VERSION);
 assert.equal(j.entryCount,3);
 assert.equal(j.legCount,7);
 assert.equal(j.totalDebitCents,115220);
 assert.equal(j.totalCreditCents,115220);
 assert.equal(j.operationalPostingAllowed,false);
 assert.equal(j.sourceBankAuthenticated,false);
 assert.equal(j.creditLiabilityCertified,false);
 assert.equal(j.balancedProjectionOnly,true);
 const group=Object.groupBy(j.legs,i=>i.invoiceDigest);
 assert.equal(Object.keys(group).length,3);
 for(const legs of Object.values(group)){
  assert.equal(legs.reduce((s,x)=>s+x.debitCents,0),
   legs.reduce((s,x)=>s+x.creditCents,0));
  assert.ok(legs.every(x=>x.operationalPosting===false));
  assert.ok(legs.every(x=>x.sourceBankAuthenticated===false));
 }
 assert.ok(j.legs.some(x=>x.account===journal.ACCOUNTS.BANK&&
  x.creditCents===50000));
 assert.ok(j.legs.some(x=>x.account===journal.ACCOUNTS.RESIDUAL&&
  x.creditCents===15220));
 assert.equal(journal.verify(j,r.financialItems,r.sourceManifestDigest),true);
 assert.match(j.closedDigest,/^[a-f0-9]{64}$/);
});
test("journal hash-chain immutable across invoice order, changes in bank or credit are detected",()=>{
 const shadow=ledger.plan(fixture()).shadow;
 const same=journal.build([...shadow.financialItems].reverse(),
  shadow.sourceManifestDigest);
 assert.deepEqual(same,shadow.unverifiedDoubleEntryJournal);
 for(const change of [
  j=>j.legs[0].debitCents++,
  j=>j.legs[1].account="operational_bank_cash",
  j=>j.closedDigest=H("f"),
  j=>j.legs[0].sourceBankAuthenticated=true,
  j=>j.operationalPostingAllowed=true,
 ]){
  const j=clone(shadow.unverifiedDoubleEntryJournal);change(j);
  assert.throws(()=>journal.verify(j,shadow.financialItems,shadow.sourceManifestDigest),
    /UNTRUSTED_VIEW|INTEGRITY_CHANGED/);
 }
 const changed=clone(shadow.financialItems);
 changed[0].sourceBankReportedCents+=1;
 assert.throws(()=>journal.build(changed,shadow.sourceManifestDigest),
  /UNBALANCED_INVOICE/);
});
test("forged sum, overflow and duplicate invoice cannot construct a balanced journal",()=>{
 const f=ledger.plan(fixture()).shadow;
 const rows=clone(f.financialItems);
 assert.throws(()=>journal.build([...rows,rows[0]],f.sourceManifestDigest),
  /INVOICE_SCOPE_OR_DUPLICATE/);
 assert.throws(()=>journal.build([{...rows[0],grossCents:1}],f.sourceManifestDigest),
  /UNBALANCED_INVOICE/);
 const huge={...rows[0],grossCents:Number.MAX_SAFE_INTEGER,
  appliedCreditCents:Number.MAX_SAFE_INTEGER,
  sourceBankReportedCents:0,arithmeticResidualCents:0};
 assert.throws(()=>journal.build([huge,huge],f.sourceManifestDigest),
  /INVOICE_SCOPE_OR_DUPLICATE|TOTAL_OVERFLOW/);
 assert.throws(()=>journal.build(rows,"forged"),
  /BOUNDS/);
});
test("UAT shadow history rejects journal tamper before reporting any paid money",()=>{
 const f=ledger.plan(fixture()).shadow;
 const fake=clone(f);
 fake.unverifiedDoubleEntryJournal.legs[0].debitCents+=100;
 assert.throws(()=>ledger.safeView(fake),/UNTRUSTED_SHADOW_JOURNAL/);
 assert.equal(f.financialPostingAuthorized,false);
});
