import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {initializeApp,deleteApp} from "firebase/app";
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,
 getIdToken,reload} from "firebase/auth";
import {getStorage,connectStorageEmulator,uploadBytes,ref as storageRef} from "firebase/storage";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {getApps:adminApps,initializeApp:adminInit}=require("firebase-admin/app");
const {getAuth:adminAuthGetter}=require("firebase-admin/auth");
const {getFirestore:adminDbGetter}=require("firebase-admin/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_STORAGE_EMULATOR_HOST||""))
 throw Error("P13D_STORAGE_REQUIRES_ISOLATED_AUTH_FIRESTORE_STORAGE_EMULATORS");
if(!adminApps().length)adminInit({projectId:"demo-penguin-hybrid"});
const adminAuth=adminAuthGetter(),db=adminDbGetter();
const password="EmulatorOnlyPassword1234!";
const suffix=randomUUID().slice(0,8);
const png=Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9UppLFEAAAAASUVORK5CYII=","base64"));
const uid="p13d-storage-owner-"+randomUUID(),email="storage-"+suffix+"@example.test";
test("unverified managed Owner cannot upload staff business assets; native email verification refresh unlocks Storage",async()=>{
 await adminAuth.createUser({uid,email,password,emailVerified:false,disabled:false});
 await db.collection("users").doc(uid).set({uid,email,role:"owner",
  active:true,tenantId:"p13d-storage-"+suffix,emailVerificationRequired:true});
 const app=initializeApp({
  apiKey:"demo-api-key",projectId:"demo-penguin-hybrid",
  authDomain:"demo-penguin-hybrid.firebaseapp.com",
  appId:"1:123:web:"+randomUUID(),
  storageBucket:"demo-penguin-hybrid.appspot.com",
 },"p13d-storage-test-"+randomUUID());
 try{
  const auth=getAuth(app);
  connectAuthEmulator(auth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
    {disableWarnings:true});
  const storage=getStorage(app);
  const [host,port]=process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(":");
  connectStorageEmulator(storage,host,Number(port));
  await signInWithEmailAndPassword(auth,email,password);
  const file=storageRef(storage,"menu-images/p13d-"+suffix+"/photo.png");
  await assert.rejects(uploadBytes(file,png,{contentType:"image/png"}),
    error=>String(error?.code||"").includes("unauthorized"));
  await adminAuth.updateUser(uid,{emailVerified:true});
  await reload(auth.currentUser);
  await getIdToken(auth.currentUser,true);
  assert.equal(auth.currentUser.emailVerified,true);
  const result=await uploadBytes(file,png,{contentType:"image/png"});
  assert.equal(result.metadata.contentType,"image/png");
 }finally{await deleteApp(app);}
});
