import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {initializeApp,deleteApp} from "firebase/app";
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword} from "firebase/auth";
import {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc} from "firebase/firestore";
import {getStorage,connectStorageEmulator,uploadBytes,ref as storageRef,getDownloadURL} from "firebase/storage";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp:adminInit,getApps:adminApps}=require("firebase-admin/app");
const {getAuth:adminAuth}=require("firebase-admin/auth");
const {getFirestore:adminFirestore}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8189"||
 process.env.FIREBASE_STORAGE_EMULATOR_HOST!=="127.0.0.1:9199")
 throw Error("P22_FIREBASE_EMULATOR_ISOLATION_REQUIRED");
if(!adminApps().length)adminInit({projectId:"demo-penguin-hybrid"});
const db=adminFirestore(),suffix=randomUUID().slice(0,9),
 tenantId="p22-store-"+suffix,foreignTenantId="p22-other-"+suffix,
 password="OnlyDemoEmulator12345!";
const png=Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9UppLFEAAAAASUVORK5CYII=","base64"));
async function client(name){
 const app=initializeApp({apiKey:"demo-only",projectId:"demo-penguin-hybrid",
  storageBucket:"demo-penguin-hybrid.appspot.com",
  authDomain:"demo-penguin-hybrid.firebaseapp.com",appId:"1:123:web:"+suffix},
  "p22-"+name+"-"+suffix);
 const auth=getAuth(app);
 connectAuthEmulator(auth,"http://127.0.0.1:9099",{disableWarnings:true});
 const firestore=getFirestore(app);connectFirestoreEmulator(firestore,"127.0.0.1",8189);
 const storage=getStorage(app);connectStorageEmulator(storage,"127.0.0.1",9199);
 if(name!=="anon")await signInWithEmailAndPassword(auth,name+"-"+suffix+"@example.test",password);
 return {app,firestore,storage};
}
const create=async(name,role,tenant)=> {
 const uid="p22-"+name+"-"+suffix,email=name+"-"+suffix+"@example.test";
 await adminAuth().createUser({uid,email,password,emailVerified:true});
 await db.collection("users").doc(uid).set({uid,email,active:true,role,tenantId:tenant});
 return uid;
};
test("P2.2 tenant Store settings and logo/cover Storage persist and reject unauthorized roles",{
 timeout:90000,
},async()=>{
 const owner=await create("owner","owner",tenantId);
 await create("admin","admin",tenantId);
 await create("cashier","cashier",tenantId);
 const foreignOwner=await create("foreign","owner",foreignTenantId);
 await Promise.all([
  db.collection("tenants").doc(tenantId).set({id:tenantId,ownerUid:owner,active:true,
    businessUnits:["order_delivery"],slug:"p22-shop-"+suffix}),
  db.collection("tenants").doc(foreignTenantId).set({id:foreignTenantId,
    ownerUid:foreignOwner,active:true,businessUnits:["order_delivery"]}),
 ]);
 const clients=[];
 try{
  const ownerClient=await client("owner");clients.push(ownerClient.app);
  const settingsRef=doc(ownerClient.firestore,"tenants",tenantId,"settings","store");
  const payload={shopName:"P22 ร้านทดสอบ",shopAddress:"กรุงเทพฯ",
   shopHeroFocusX:50,shopHeroFocusY:76,
   shopLogoUrl:"https://cdn.example.test/logo.webp",
   shopHeroImageUrl:"https://cdn.example.test/cover.webp",
   deliveryPromptPayEnabled:true,deliveryCodEnabled:false,
   bankName:"SCB",bankAccountNumber:"1234567890",bankAccountName:"บัญชีทดสอบ"};
  await setDoc(settingsRef,payload,{merge:true});
  const saved=(await getDoc(settingsRef)).data();
  assert.equal(saved.shopName,payload.shopName);
  assert.equal(saved.shopHeroFocusY,76);
  assert.equal(saved.bankAccountNumber,payload.bankAccountNumber);
  const logo=storageRef(ownerClient.storage,`tenants/${tenantId}/product-images/store-branding/logo-${suffix}.png`);
  const cover=storageRef(ownerClient.storage,`tenants/${tenantId}/product-images/store-branding/cover-${suffix}.png`);
  await uploadBytes(logo,png,{contentType:"image/png"});
  await uploadBytes(cover,png,{contentType:"image/png"});
  assert.match(await getDownloadURL(cover),/cover-/);
  const admin=await client("admin");clients.push(admin.app);
  await setDoc(doc(admin.firestore,"tenants",tenantId,"settings","store"),{shopPhone:"0811111111"},{merge:true});
  assert.equal((await getDoc(settingsRef)).data().shopPhone,"0811111111");
  const cashier=await client("cashier");clients.push(cashier.app);
  await assert.rejects(setDoc(doc(cashier.firestore,"tenants",tenantId,"settings","store"),
    {shopHeroFocusY:0},{merge:true}),e=>e.code==="permission-denied");
  await assert.rejects(uploadBytes(storageRef(cashier.storage,
   `tenants/${tenantId}/product-images/store-branding/forbidden.png`),png,{contentType:"image/png"}),
    e=>String(e.code).includes("unauthorized"));
  const foreign=await client("foreign");clients.push(foreign.app);
  await assert.rejects(setDoc(doc(foreign.firestore,"tenants",tenantId,"settings","store"),
   {shopHeroFocusY:0},{merge:true}),e=>e.code==="permission-denied");
  await assert.rejects(uploadBytes(storageRef(foreign.storage,
   `tenants/${tenantId}/product-images/store-branding/foreign.png`),png,{contentType:"image/png"}),
    e=>String(e.code).includes("unauthorized"));
  const anon=await client("anon");clients.push(anon.app);
  await assert.rejects(setDoc(doc(anon.firestore,"tenants",tenantId,"settings","store"),
   {shopName:"hijack"},{merge:true}),e=>e.code==="permission-denied");
  const final=(await db.collection("tenants").doc(tenantId).collection("settings").doc("store").get()).data();
  assert.equal(final.shopHeroFocusY,76);
  assert.equal(final.shopName,payload.shopName);
  assert.equal(final.shopPhone,"0811111111");
  assert.equal((await db.collection("tenants").doc(foreignTenantId)
   .collection("settings").doc("store").get()).exists,false);
 }finally{await Promise.all(clients.map(deleteApp));}
});
