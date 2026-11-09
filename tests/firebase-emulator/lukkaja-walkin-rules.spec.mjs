import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {initializeApp as initializeClientApp, deleteApp as deleteClientApp} from "firebase/app";
import {getAuth as getClientAuth, connectAuthEmulator, signInWithEmailAndPassword} from "firebase/auth";
import {getFirestore as getClientFirestore, connectFirestoreEmulator, doc, updateDoc, setDoc} from "firebase/firestore";

const projectId="demo-penguin-lukkaja-parallel";
for(const field of ["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST"]) {
 if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[field] || ""))throw new Error("LOCAL_EMULATOR_ONLY "+field);
}
if(process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== projectId)throw new Error("DEMO_PROJECT_ONLY");
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {initializeApp,deleteApp}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const {getAuth}=require("firebase-admin/auth");
const postfix=randomUUID().slice(0,12).replaceAll("-","");
const admin=initializeApp({projectId},"auth-emul-"+postfix);
const db=getFirestore(admin);
const uid="cashier-"+postfix, tenant="tenant-"+postfix;
const email=uid+"@demo.invalid",password="EmulatorOnly123456!";
const app=initializeClientApp({apiKey:"fake-api-key",projectId,authDomain:projectId+".firebaseapp.com"},"browser-emul-"+postfix);
const auth=getClientAuth(app);
const client=getClientFirestore(app);
connectAuthEmulator(auth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,{disableWarnings:true});
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
connectFirestoreEmulator(client,host,Number(port));

test("real Firestore Rules: normal order allows cashier write but unpaid/paid Walk-ins deny direct payment edits",async t=>{
 t.after(async()=>{await deleteClientApp(app);await deleteApp(admin)});
 await getAuth(admin).createUser({uid,email,password});
 await db.collection("users").doc(uid).set({uid,tenantId:tenant,active:true,role:"cashier"});
 await db.collection("tenants").doc(tenant).set({businessType:"restaurant_cafe",active:true,ownerUid:"different-owner"});
 const orders=db.collection("tenants").doc(tenant).collection("orders");
 const ordinary="order-normal-123";
 const unpaid="walkin-unpaid-123";
 const paid="walkin-paid-123";
 await orders.doc(ordinary).set({tenantId:tenant,orderType:"takeaway",status:"pending",paymentStatus:"unpaid",totalAmount:100});
 await orders.doc(unpaid).set({tenantId:tenant,orderType:"walkin",status:"served",paymentTiming:"after",paymentStatus:"unpaid",totalAmount:125});
 await orders.doc(paid).set({tenantId:tenant,orderType:"walkin",status:"pending",paymentTiming:"before",paymentStatus:"paid",totalAmount:125});
 await signInWithEmailAndPassword(auth,email,password);
 const orderRef=id=>doc(client,"tenants",tenant,"orders",id);
 await assert.rejects(()=>setDoc(orderRef("walkin-new-browser"),{
  tenantId:tenant,orderType:"walkin",status:"pending",
  paymentTiming:"after",paymentStatus:"unpaid",totalAmount:0,
 }),e=>e.code==="permission-denied");
 // Positive control: cashier still edits a normal non-Walk-in order.
 await updateDoc(orderRef(ordinary),{status:"accepted"});
 assert.equal((await orders.doc(ordinary).get()).data().status,"accepted");
 for(const id of [unpaid,paid]){
  await assert.rejects(()=>updateDoc(orderRef(id),{paymentStatus:"paid",paidAt:"bogus",status:"paid"}),e=>e.code==="permission-denied");
  assert.notEqual((await orders.doc(id).get()).data().status,"paid");
 }
 const other="foreign-tenant-12345";
 await db.collection("tenants").doc(other).set({businessType:"restaurant_cafe"});
 await db.collection("tenants").doc(other).collection("orders").doc(ordinary).set({tenantId:other,orderType:"takeaway",status:"pending",paymentStatus:"unpaid"});
 await assert.rejects(()=>updateDoc(doc(client,"tenants",other,"orders",ordinary),{status:"accepted"}),e=>e.code==="permission-denied");
});
