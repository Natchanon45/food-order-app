#!/usr/bin/env node
// P2.2 isolated Firebase Demo + real Chrome. NO production, no Go/SQL writes.
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=resolve(import.meta.dirname,"..");
const configPath=resolve(root,".p22-local-store-master-emulator.json");
const project="demo-penguin-hybrid";
const mode=process.argv[2]||"all";
if(!["all","backend","browser"].includes(mode))throw Error("P22_MODE_INVALID");
if(existsSync(configPath) || process.env.PENGUIN_STAGING_PROJECT_ID ||
 process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_STAGE==="staging")
 throw Error("P22_REFUSES_REAL_FIREBASE_OR_EXISTING_TEMP");
const config=JSON.parse(readFileSync(resolve(root,"firebase.hybrid-emulator.json"),"utf8"));
config.emulators.firestore={host:"127.0.0.1",port:8189};
const java="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
const env={...process.env,GCLOUD_PROJECT:project,FUNCTIONS_EMULATOR:"true",
 JAVA_HOME:java,PATH:java+"/bin:"+String(process.env.PATH||"")};
for(const k of Object.keys(env))if(k.startsWith("VITE_STAGING_FIREBASE_"))delete env[k];
const jobs=[];
if(mode!=="browser")jobs.push({name:"P22_OWNER_ADMIN_FIRESTORE_STORAGE",command:"firebase",
 args:["emulators:exec","--project",project,"--config",configPath,"--only","auth,firestore,storage",
 "node --test --test-concurrency=1 tests/firebase-emulator/p22-merchant-store-storage.spec.mjs"]});
if(mode!=="backend")jobs.push({name:"P22_REAL_CHROME_BRAND_QR",command:"node",
 args:["--test","--test-concurrency=1","tests/react-parity/p22-merchant-store-qr-browser.spec.mjs"]});
try{
 writeFileSync(configPath,JSON.stringify(config,null,2),{flag:"wx",mode:0o600});
 for(const job of jobs){
  const r=spawnSync(job.command,job.args,{cwd:root,env,encoding:"utf8",timeout:180000,maxBuffer:20*1024*1024});
  const output=String(r.stdout||"")+"\n"+String(r.stderr||"");
  process.stdout.write(job.name+"\n"+output.split(/\r?\n/)
   .filter(s=>/^✔ |^✖|^ℹ (tests|pass|fail)|^Error:/.test(s)).join("\n")+"\n");
  if(/secretmanager.googleapis.com|Trying to access secret|quickchart.io\/qr/i.test(output))
   throw Error("P22_EXTERNAL_PAYMENT_OR_QR_NETWORK_BLOCKED");
  if(r.status!==0){
   process.stderr.write(output.split(/\r?\n/).filter(s=>
    /^✖|AssertionError|TimeoutError|^Error|^\s+at /.test(s)).slice(-25).join("\n")+"\n");
   process.exitCode=r.status||1;break;
  }
  process.stdout.write(job.name+"_PASS_LOCAL_ONLY\n");
 }
}finally{
 if(existsSync(configPath))unlinkSync(configPath);
}
