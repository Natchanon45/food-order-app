import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {initializeApp,deleteApp,getApps} from "firebase/app";
import {getAuth,connectAuthEmulator,signInWithEmailAndPassword,
 sendEmailVerification,sendPasswordResetEmail,confirmPasswordReset,
 applyActionCode,reload,getIdToken,signOut} from "firebase/auth";
import {getFirestore,connectFirestoreEmulator,getDoc,doc} from "firebase/firestore";
import {createRequire} from "node:module";
const require=createRequire(new URL("../../functions/package.json",import.meta.url));
const {getApps:adminApps,initializeApp:adminInit}=require("firebase-admin/app");
const {getAuth:adminAuthGetter}=require("firebase-admin/auth");
const {getFirestore:adminDbGetter}=require("firebase-admin/firestore");
const staff=require("./staff-admin");
if(process.env.GCLOUD_PROJECT!=="demo-penguin-hybrid"||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||"")||
 !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||""))
 throw Error("P13D_REQUIRES_ISOLATED_AUTH_AND_FIRESTORE_EMULATORS");
if(!adminApps().length)adminInit({projectId:"demo-penguin-hybrid"});
const db=adminDbGetter(),adminAuth=adminAuthGetter(),suffix=randomUUID().slice(0,8);
const password="EmulatorOnlyPassword1234!";
const tenantId="p13d-tenant-"+randomUUID();
const ownerUid="p13d-owner-"+randomUUID();
const staffUid="p13d-staff-"+randomUUID();
const legacyUid="p13d-legacy-"+randomUUID();
const nativeEmail=prefix=>prefix+"-"+suffix+"@example.test";
const accounts=[
 {uid:ownerUid,email:nativeEmail("owner"),role:"owner",flag:true},
 {uid:staffUid,email:nativeEmail("staff"),role:"cashier",flag:true},
 {uid:legacyUid,email:nativeEmail("legacy"),role:"owner",flag:false},
];
function client(uid){
 const app=initializeApp({apiKey:"demo-api-key",projectId:"demo-penguin-hybrid",
  authDomain:"demo-penguin-hybrid.firebaseapp.com",appId:"1:123:web:"+randomUUID()},
  "p13d-client-"+uid);
 const auth=getAuth(app);
 connectAuthEmulator(auth,"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,
  {disableWarnings:true});
 const firestore=getFirestore(app);
 const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
 connectFirestoreEmulator(firestore,host,Number(port));
 return {app,auth,firestore};
}
const inspectClient=async c=>{
 const profile=await getDoc(doc(c.firestore,"users",c.auth.currentUser.uid));
 const tenant=()=>getDoc(doc(c.firestore,"tenants",tenantId));
 const member=()=>getDoc(doc(c.firestore,"tenants",tenantId,"memberships",
   c.auth.currentUser.uid));
 return {profile,tenant,member};
};
const outbox=async()=>{
 const url="http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+
  "/emulator/v1/projects/demo-penguin-hybrid/oobCodes";
 const response=await fetch(url);
 assert.equal(response.ok,true,"Auth Emulator OOB endpoint must be local");
 const payload=await response.json();
 return payload.oobCodes||[];
};
test("seed only demo-native accounts; legacy and provisioned use the same Tenant",async()=>{
 await db.collection("tenants").doc(tenantId).set({
  id:tenantId,slug:"p13d-"+suffix,name:"Sandbox Restaurant",
  ownerUid,active:true,onboardingRequired:false,firstActivatedAt:"2026-10-18",
  trialEndsAt:"2026-11-17",subscriptionExpiresAt:"2027-11-17",
  planCode:"yearly",m7InvoiceUnpaidCents:12345});
 for(const row of accounts){
  await adminAuth.createUser({uid:row.uid,email:row.email,password,
   displayName:"Test "+row.role,emailVerified:false,disabled:false});
  const user={uid:row.uid,email:row.email,displayName:"Test "+row.role,
   role:row.role,active:true,tenantId,
   ...(row.flag?{emailVerificationRequired:true}:{})};
  await db.collection("users").doc(row.uid).set(user);
  await db.collection("tenants").doc(tenantId)
   .collection("memberships").doc(row.uid).set(user);
 }
});
for(const role of ["owner","cashier"]){
 test("managed "+role+" user reads own profile but cannot access Tenant until Firebase verification",async()=>{
  const row=accounts.find(x=>x.role===role);
  const c=client(row.uid);
  try{
   await signInWithEmailAndPassword(c.auth,row.email,password);
   const {profile,tenant,member}=await inspectClient(c);
   assert.equal(profile.exists(),true);
   assert.equal(profile.data().emailVerificationRequired,true);
   assert.equal(c.auth.currentUser.emailVerified,false);
   await assert.rejects(member(),e=>e.code==="permission-denied");
   if(role==="owner"){
    await assert.rejects(staff._privateForTests.authorized(
      db,{uid:row.uid},tenantId,adminAuth),e=>e.code==="permission-denied");
   }
   const emailsBefore=await outbox();
   assert.equal(emailsBefore.filter(x=>x.email===row.email&&
     x.requestType==="VERIFY_EMAIL").length,0,
     "No verification is sent automatically during Admin provisioning or sign-in");
   // This user-triggered SDK call is routed only to Auth Emulator.
   await sendEmailVerification(c.auth.currentUser,{
    url:"https://penguin-food.web.app/verify-account",handleCodeInApp:false,
   });
   const codes=(await outbox()).filter(x=>x.email===row.email&&x.requestType==="VERIFY_EMAIL");
   assert.equal(codes.length,1,"One provider verification action is generated on user click");
   assert.equal(codes[0].requestType,"VERIFY_EMAIL");
   assert.equal(c.auth.currentUser.emailVerified,false);
   await assert.rejects(member(),e=>e.code==="permission-denied");
   await applyActionCode(c.auth,codes[0].oobCode);
   await reload(c.auth.currentUser);
   await getIdToken(c.auth.currentUser,true);
   assert.equal(c.auth.currentUser.emailVerified,true);
   const memberAfter=await member();
   assert.equal(memberAfter.exists(),true);
   const tenantAfter=await tenant();
   assert.equal(tenantAfter.exists(),true);
   assert.equal(tenantAfter.data().m7InvoiceUnpaidCents,12345);
   const profileAfter=await getDoc(doc(c.firestore,"users",row.uid));
   assert.equal(profileAfter.data().emailVerificationRequired,true,
     "No browser write or profile bypass should mark the email verified");
   if(role==="owner"){
    const access=await staff._privateForTests.authorized(
      db,{uid:row.uid},tenantId,adminAuth);
    assert.equal(access.uid,row.uid);
    const staffEmail=accounts.find(x=>x.role==="cashier").email;
    const before=(await outbox()).filter(x=>x.email===staffEmail&&
      x.requestType==="PASSWORD_RESET").length;
    assert.equal(before,0,
      "Creating a Staff user never generates an automatic invitation");
    // Explicit operator-triggered Firebase password setup: emulator only.
    await sendPasswordResetEmail(c.auth,staffEmail,{
      url:"https://penguin-food.web.app/login",handleCodeInApp:false,
    });
    const sent=(await outbox()).filter(x=>x.email===staffEmail&&
      x.requestType==="PASSWORD_RESET");
    assert.equal(sent.length,1);
    assert.equal(sent[0].requestType,"PASSWORD_RESET");
    assert.equal(sent[0].email,staffEmail);
    assert.equal((await adminAuth.getUser(staffUid)).emailVerified,false,
      "Invitation cannot bypass first-login email verification");
   }
   await signOut(c.auth);
  }finally{await deleteApp(c.app);}
 });
}
test("Firebase invitation password setup changes recipient password but does not bypass email verification",async()=>{
 const recipientUid="p13d-invited-"+randomUUID();
 const recipientEmail=nativeEmail("invited");
 const nextPassword="FreshEmulatorOnlyPassword123!";
 await adminAuth.createUser({uid:recipientUid,email:recipientEmail,password,
   displayName:"Invited Staff",disabled:false,emailVerified:false});
 const member={uid:recipientUid,email:recipientEmail,role:"cashier",
   tenantId,active:true,emailVerificationRequired:true};
 await db.collection("users").doc(recipientUid).set(member);
 await db.collection("tenants").doc(tenantId).collection("memberships")
   .doc(recipientUid).set(member);
 const adminOwner=accounts.find(x=>x.uid===ownerUid);
 const c=client("inviter-"+randomUUID());
 try{
  await signInWithEmailAndPassword(c.auth,adminOwner.email,password);
  assert.equal(c.auth.currentUser.emailVerified,true);
  await sendPasswordResetEmail(c.auth,recipientEmail,{
    url:"https://penguin-food.web.app/login",handleCodeInApp:false,
  });
  const found=(await outbox()).filter(x=>x.email===recipientEmail&&
    x.requestType==="PASSWORD_RESET");
  assert.equal(found.length,1);
  await confirmPasswordReset(c.auth,found[0].oobCode,nextPassword);
  await signOut(c.auth);
  await assert.rejects(signInWithEmailAndPassword(c.auth,recipientEmail,password));
  await signInWithEmailAndPassword(c.auth,recipientEmail,nextPassword);
  assert.equal(c.auth.currentUser.uid,recipientUid);
  // Firebase Auth Emulator marks the reset-linked address as verified: the
  // completed out-of-band action itself proves email inbox control.
  // Trust only the native Auth state and a fresh ID token, never a browser flag.
  const nativeRecipient=await adminAuth.getUser(recipientUid);
  assert.equal(nativeRecipient.emailVerified,true,
    "A successfully redeemed email reset action proves mailbox ownership");
  assert.equal(c.auth.currentUser.emailVerified,true);
  await getIdToken(c.auth.currentUser,true);
  const member=await getDoc(doc(c.firestore,"tenants",tenantId,"memberships",
    recipientUid));
  assert.equal(member.exists(),true);
  assert.equal(member.data().emailVerificationRequired,true);
 }finally{await deleteApp(c.app);}
});

test("legacy Owner without the new opt-in flag retains access before verification",async()=>{
 const row=accounts.find(x=>!x.flag);
 const c=client(row.uid);
 try{
  await signInWithEmailAndPassword(c.auth,row.email,password);
  assert.equal(c.auth.currentUser.emailVerified,false);
  const {profile,tenant}=await inspectClient(c);
  assert.equal(profile.data().emailVerificationRequired,undefined);
  assert.equal((await tenant()).exists(),true);
 }finally{await deleteApp(c.app);}
});
