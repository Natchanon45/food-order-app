#!/usr/bin/env node
// Local-only P2.3 Firebase Auth/Firestore and Chrome UAT. No real email,
// provider, Production, or app deployment. Reject non-demo project settings.
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=resolve(import.meta.dirname,".."),temp=resolve(root,".p23-merchant-local-emulator.json");
const mode=process.argv[2]||"all";
if(!["all","backend","browser"].includes(mode))throw Error("P23_MODE_INVALID");
if(existsSync(temp)||process.env.PENGUIN_STAGING_PROJECT_ID||
 process.env.FIREBASE_PROJECT_ID||process.env.VITE_FIREBASE_STAGE==="staging")
 throw Error("P23_LIVE_PROJECT_OR_TEMP_REJECTED");
const project="demo-penguin-hybrid";
const config=JSON.parse(readFileSync(resolve(root,"firebase.hybrid-emulator.json"),"utf8"));
config.emulators.firestore={host:"127.0.0.1",port:8189};
const java="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
const env={...process.env,GCLOUD_PROJECT:project,FUNCTIONS_EMULATOR:"true",
 JAVA_HOME:java,PATH:java+"/bin:"+String(process.env.PATH||"")};
for(const key of Object.keys(env))if(key.startsWith("VITE_STAGING_FIREBASE_"))delete env[key];
const jobs=[];
if(mode!=="browser")jobs.push({
 name:"P23_DEMO_AUTH_FIRESTORE_SIGNUP",
 command:"firebase",
 args:["emulators:exec","--project",project,"--config",temp,"--only","auth,firestore",
 "node --test --test-concurrency=1 tests/firebase-emulator/p23-merchant-signup-activation.spec.mjs"],
});
if(mode!=="backend")jobs.push({
 name:"P23_CHROME_LOGIN_REGISTER",
 command:"node",args:["--test","--test-concurrency=1",
 "tests/react-parity/p23-merchant-login-browser.spec.mjs",
 "tests/react-parity/p23-merchant-registration-browser.spec.mjs"],
});
try{
 writeFileSync(temp,JSON.stringify(config,null,2),{flag:"wx",mode:0o600});
 for(const job of jobs){
  const res=spawnSync(job.command,job.args,{cwd:root,env,encoding:"utf8",
   timeout:190000,maxBuffer:25*1024*1024});
  const output=String(res.stdout||"")+"\n"+String(res.stderr||"");
  process.stdout.write(job.name+"\n"+output.split(/\r?\n/)
   .filter(s=>/^✔ |^✖|^ℹ (tests|pass|fail)|^Error:/.test(s)).join("\n")+"\n");
  if(/secretmanager.googleapis.com|Trying to access secret|Sending live email/i.test(output))
   throw Error("P23_EXTERNAL_PROVIDER_REQUEST_BLOCKED");
  if(res.status!==0){
   process.stderr.write(output.split(/\r?\n/).filter(s=>
    /^✖|^Error|TimeoutError|AssertionError|^\s+at /.test(s)).slice(-32).join("\n")+"\n");
   process.exitCode=res.status||1;break;
  }
  process.stdout.write(job.name+"_PASS_DEMO_ONLY\n");
 }
}finally{if(existsSync(temp))unlinkSync(temp);}
