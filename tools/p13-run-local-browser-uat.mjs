#!/usr/bin/env node
// P1.3 staging-readiness replay: LOCAL DEMO EMULATORS ONLY.
// Never uses .firebaserc default, Production Auth, real email or Firebase deploy.
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
const root=resolve(import.meta.dirname,"..");
const temp=resolve(root,".p13f-local-browser-uat-emulator.json");
const project="demo-penguin-hybrid";
const config=JSON.parse(readFileSync(resolve(root,"firebase.hybrid-emulator.json"),"utf8"));
if(process.env.PENGUIN_STAGING_PROJECT_ID||
   process.env.VITE_FIREBASE_STAGE==="staging"||
   process.env.FIREBASE_PROJECT_ID||
   existsSync(temp)) {
 process.stderr.write("P13F_REFUSES_STAGING_PRODUCTION_OR_EXISTING_TEMP_CONFIG\n");
 process.exitCode=3;
}else{
 config.functions={source:"functions"};
 config.emulators.auth={host:"127.0.0.1",port:9099};
 config.emulators.firestore={host:"127.0.0.1",port:8189};
 config.emulators.functions={host:"127.0.0.1",port:5001};
 config.emulators.storage={host:"127.0.0.1",port:9199};
 try{
  writeFileSync(temp,JSON.stringify(config,null,2),{mode:0o600,flag:"wx"});
  const env={...process.env,
   GCLOUD_PROJECT:project,
   VITE_USE_FIREBASE_EMULATORS:"true",
   VITE_HYBRID_DEMO_PAYMENT_E2E:"true",
   VITE_DEMO_FIRESTORE_EMULATOR_PORT:"8189",
   FUNCTIONS_EMULATOR:"true",
  };
  // Firebase Emulator requires JDK 21+. Prefer the installed Homebrew JDK
  // on the authorized Mac mini without touching global Java configuration.
  const homebrewJdk21="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
  if(existsSync(homebrewJdk21+"/bin/java")){
   env.JAVA_HOME=homebrewJdk21;
   env.PATH=homebrewJdk21+"/bin:"+String(env.PATH||"");
  }
  // Explicitly do not permit any staging/Production Firebase override here.
  for(const name of Object.keys(env))
   if(name.startsWith("VITE_STAGING_FIREBASE_"))delete env[name];
  const run=spawnSync("firebase",[
   "emulators:exec","--project",project,
   "--config",temp,"--only","auth,firestore,functions,storage",
   "node --test --test-concurrency=1 tests/firebase-emulator/p1-staging-readiness-real-browser.spec.mjs",
  ],{cwd:root,env,encoding:"utf8",timeout:240000,maxBuffer:20*1024*1024});
  const log=String(run.stdout||"")+"\n"+String(run.stderr||"");
  // Never expose emulator reset/verification tokens or query strings.
  const lines=log.split(/\r?\n/).filter(line=>
   /^✔ real full PENGUIN|^ℹ tests|^ℹ pass|^ℹ fail|^ℹ duration_ms|Error: Script|✖ real full PENGUIN/.test(line)
  );
  process.stdout.write(lines.join("\n")+"\n");
  if(run.error)process.stderr.write("P13F_EMULATOR_PROCESS_ERROR:"+run.error.code+"\n");
  if(/Trying to access secret|secretmanager.googleapis.com/i.test(log)){
   process.stderr.write("P13F_EXTERNAL_SECRET_MANAGER_ATTEMPT_BLOCKED\n");
   process.exitCode=4;
  }else if(run.status!==0){
   const failureLines=log.split(/\r?\n/).filter(line=>
    /^Error:|^✖|^\s*Error:|^\s*at |^i  emulators:|^\s*message:|^⚠  |^\s*assertion:/.test(line)
   ).slice(-18).map(line=>line.replace(/oobCode=[^&\s]+/g,"oobCode=[REDACTED]"));
   process.stderr.write("P13F_REAL_BROWSER_EMULATOR_FAILED\n"+
     failureLines.join("\n")+"\n");
   process.exitCode=run.status||1;
  }else{
   process.stdout.write("P13F_LOCAL_SIGNED_BROWSER_UAT_PASS_NO_REAL_EMAIL\n");
  }
 }finally{
  if(existsSync(temp))unlinkSync(temp);
 }
}
