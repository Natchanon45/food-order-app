// DEV-only data seeder. All service hosts and project values must be DEMO
// localhost BEFORE importing firebase-admin or accessing ANY database.
import { createRequire } from "node:module";

const PROJECT = "demo-penguin-hybrid";
const hosts = {
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: process.env.WEB_DEMO_ISOLATED_PORT === "8189" ? "127.0.0.1:8189" : "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  FIREBASE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1:5001",
};
if (process.env.HYBRID_DEMO_FUNCTIONS_ONLY !== "1"
  || Object.entries(hosts).some(([key, value]) => process.env[key] !== value)
  || [process.env.GCLOUD_PROJECT, process.env.GCP_PROJECT]
    .some(value => value && value !== PROJECT)) {
  throw new Error("HYBRID_DEMO_SEED_REFUSES_NONLOCAL_ENVIRONMENT");
}
let config = {};
try { config = JSON.parse(process.env.FIREBASE_CONFIG || "{}"); }
catch { throw new Error("HYBRID_DEMO_SEED_INVALID_CONFIG"); }
if (config.projectId && config.projectId !== PROJECT) {
  throw new Error("HYBRID_DEMO_SEED_REFUSES_NONDEMO_PROJECT");
}

const fnRequire = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = fnRequire("firebase-admin/app");
const { getAuth } = fnRequire("firebase-admin/auth");
const { getFirestore, FieldValue } = fnRequire("firebase-admin/firestore");

const app = initializeApp({ projectId: PROJECT, storageBucket: PROJECT + ".appspot.com" },
  "local-hybrid-browser-demo-seed");
const db = getFirestore(app);
const email = "hybrid-owner@demo.invalid";
const reviewerEmail = "hybrid-reviewer@demo.invalid";
const password = "EmulatorOnly123!";
const tenantId = "demo-hybrid-browser";
const invoiceId = "2026-10-24:monthly:fixed";

try {
  const auth = getAuth(app);
  let owner;
  try {
    owner = await auth.getUserByEmail(email);
    await auth.updateUser(owner.uid, { password, disabled: false, emailVerified: true });
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    owner = await auth.createUser({ email, password, emailVerified: true });
  }
  // Only local Emulator identities; never expose live credentials.
  let reviewer;
  try {
    reviewer = await auth.getUserByEmail(reviewerEmail);
    await auth.updateUser(reviewer.uid, { password, disabled: false, emailVerified: true });
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    reviewer = await auth.createUser({
      email: reviewerEmail, password, emailVerified: true,
    });
  }
  await db.collection("users").doc(reviewer.uid).set({
    role: "super_admin", tenantId: "", active: true,
    email: reviewerEmail, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.collection("users").doc(owner.uid).set({
    role: "owner", tenantId, tenantSlug: tenantId,
    tenantName: "PENGUIN Demo Hybrid Browser",
    active: true, email, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.collection("tenants").doc(tenantId).set({
    slug: tenantId, shopName: "PENGUIN Demo Hybrid Browser", name: "Demo Hybrid",
    ownerUid: owner.uid, active: true, hybridBillingSuspended: false,
    billingPolicyVersion: "hybrid_v1", subscriptionStatus: "active",
  }, { merge: true });
  const invoice = db.collection("tenants").doc(tenantId)
    .collection("hybridBillingInvoices").doc(invoiceId);
  const existing = await invoice.get();
  if (!existing.exists) {
    await invoice.create({
      id: invoiceId, tenantId, date: "2026-10-24", kind: "monthly_fixed",
      amount: 590, status: "issued", version: "hybrid-invoice-v1",
      signature: "a".repeat(64),
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  // Optional full-web fixture, isolated loopback project only. Preserve
  // existing test orders and stock on repeat runs. No real payment receiver.
  if(process.env.WEB_DEMO_ISOLATED_PORT==="8189"){
    const shop=db.collection("tenants").doc(tenantId);
    const createOnce=async(ref,row)=>{if(!(await ref.get()).exists)await ref.create(row);};
    await shop.set({businessType:"both",businessUnits:["retail_pos","order_delivery"]},{merge:true});
    await db.collection("users").doc(owner.uid).set({businessScope:"both",businessUnits:["retail_pos","order_delivery"]},{merge:true});
    await createOnce(shop.collection("settings").doc("store"),{
      shopName:"PENGUIN Demo",deliveryManualStatus:{mode:"open"},deliveryPromptPayEnabled:false,
      deliveryCodEnabled:false,deliveryProvider:"self",categoryOrder:["อาหารทดสอบ"],
    });
    await createOnce(shop.collection("menus").doc("demo-meal"),{
      id:"demo-meal",name:"อาหารทดสอบ",price:65,active:true,category:"อาหารทดสอบ",
    });
    await createOnce(shop.collection("tables").doc("T01"),{
      id:"T01",tenantId,shopId:tenantId,code:"T01",name:"โต๊ะ 1",active:true,status:"available",orderToken:"",orderIds:[],currentRound:0,
    });
    await createOnce(shop.collection("categories").doc("demo-category"),{
      id:"demo-category",tenantId,shopId:tenantId,name:"สินค้าทดสอบ",active:true,sortOrder:1,
    });
    await createOnce(shop.collection("products").doc("demo-product"),{
      id:"demo-product",tenantId,shopId:tenantId,name:"สินค้าทดสอบ",category:"สินค้าทดสอบ",
      categoryId:"demo-category",price:50,cost:20,stock:100,unit:"ชิ้น",active:true,showOnPos:true,sortOrder:1,
      barcode:"DEMO0001",updatedAt:new Date().toISOString(),
    });
  }
  // This prints ONLY fixed synthetic emulator credentials; never any API key.
  process.stdout.write("DEMO_ONLY_FIREBASE_PROJECT: " + PROJECT + "\n");
  process.stdout.write("DEMO_LOGIN: " + email + "\n");
  process.stdout.write("DEMO_REVIEWER: " + reviewerEmail + "\n");
  process.stdout.write("DEMO_PASSWORD: " + password + "\n");
  process.stdout.write("DEMO_INVOICE: " + invoiceId + "\n");
  process.stdout.write("INVOICE_STATE: " + (existing.exists ? "preserved" : "seeded") + "\n");
} finally {
  await deleteApp(app);
}
