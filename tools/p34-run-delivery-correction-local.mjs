#!/usr/bin/env node
// Isolated delivery-correction Firebase demo, no Production/connected bank/real order.
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=resolve(import.meta.dirname,".."),tmp=resolve(root,".p34-delivery-correction-demo-emulator.json");
if(existsSync(tmp)||process.env.PENGUIN_STAGING_PROJECT_ID||
 process.env.FIREBASE_PROJECT_ID||process.env.VITE_FIREBASE_STAGE==="staging")
 throw Error("P34_DEMO_ONLY");
const cfg=JSON.parse(readFileSync(resolve(root,"firebase.hybrid-emulator.json"),"utf8"));
cfg.functions={source:"functions"};
for(const [key,port] of [["auth",9099],["firestore",8189],["storage",9199],["functions",5001]])
 cfg.emulators[key]={host:"127.0.0.1",port};
const java="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
const env={...process.env,GCLOUD_PROJECT:"demo-penguin-hybrid",
 VITE_USE_FIREBASE_EMULATORS:"true",VITE_HYBRID_DEMO_PAYMENT_E2E:"true",
 VITE_DEMO_FIRESTORE_EMULATOR_PORT:"8189",FUNCTIONS_EMULATOR:"true",
 JAVA_HOME:java,PATH:java+"/bin:"+String(process.env.PATH||"")};
for(const key of Object.keys(env))if(key.startsWith("VITE_STAGING_FIREBASE_"))delete env[key];
try{
 writeFileSync(tmp,JSON.stringify(cfg,null,2),{flag:"wx",mode:0o600});
 const r=spawnSync("firebase",["emulators:exec","--project","demo-penguin-hybrid",
  "--config",tmp,"--only","auth,firestore,functions,storage",
  "node --test --test-concurrency=1 tests/firebase-emulator/p34-delivery-correction-browser.spec.mjs"],{
  cwd:root,env,encoding:"utf8",maxBuffer:25*1024*1024,timeout:200000});
 const output=String(r.stdout||"")+"\n"+String(r.stderr||"");
 process.stdout.write(output.split(/\r?\n/).filter(x=>
  /^✔ P3.4|^✖ P3.4|^ℹ (tests|pass|fail)|P34_CORRECTION_BROWSER_DIAG/.test(x)).join("\n")+"\n");
 if(r.status!==0){
  process.stderr.write(output.split(/\r?\n/).slice(-60).join("\n")+"\n");
  process.exitCode=r.status||1;
 }else process.stdout.write("P34_SIGNED_DELIVERY_CORRECTION_BROWSER_PASS_LOCAL_ONLY\n");
}finally{if(existsSync(tmp))unlinkSync(tmp);}
