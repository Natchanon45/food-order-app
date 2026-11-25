#!/usr/bin/env node
// P3.2 local signed Kitchen acceptance. No real provider, Production,
// real email, bank settlement, external Stripe/Lalamove call or deployment.
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=resolve(import.meta.dirname,".."),tmp=resolve(root,".p32-kitchen-demo-emulator.json");
if(existsSync(tmp)||process.env.PENGUIN_STAGING_PROJECT_ID||
  process.env.FIREBASE_PROJECT_ID||process.env.VITE_FIREBASE_STAGE==="staging")
 throw Error("P32_DEMO_LOCAL_ONLY");
const cfg=JSON.parse(readFileSync(resolve(root,"firebase.hybrid-emulator.json"),"utf8"));
cfg.functions={source:"functions"};
for(const [key,port] of [["auth",9099],["firestore",8189],["functions",5001],["storage",9199]])
 cfg.emulators[key]={host:"127.0.0.1",port};
const java="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
const env={...process.env,GCLOUD_PROJECT:"demo-penguin-hybrid",
 VITE_USE_FIREBASE_EMULATORS:"true",VITE_HYBRID_DEMO_PAYMENT_E2E:"true",
 VITE_DEMO_FIRESTORE_EMULATOR_PORT:"8189",FUNCTIONS_EMULATOR:"true",
 JAVA_HOME:java,PATH:java+"/bin:"+String(process.env.PATH||"")};
for(const key of Object.keys(env))
 if(key.startsWith("VITE_STAGING_FIREBASE_"))delete env[key];
try{
 writeFileSync(tmp,JSON.stringify(cfg,null,2),{flag:"wx",mode:0o600});
 const command="node --test --test-concurrency=1 tests/firebase-emulator/p32-kitchen-signed-browser.spec.mjs";
 const r=spawnSync("firebase",["emulators:exec","--project","demo-penguin-hybrid",
  "--config",tmp,"--only","auth,firestore,functions,storage",command],{
   cwd:root,env,encoding:"utf8",maxBuffer:30*1024*1024,timeout:230000});
 const output=String(r.stdout||"")+"\n"+String(r.stderr||"");
 process.stdout.write(output.split(/\r?\n/).filter(x=>
   /^✔ |^✖|^ℹ (tests|pass|fail)|^Error:|P32_BROWSER_DIAG|P32_ERROR_DIAG/.test(x)).join("\n")+"\n");
 if(/Trying to access secret|secretmanager.googleapis.com/i.test(output))
  throw Error("P32_ATTEMPTED_EXTERNAL_SECRET");
 if(r.status!==0){
  process.stderr.write(output.split(/\r?\n/).filter(x=>
   /^✖|^Error:|AssertionError|TimeoutError|^\\s+at /.test(x)).slice(-30).join("\n")+"\n");
  process.exitCode=r.status||1;
 }else process.stdout.write("P32_SIGNED_CASHIER_BROWSER_PASS_DEMO_ONLY\n");
}finally{if(existsSync(tmp))unlinkSync(tmp);}
