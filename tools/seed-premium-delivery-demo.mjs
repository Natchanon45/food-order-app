// LOCAL PREMIUM DELIVERY BROWSER UAT ONLY. Fail before importing Firebase Admin.
import { createRequire } from "node:module";
const projectId = "demo-penguin-hybrid";
const required = {
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  FIREBASE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1:5001",
};
if (process.env.HYBRID_DEMO_FUNCTIONS_ONLY !== "1"
  || Object.entries(required).some(([key, value]) => process.env[key] !== value)
  || [process.env.GCLOUD_PROJECT, process.env.GCP_PROJECT].some(id => id && id !== projectId)
  || ![process.env.GCLOUD_PROJECT, process.env.GCP_PROJECT].some(id => id === projectId)) {
  throw new Error("PREMIUM_DEMO_REQUIRES_EXPLICIT_LOCAL_EMULATORS");
}
const req = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = req("firebase-admin/app");
const { getFirestore, FieldValue } = req("firebase-admin/firestore");
const { getAuth } = req("firebase-admin/auth");
const { cycleForDate } = req("./billing-anniversary");

const app = initializeApp({ projectId, storageBucket: projectId + ".appspot.com" },
  "premium-delivery-emulator-seed");
const db = getFirestore(app), auth = getAuth(app);
const tenantId = "demo-premium-delivery";
const ownerEmail = "premium-owner@demo.invalid";
const reviewerEmail = "premium-reviewer@demo.invalid";
const password = "EmulatorOnly123!";
function bangkokDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return p.year + "-" + p.month + "-" + p.day;
}
function bangkokYesterday() {
  return bangkokDate(new Date(Date.now() - 86400000));
}
function atNoon(day) { return new Date(day + "T12:00:00+07:00"); }
async function getOrCreate(email) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { disabled: false, password, emailVerified: true });
    return existing;
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    return auth.createUser({ email, password, emailVerified: true });
  }
}
try {
  const today = bangkokDate(new Date());
  const yesterday = bangkokYesterday();
  if (yesterday < "2026-10-03") throw new Error("PREMIUM_DEMO_DATE_BEFORE_ORIGINAL_ACTIVATION");
  const cycle = cycleForDate("2026-10-03", yesterday);
  if (!cycle?.startDate || cycle.startDate > yesterday) {
    throw new Error("PREMIUM_DEMO_CYCLE_UNAVAILABLE");
  }
  const [owner, reviewer] = await Promise.all([
    getOrCreate(ownerEmail), getOrCreate(reviewerEmail),
  ]);
  await db.collection("users").doc(owner.uid).set({
    role: "owner", active: true, email: ownerEmail, tenantId,
    tenantSlug: tenantId, tenantName: "PENGUIN Premium Delivery Demo",
  }, { merge: true });
  await db.collection("users").doc(reviewer.uid).set({
    role: "super_admin", active: true, email: reviewerEmail, tenantId: "",
  }, { merge: true });
  const tenantRef = db.collection("tenants").doc(tenantId);
  const exists = await tenantRef.get();
  if (!exists.exists) {
    await tenantRef.create({
      ownerUid: owner.uid, slug: tenantId,
      shopName: "PENGUIN Premium Delivery Demo", name: "Premium Delivery Demo",
      businessType: "restaurant_cafe", billingMode: "subscription", planCode: "monthly",
      active: true, subscriptionStatus: "active",
      billingCycleAnchorAt: "2026-10-03T08:30:00+07:00",
      createdAt: "2026-10-03T08:30:00+07:00",
    });
    await db.collection("tenantSlugs").doc(tenantId).set({
      tenantId, slug: tenantId, active: true,
    });
  } else if (exists.data().billingPolicyVersion === "hybrid_v1") {
    throw new Error("PREMIUM_DEMO_CANNOT_OVERWRITE_HYBRID_TENANT");
  }
  const pricingRef = db.collection("platformSettings").doc("subscriptionPricing");
  const pricing = await pricingRef.get();
  if (!pricing.exists) {
    await pricingRef.set({ monthlyPrice: 590, deliveryThreshold: 10000,
      deliveryShareRate: 5, planId: "premium", currency: "THB" });
  } else if (Number(pricing.data().deliveryThreshold) !== 10000 ||
    Number(pricing.data().deliveryShareRate) !== 5) {
    throw new Error("PREMIUM_DEMO_CENTRAL_PRICING_CONFLICT");
  }
  // Deterministic synthetic orders ONLY in the demo tenant. Re-running the
  // seeder cannot rewrite orders or existing payment/review decisions.
  const orders = [
    { id: "seed-" + cycle.startDate + "-a", day: cycle.startDate, goods: 4000 },
    { id: "seed-" + yesterday + "-b", day: yesterday, goods: 6000 },
    { id: "seed-" + yesterday + "-c", day: yesterday, goods: 1500 },
  ];
  for (const row of orders) {
    const ref = tenantRef.collection("orders").doc(row.id);
    if ((await ref.get()).exists) continue;
    await ref.create({
      orderType: "delivery", paymentStatus: "paid", status: "delivered",
      paidAt: atNoon(row.day), totalAmount: row.goods + 40,
      subtotalAmount: row.goods, deliveryFee: 40,
      deliveryProvider: "self", createdAt: FieldValue.serverTimestamp(),
    });
  }
  process.stdout.write("PROJECT: " + projectId + "\n");
  process.stdout.write("PREMIUM_OWNER: " + ownerEmail + "\n");
  process.stdout.write("SUPER_ADMIN: " + reviewerEmail + "\n");
  process.stdout.write("PASSWORD: " + password + "\n");
  process.stdout.write("ANNIVERSARY_CYCLE: " + cycle.startDate + " - " + cycle.endDate + "\n");
  process.stdout.write("SAMPLE_DUE_DATE: " + yesterday + " (75 THB; payable before midnight)\n");
  process.stdout.write("TODAY: " + today + "\n");
  process.stdout.write("OWNER_REPORT: http://127.0.0.1:5174/reports/revenue-share\n");
  process.stdout.write("SUPERADMIN_REVIEW: http://127.0.0.1:5174/admin/tenants\n");
  process.stdout.write("NOTE: No real bank, Slip2Go or money transfer is used\n");
} finally {
  await deleteApp(app);
}
