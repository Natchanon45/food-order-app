import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID,createHash} from "node:crypto";
const project="demo-penguin-hybrid";
if(process.env.GCLOUD_PROJECT!==project||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||""))throw Error("LOCAL_DEMO_FIRESTORE_REQUIRED");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp}=require("firebase-admin/app"),{getFirestore}=require("firebase-admin/firestore");
initializeApp({projectId:project});
const db=getFirestore(),fn=require("./platform-connect-pairing");
const uid="connect-test-"+randomUUID(),other="connect-test-"+randomUUID(),auth={uid};
const root=db.collection("platformPrivateSettings").doc("connectPairingUatV1");
const http=async(name,method,token)=>{
 const response={set:()=>response,status:n=>{response.code=n;return response;},json:value=>{response.data=value;return response;}};
 await fn[name]({method,get:key=>key==="authorization"?"Bearer "+token:""},response);
 return response;
};
test("isolated Firestore central pairing: authorization, three slots, check, self-unpair and admin revoke",async()=>{
 await db.collection("users").doc(uid).set({role:"super_admin",active:true});
 await db.collection("users").doc(other).set({role:"owner",active:true});
 await assert.rejects(fn.getPlatformConnectPairing.run({data:{}}),{code:"unauthenticated"});
 await assert.rejects(fn.createPlatformConnectPairing.run({auth:{uid:other},data:{label:"Demo"}}),{code:"permission-denied"});
 const results=await Promise.allSettled(Array.from({length:4},(_,i)=>fn.createPlatformConnectPairing.run({auth,data:{label:"Fixture "+i}})));
 const pairs=results.filter(x=>x.status==="fulfilled").map(x=>x.value);
 assert.equal(pairs.length,3,results.filter(x=>x.status==="rejected").map(x=>String(x.reason?.code)+":"+String(x.reason?.message)).join("; "));
 const p=pairs[0],hash=createHash("sha256").update(p.pairingToken).digest("hex");
 const listing=await fn.getPlatformConnectPairing.run({auth,data:{}});
 assert.equal(listing.devices.length,3);assert.equal(listing.notificationEnabled,false);
 assert.equal(JSON.stringify(listing).includes(p.pairingToken),false);
 assert.equal(JSON.stringify(listing).includes(hash),false);
 assert.equal((await root.collection("keys").doc(hash).get()).exists,true);
 const check=await http("platformConnectDeviceStatus","GET",p.pairingToken);
 assert.equal(check.code,200);assert.equal(check.data.connected,true);assert.equal(check.data.paymentVerified,false);
 assert.equal((await fn.getPlatformConnectPairing.run({auth,data:{}})).devices.find(d=>d.id===p.deviceId).connected,true);
 assert.equal((await http("platformConnectDeviceStatus","POST",p.pairingToken)).code,405);
 assert.equal((await http("platformConnectDeviceUnpair","POST",p.pairingToken)).code,200);
 assert.equal((await http("platformConnectDeviceStatus","GET",p.pairingToken)).code,401);
 assert.equal((await root.collection("keys").doc(hash).get()).exists,false);
 await fn.revokePlatformConnectPairing.run({auth,data:{deviceId:pairs[1].deviceId}});
 assert.equal((await http("platformConnectDeviceStatus","GET",pairs[1].pairingToken)).code,401);
 assert.equal((await fn.getPlatformConnectPairing.run({auth,data:{}})).devices.length,1);
});

test("same device API accepts isolated merchant pairing and preserves platform scope",async()=>{
 const ids=[randomUUID(),randomUUID()],users=ids.map(id=>({uid:"owner-"+id}));
 for(let i=0;i<2;i++){
  await db.collection("tenants").doc(ids[i]).set({active:true});
  await db.collection("users").doc(users[i].uid).set({role:i===0?"admin":"owner",active:true,tenantId:ids[i]});
 }
 const call=(name,i,data={})=>fn[name].run({auth:users[i],data:{scope:"tenant",...data}});
 const pair=await call("createPlatformConnectPairing",0,{label:"Merchant fixture"});
 assert.equal(pair.scope,"tenant");assert.equal(pair.notificationEnabled,false);
 assert.equal((await call("getPlatformConnectPairing",0)).devices.length,1);
 assert.equal((await call("getPlatformConnectPairing",1)).devices.length,0);
 assert.equal((await fn.getPlatformConnectPairing.run({auth,data:{}})).devices.some(d=>d.id===pair.deviceId),false);
 const connected=await http("platformConnectDeviceStatus","GET",pair.pairingToken);
 assert.equal(connected.code,200);assert.equal(connected.data.scope,"tenant");assert.equal(connected.data.paymentVerified,false);
 assert.equal((await call("getPlatformConnectPairing",0)).devices[0].connected,true);
 assert.equal((await http("platformConnectDeviceUnpair","POST",pair.pairingToken)).code,200);
 assert.equal((await http("platformConnectDeviceStatus","GET",pair.pairingToken)).code,401);
});
