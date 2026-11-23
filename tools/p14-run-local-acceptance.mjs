#!/usr/bin/env node
// P1.4 self-contained local acceptance. No production Firebase project,
// real email, webhook, Stripe payment, source writes or deploy command.
// It runs isolated demo Emulators TWICE so the fixed legacy target IDs cannot
// collide between the SaaS/backend tests and real Browser test.
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=resolve(import.meta.dirname,"..");
const temp=resolve(root,".p14-local-acceptance-emulator.json");
const DEMO="demo-penguin-hybrid";
const mode=process.argv[2]||"all";
if(!["all","backend","browser"].includes(mode))throw Error("P14_LOCAL_ACCEPTANCE_MODE_INVALID");
if(existsSync(temp)||process.env.VITE_FIREBASE_STAGE==="staging"||
   process.env.FIREBASE_PROJECT_ID||process.env.PENGUIN_STAGING_PROJECT_ID){
 process.stderr.write("P14_LOCAL_ACCEPTANCE_REFUSES_PRODUCTION_STAGING_OR_TEMP_CONFIG\n");
 process.exitCode=3;
}else{
 const cfg=JSON.parse(readFileSync(resolve(root,"firebase.hybrid-emulator.json"),"utf8"));
 cfg.functions={source:"functions"};
 cfg.emulators.auth={host:"127.0.0.1",port:9099};
 cfg.emulators.firestore={host:"127.0.0.1",port:8189};
 cfg.emulators.functions={host:"127.0.0.1",port:5001};
 cfg.emulators.storage={host:"127.0.0.1",port:9199};
 const java21="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
 const env={...process.env,
  GCLOUD_PROJECT:DEMO,
  VITE_USE_FIREBASE_EMULATORS:"true",
  VITE_HYBRID_DEMO_PAYMENT_E2E:"true",
  VITE_DEMO_FIRESTORE_EMULATOR_PORT:"8189",
  FUNCTIONS_EMULATOR:"true",
 };
 for(const key of Object.keys(env))
  if(key.startsWith("VITE_STAGING_FIREBASE_"))delete env[key];
 if(existsSync(java21+"/bin/java")){
  env.JAVA_HOME=java21;
  env.PATH=java21+"/bin:"+String(env.PATH||"");
 }
 const jobs=[
  {name:"P14_FIRESTORE_POLICY",services:"firestore",
   command:"node --test --test-concurrency=1 tests/firebase-emulator/p1-payment-history-threshold.spec.mjs tests/firebase-emulator/p1-saas-inspection.spec.mjs tests/firebase-emulator/p14-pricing-guard.spec.mjs"},
  {name:"P14_REAL_BROWSER",services:"auth,firestore,functions,storage",
   command:"node --test --test-concurrency=1 tests/firebase-emulator/p14-pricing-saas-real-browser.spec.mjs"},
 ].filter(job=>mode==="all"||(mode==="backend"?job.name==="P14_FIRESTORE_POLICY":
   job.name==="P14_REAL_BROWSER"));
 try{
  writeFileSync(temp,JSON.stringify(cfg,null,2),{mode:0o600,flag:"wx"});
  for(const job of jobs){
   const result=spawnSync("firebase",[
    "emulators:exec","--project",DEMO,"--config",temp,
    "--only",job.services,job.command,
   ],{cwd:root,env,encoding:"utf8",timeout:240_000,maxBuffer:25*1024*1024});
   const output=String(result.stdout||"")+"\n"+String(result.stderr||"");
   const summary=output.split(/\r?\n/).filter(line=>
    /^✔ (P1\.4|P1\.4 |SaaS |ALL old SaaS|Premium |future Delivery|only active|a valid Premium|read-only preview|actual Firestore|actual Firestore threshold|Stripe callable)|^ℹ (tests|pass|fail)|^✖|^Error: Script/.test(line)
   );
   process.stdout.write(job.name+"\n"+summary.join("\n")+"\n");
   if(/Trying to access secret|secretmanager.googleapis.com/i.test(output)){
    process.stderr.write(job.name+"_EXTERNAL_SECRET_MANAGER_ATTEMPT_BLOCKED\n");
    process.exitCode=4;break;
   }
   if(result.status!==0){
    const faults=output.split(/\r?\n/).filter(line=>
     /^Error:|^✖|^\s+Error:|^\s+at |^\s+AssertionError/.test(line)
    ).slice(-15).map(line=>line.replace(/oobCode=[^&\s]+/g,"oobCode=[REDACTED]"));
    process.stderr.write(job.name+"_FAILED\n"+faults.join("\n")+"\n");
    process.exitCode=result.status||1;break;
   }
   process.stdout.write(job.name+"_PASS_LOCAL_DEMO_ONLY\n");
  }
 }finally{if(existsSync(temp))unlinkSync(temp);}
}
