import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

const json = path.resolve("docs/LUKKAJA_BANKALERT_STRIPE_JSX_AUDIT_20261123.json");
const report = path.resolve("docs/LUKKAJA_BANKALERT_STRIPE_JSX_AUDIT_20261123.md");
const matrix = path.resolve("docs/LUKKAJA_TO_PENGUIN_PAGE_MATRIX.json");
const ledger = JSON.parse(fs.readFileSync(json, "utf8"));
const tracker = JSON.parse(fs.readFileSync(matrix, "utf8"));
const old = JSON.parse(fs.readFileSync(
  "docs/LUKKAJA_BANKALERT_STRIPE_JSX_AUDIT_20261122.json", "utf8"));
const source = path.resolve("../lukkhaja_bankalert_stripe");
const hasLocalSource = fs.existsSync(path.join(source, ".git"));
const cmd = (cwd,...args)=>execFileSync("git",args,{cwd,encoding:"utf8"}).trim();
const countPhysicalLines = bytes => bytes.length
  ? bytes.toString("utf8").split(/\r?\n/).length -
    (bytes.at(-1) === 10 ? 1 : 0) : 0;

test("Current pinned audit has complete group arithmetic and correctly scoped source changes",()=>{
 assert.equal(ledger.source.repository,"cosmatch/lukkhaja");
 assert.equal(ledger.target.repository,"Natchanon45/food-order-app");
 assert.equal(ledger.source.branch,"feature/lukkaja_bankalert_stripe");
 assert.equal(ledger.target.branch,"feature/react-firebase-port");
 assert.equal(ledger.priorSourceCommit,old.source.commit);
 assert.equal(ledger.sourceCommits.length,3);
 assert.equal(ledger.sourceCommitsSincePrior,3);
 const sums=(field)=>Object.values(ledger.groups).reduce((n,g)=>n+g[field],0);
 assert.equal(sums("sourceFiles"),156);
 assert.equal(sums("sourceLines"),48954);
 assert.equal(sums("targetFiles"),103);
 assert.equal(sums("targetLines"),36758);
 assert.equal(sums("sourceLines")-sums("priorSourceLines"),454);
 assert.equal(sums("sourceChangedSincePrior"),8);
 assert.equal(sums("newSourceFiles"),2);
 assert.equal(sums("targetAddedSincePrior"),15);
 assert.equal(ledger.delta.sourceRouteFileChanged,false);
 assert.equal(ledger.delta.sourceCommittedApp,"apps/lk-shop");
});
test("The JSX file inventory matches tracked Target paths and current committed LOC",()=>{
 // The audit pins the source-code commit before the audit docs were committed.
 // Later documentation-only commits must not invalidate accurate JSX counts;
 // real JSX changes MUST trigger a new audit before acceptance.
 assert.doesNotThrow(()=>cmd(process.cwd(),"merge-base","--is-ancestor",
  ledger.target.commit,"HEAD"));
 const jsxChanges=cmd(process.cwd(),"diff","--name-only",
  ledger.target.commit+"..HEAD","--",ledger.target.root)
  .split("\n").filter(Boolean).filter(file=>file.endsWith(".jsx"));
 assert.deepEqual(jsxChanges,[],"React JSX has changed since the pinned snapshot");
 const files=cmd(process.cwd(),"ls-files","--",ledger.target.root)
   .split("\n").filter(x=>x.endsWith(".jsx"));
 const scope=files.filter(x=>{
  const rel=x.slice(ledger.target.root.length+1);
  return /^(?:pages|components)\/[^/]+\.jsx$/.test(rel)
    || (!/^(?:pages|components)\//.test(rel) && rel.endsWith(".jsx"));
 });
 const rows=new Map(ledger.files.map(x=>[x.path,x]));
 assert.equal(scope.length,103);
 for(const file of scope){
  const relative=file.slice(ledger.target.root.length+1);
  const row=rows.get(relative);
  assert.ok(row,"missing target JSX in ledger: "+relative);
  assert.equal(row.targetLines,countPhysicalLines(fs.readFileSync(file)),
   "stale target line count: "+relative);
 }
});
test("All 65 source pages retain original phase, current per-file LOC and no invented acceptance",()=>{
 assert.equal(tracker.pages.length,65);
 assert.equal(tracker.capturedAt,ledger.capturedAt);
 assert.equal(tracker.source.commit,ledger.source.commit);
 assert.equal(tracker.target.commit,ledger.target.commit);
 assert.equal(tracker.latestJsxAudit,path.relative(process.cwd(),report));
 assert.equal(tracker.latestJsxAuditJson,path.relative(process.cwd(),json));
 assert.equal(tracker.counts.sourcePageJsx,65);
 assert.equal(tracker.counts.sourceComponentJsx,86);
 assert.equal(tracker.counts.destinationComponentJsx,45);
 const seen=new Set();
 const records=new Map(ledger.files.map(x=>[x.path,x]));
 for(const page of tracker.pages){
  assert.ok(/^P[1-6]-/.test(page.id));
  assert.ok(!seen.has(page.id));
  seen.add(page.id);
  const row=records.get("pages/"+page.filename);
  assert.ok(row,"Missing source page from refreshed matrix");
  assert.equal(page.inventoryCurrent.sourceLines,row.sourceLines);
  assert.equal(page.inventoryCurrent.targetLines,row.targetLines);
  assert.equal(page.inventoryCurrent.sourceCommit,ledger.source.commit);
  assert.equal(page.inventoryCurrent.targetCommit,ledger.target.commit);
 }
 assert.equal(tracker.historicalBaseline.source.commit,old.priorSourceCommit);
 assert.equal(tracker.sourceEvolution.aheadCommits,676);
 assert.deepEqual(tracker.sourceOnlyComponents,
  ledger.files.filter(x=>x.group==="components"&&x.sourceLines!=null&&x.targetLines==null)
   .map(x=>x.path.slice("components/".length)));
});
test("Source JSX changes are exhaustively indexed without copying mobile/Go/SQL into JSX",()=>{
 const changed=ledger.files.filter(x=>x.sourceChangedSincePrior);
 assert.equal(changed.length,8);
 assert.deepEqual(changed.filter(x=>x.newSourceFile).map(x=>x.path).sort(),
  ["components/LKShopPairingPanel.jsx","components/PublicAppDownloads.jsx"]);
 const out=fs.readFileSync(report,"utf8");
 for(const row of changed)assert.ok(out.includes("`"+row.path+"`"),row.path);
 assert.match(out,/\+454/);
 assert.match(out,/Stripe Sandbox/);
 assert.match(out,/Go FCM/);
 assert.match(out,/No Production deploy/);
 assert.ok(!ledger.files.some(x=>/\.dart$|\.go$|\.css$/.test(x.path)));
});
test("When Source checkout exists, snapshot exactly matches its HEAD and all changed JSX",{
 skip:!hasLocalSource},()=>{
 assert.equal(cmd(source,"rev-parse","HEAD"),ledger.source.commit);
 assert.equal(cmd(source,"branch","--show-current"),ledger.source.branch);
 const sourceFiles=cmd(source,"ls-files","--",ledger.source.root)
  .split("\n").filter(x=>x.endsWith(".jsx"));
 const records=ledger.files.filter(x=>x.sourceLines!=null);
 assert.equal(sourceFiles.length,156);
 for(const row of records){
  const f=path.join(source,ledger.source.root,row.path);
  assert.equal(row.sourceLines,countPhysicalLines(fs.readFileSync(f)),row.path);
 }
 const diff=cmd(source,"diff","--name-only",
   ledger.priorSourceCommit+".."+ledger.source.commit,"--",ledger.source.root)
  .split("\n").map(x=>x.slice(ledger.source.root.length+1)).filter(x=>x.endsWith(".jsx")).sort();
 assert.deepEqual(diff,ledger.files.filter(x=>x.sourceChangedSincePrior)
  .map(x=>x.path).sort());
});
