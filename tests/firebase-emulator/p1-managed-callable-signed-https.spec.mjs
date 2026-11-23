import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {initializeApp,deleteApp} from "firebase/app";
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,
 signOut,reload,getIdToken} from "firebase/auth";
import {getFunctions,connectFunctionsEmulator,httpsCallable} from "firebase/functions";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp:adminInitialize,getApps}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth:adminGetAuth}=require("firebase-admin/auth");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||""))
 throw Error("P13E_SIGNED_HTTPS_TEST_REQUIRES_ONLY_LOCAL_DEMO_EMULATORS");
if(!getApps().length)adminInitialize({projectId:"demo-penguin-hybrid"});
const db=getFirestore(),adminAuth=adminGetAuth();
const app=initializeApp({projectId:"demo-penguin-hybrid",
 apiKey:"demo-api-key",authDomain:"demo-penguin-hybrid.firebaseapp.com",
 appId:"1:123:web:"+randomUUID()},"p13e-https-"+randomUUID());
const auth=getAuth(app),fn=getFunctions(app,"asia-southeast1");
connectAuthEmulator(auth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
 {disableWarnings:true});
connectFunctionsEmulator(fn,"127.0.0.1",5001);
const call=httpsCallable(fn,"getPublicSubscriptionPricing");
const secret="EmulatorOnlyPassword1234!";
const uid="p13e-https-owner-"+randomUUID();
const email="p13e-https-"+randomUUID()+"@example.test";
const legacyUid="p13e-https-legacy-"+randomUUID();
const legacyEmail="p13e-https-legacy-"+randomUUID()+"@example.test";
test("real signed HTTPS Callable rejects unverified managed ID token and permits verified token plus legacy/public",async()=>{
 try{
  await adminAuth.createUser({uid,email,password:secret,emailVerified:false});
  await db.collection("users").doc(uid).set({
   uid,email,role:"owner",active:true,tenantId:"p13e-https-tenant",
   emailVerificationRequired:true});
  await adminAuth.createUser({uid:legacyUid,email:legacyEmail,
   password:secret,emailVerified:false});
  await db.collection("users").doc(legacyUid).set({
   uid:legacyUid,email:legacyEmail,role:"owner",active:true,
   tenantId:"p13e-https-tenant"});
  const publicResult=await call({});
  assert.ok(publicResult.data);
  await signInWithEmailAndPassword(auth,email,secret);
  assert.equal(auth.currentUser.emailVerified,false);
  await assert.rejects(call({}),error=>
   error.code==="functions/permission-denied");
  await signOut(auth);
  await signInWithEmailAndPassword(auth,legacyEmail,secret);
  const legacy=await call({});
  assert.ok(legacy.data);
  await signOut(auth);
  await signInWithEmailAndPassword(auth,email,secret);
  await adminAuth.updateUser(uid,{emailVerified:true});
  await reload(auth.currentUser);
  await getIdToken(auth.currentUser,true);
  assert.equal(auth.currentUser.emailVerified,true);
  const verified=await call({});
  assert.ok(verified.data);
 }finally{await signOut(auth).catch(()=>{});await deleteApp(app);}
});
