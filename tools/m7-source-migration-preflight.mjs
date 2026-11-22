#!/usr/bin/env node
// Offline, READ-ONLY M7 source migration preflight. Never connects to DB,
// Stripe or Firebase. stdout contains only sanitized diagnostic metadata.
import {readFile,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const contract=require("../functions/m7-source-migration-contract.js");
function usage(){
 return "Usage: node tools/m7-source-migration-preflight.mjs <sanitized-source-manifest.json> [--output <sanitized-report.json>]\n"+
  "READ-ONLY: no SQL execution, no Firestore promotion, no bank or credit writes.\n";
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==1&&args.length!==3||args[0]?.startsWith("-")||
    args.length===3&&args[1]!=="--output"||
    args.length===3&&(!args[2]||args[2]===args[0]))
  throw Error("CLI_ARGUMENTS_INVALID");
 const file=args[0];
 const bytes=await readFile(file);
 if(bytes.byteLength>contract.LIMITS.bytes)throw Error("M7_MIGRATION_MANIFEST_TOO_LARGE");
 const parsed=JSON.parse(bytes.toString("utf8"));
 const report=contract.inspect(parsed);
 const sanitized=JSON.stringify(report,null,2)+"\n";
 if(args.length===3)await writeFile(args[2],sanitized,{flag:"wx",mode:0o600});
 process.stdout.write(sanitized);
 // A syntactically valid export can be worth reviewing with structural
 // inconsistencies; exit 2 prevents green CI status in that situation.
 if(report.structuralIssuesDetected!==0)process.exitCode=2;
}
main().catch(error=>{
 const permitted=new Set(["CLI_ARGUMENTS_INVALID","M7_MIGRATION_MANIFEST_TOO_LARGE"]);
 const label=permitted.has(error?.message)?error.message:
  /^M7_SOURCE_MIGRATION_[A-Z_]+$/.test(error?.message||"")
    ?error.message:"M7_MIGRATION_PREFLIGHT_FAILED";
 process.stderr.write(label+"\n"+usage());
 process.exitCode=1;
});
