#!/usr/bin/env node
// Purely offline readiness inventory. Never invokes firebase CLI, provider
// APIs, DNS or sends email. Exit 2 means explicit staging setup is BLOCKED.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {readStagingFirebaseConfig} from "../react-app/src/firebase/stagingConfig.mjs";

const cwd=resolve(import.meta.dirname,"..");
const safeRead=path=>JSON.parse(readFileSync(resolve(cwd,path),"utf8"));
const firebaserc=safeRead(".firebaserc");
const productionId=String(firebaserc?.projects?.default||"").trim();
const stagingId=String(firebaserc?.projects?.staging||"").trim();
const blockers=[];
if(!productionId)blockers.push("FIREBASE_PRODUCTION_DEFAULT_NOT_IDENTIFIED");
if(!stagingId)blockers.push("DEDICATED_STAGING_FIREBASE_ALIAS_MISSING");
if(stagingId===productionId&&productionId)
 blockers.push("STAGING_ALIAS_MATCHES_PRODUCTION");
if(stagingId.startsWith("demo-"))
 blockers.push("STAGING_ALIAS_IS_ONLY_AN_EMULATOR_PROJECT");
let config=null;
try{
 config=readStagingFirebaseConfig(process.env,{projectId:productionId});
 if(stagingId&&config.projectId!==stagingId)
  blockers.push("STAGING_WEB_PROJECT_DOES_NOT_MATCH_STAGING_ALIAS");
}catch(error){
 blockers.push(String(error?.message||"STAGING_WEB_CONFIG_INVALID"));
}
const report={
 audit:"P1.3_STAGING_OFFLINE_PREFLIGHT",
 status:blockers.length?"blocked":"config_ready_for_authorized_qa",
 hasProductionDefault:Boolean(productionId),
 hasDedicatedStagingAlias:Boolean(stagingId&&stagingId!==productionId&&
  !stagingId.startsWith("demo-")),
 hasValidatedStagingWebConfig:Boolean(config),
 requiresRealProviderEmailUat:true,
 requiresSignedBrowserAndFunctionsUat:true,
 deployApproved:false,
 externalServicesContacted:false,
 emailSent:false,
 blockers,
};
process.stdout.write(JSON.stringify(report,null,2)+"\n");
if(blockers.length)process.exitCode=2;
