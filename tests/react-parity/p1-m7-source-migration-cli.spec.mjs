import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,rm,stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync,spawnSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {fixture}=require("../fixtures/m7-source-migration.synthetic.cjs");
const binary="tools/m7-source-migration-preflight.mjs";
test("offline CLI does a COMPLETE dry-run with no network or financial credentials, outputs only sanitized report",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"penguin-m7-migration-cli-"));
 try{
  const input=join(directory,"manifest.json"),output=join(directory,"audit-report.json");
  await writeFile(input,JSON.stringify(fixture()),{mode:0o600});
  const printed=execFileSync(process.execPath,[binary,input,"--output",output],
   {cwd:process.cwd(),encoding:"utf8",timeout:10000});
  const result=JSON.parse(printed);
  assert.equal(result.ok,true);
  assert.equal(result.mode,"m7-source-migration-preflight-v1");
  assert.equal(result.structuralIssuesDetected,0);
  assert.equal(result.totalRows,14);
  assert.equal(result.operationalPromotionAllowed,false);
  assert.equal(result.independentBankSourceAuthenticated,false);
  assert.equal(result.operationalCreditPostingAllowed,false);
  assert.equal(result.tenantAccessReleaseAllowed,false);
  assert.deepEqual(JSON.parse(await readFile(output,"utf8")),result);
  assert.equal((await stat(output)).mode&0o777,0o600);
  for(const privateField of ["slip_sha256","verified_source_digest",
    "payment_attempt_id","invoice_key","paid_monthly_invoice_id",
    "source_snapshot_sha256","ref_sha256","approval_sha256"])
   assert.ok(!printed.includes('"'+privateField+'"'),privateField);
  assert.ok(!printed.includes(fixture().tables.merchant_platform_invoice_journal[0].invoice_key));
  // Existing output can NEVER be silently overwritten.
  const second=spawnSync(process.execPath,[binary,input,"--output",output],
   {cwd:process.cwd(),encoding:"utf8",timeout:10000});
  assert.equal(second.status,1);
  assert.ok(!second.stderr.includes("invoice_key"));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test("invalid raw private path is rejected and original file never printed",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"penguin-m7-migration-cli-private-"));
 try{
  const input=join(directory,"raw.json"),source=fixture();
  source.tables.merchant_platform_payment_attempts[0].private_slip_path=
   "/sensitive/personal/slip-number-1234.pdf";
  await writeFile(input,JSON.stringify(source));
  const ran=spawnSync(process.execPath,[binary,input],
   {cwd:process.cwd(),encoding:"utf8",timeout:10000});
  assert.equal(ran.status,1);
  assert.equal(ran.stdout,"");
  assert.match(ran.stderr,/M7_SOURCE_MIGRATION_SOURCE_RAW_PRIVATE_FIELDS_FORBIDDEN/);
  assert.ok(!ran.stderr.includes("sensitive/personal"));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test("ledger amount drift produces exit 2 and non-Paid, never a green migration",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"penguin-m7-migration-cli-drift-"));
 try{
  const input=join(directory,"drift.json"),source=fixture();
  source.tables.merchant_platform_invoice_journal[0].gross_cents=49999;
  await writeFile(input,JSON.stringify(source));
  const ran=spawnSync(process.execPath,[binary,input],
   {cwd:process.cwd(),encoding:"utf8",timeout:10000});
  assert.equal(ran.status,2);
  const r=JSON.parse(ran.stdout);
  assert.equal(r.operationalPromotionAllowed,false);
  assert.ok(r.structuralIssuesDetected>=1);
  assert.ok(r.issueCodes.includes("INVOICE_MONEY_INCONSISTENT"));
 }finally{await rm(directory,{recursive:true,force:true});}
});
