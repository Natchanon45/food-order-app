#!/usr/bin/env node
// P2.4 Owner Admin Sales Report, local demo Firebase ONLY.
// No production credit, mail, providers, financial writes or deployment.
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=resolve(import.meta.dirname,"..");
const configPath=resolve(root,".p24-local-sales-emulator.json");
const project="demo-penguin-hybrid",mode=process.argv[2]||"all";
if(!["all","browser"].includes(mode)||existsSync(configPath)||
 process.env.PENGUIN_STAGING_PROJECT_ID||process.env.FIREBASE_PROJECT_ID||
 process.env.VITE_FIREBASE_STAGE==="staging")throw Error("P24_REAL_PROJECT_OR_BAD_MODE");
const cfg=JSON.parse(readFileSync(resolve(root,"firebase.hybrid-emulator.json"),"utf8"));
cfg.emulators.firestore={host:"127.0.0.1",port:8189};
const java="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
const env={...process.env,GCLOUD_PROJECT:project,FUNCTIONS_EMULATOR:"true",
 VITE_USE_FIREBASE_EMULATORS:"true",VITE_HYBRID_DEMO_PAYMENT_E2E:"true",
 VITE_DEMO_FIRESTORE_EMULATOR_PORT:"8189",JAVA_HOME:java,
 PATH:java+"/bin:"+String(process.env.PATH||"")};
for(const k of Object.keys(env))if(k.startsWith("VITE_STAGING_FIREBASE_"))delete env[k];
try{
 writeFileSync(configPath,JSON.stringify(cfg,null,2),{flag:"wx",mode:0o600});
 const command=["node --test --test-concurrency=1 tests/firebase-emulator/p24-merchant-sales-report-browser.spec.mjs"];
 for(const execCmd of command){
  const r=spawnSync("firebase",["emulators:exec","--project",project,
   "--config",configPath,"--only","auth,firestore",execCmd],{
    cwd:root,env,encoding:"utf8",timeout:180000,maxBuffer:25*1024*1024,
   });
  const output=String(r.stdout||"")+"\n"+String(r.stderr||"");
  process.stdout.write(output.split(/\r?\n/).filter(x=>
   /^✔ |^✖|^ℹ (tests|pass|fail)|^Error:|P24_WIDTH_DIAG|P24_OUTER_DIAG|P24_REPORT_DIAG/.test(x)).join("\n")+"\n");
  if(/secretmanager.googleapis.com|Trying to access secret/i.test(output))
   throw Error("P24_EXTERNAL_PAYMENT_SECRET_CALL");
  if(r.status!==0){
   process.stderr.write(output.split(/\r?\n/).filter(x=>
    /^✖|^Error|TimeoutError|AssertionError|^\s+at /.test(x)).slice(-25).join("\n")+"\n");
   process.exitCode=r.status||1;break;
  }
  process.stdout.write("P24_REAL_SIGNED_FIREBASE_BROWSER_PASS_DEMO_ONLY\n");
 }
}finally{
 if(existsSync(configPath))unlinkSync(configPath);
}
