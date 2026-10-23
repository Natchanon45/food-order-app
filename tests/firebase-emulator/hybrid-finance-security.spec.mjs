import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs,
  collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getStorage, connectStorageEmulator, ref as storageRef,
  uploadBytes, deleteObject, getBytes, updateMetadata, getMetadata } from "firebase/storage";

const projectId = "demo-penguin-hybrid";
const bucketName = projectId + ".appspot.com";
const fnRequire = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } =
  fnRequire("firebase-admin/app");
const { getFirestore: getAdminFirestore, FieldValue } =
  fnRequire("firebase-admin/firestore");
const { claimRefs, checkClaimsInTransaction, createClaimsInTransaction } =
  fnRequire("./finance-slip-claims");
const { prepareInvoiceLedger } = fnRequire("./hybrid-billing-ledger");
const { persistHybridInvoiceLedger } = fnRequire("./hybrid-billing-persistence");
const { stageHybridInvoiceProof, reviewHybridInvoiceProof } =
  fnRequire("./hybrid-billing-payment");
const { fingerprintClaims } = fnRequire("./hybrid-billing-payment-policy");
const { claimIds } = fnRequire("./finance-slip-claims");

let adminApp, adminDb;
const clients = [];
const identities = new Map();
const invoiceId = "2026-10-22:delivery:trigger";
const invoicePath = "tenants/store-a/hybridBillingInvoices/" + invoiceId;
const proofPath = "tenants/store-a/hybrid-billing-slips/" + invoiceId +
  "/attempt_1234567890123456/proof.png";
const adminProofPath = "tenants/store-a/hybrid-billing-slips/" + invoiceId +
  "/admin_attempt_123456789/admin.png";
async function seedDemoUploadGrant(path, actorUid, size = 8) {
  const attemptId = path.split("/").at(-2);
  await adminDb.doc("tenants/store-a/hybridBillingUploadGrants/" + attemptId).set({
    id: attemptId, tenantId: "store-a", invoiceId, actorUid,
    slipPath: path, contentType: "image/png", maxSize: size,
    status: "reserved", invoiceSignature: "a".repeat(64),
    expiresAt: new Date(Date.now() + 3600000),
  });
}

function requireEmulators() {
  for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST"]) {
    if (!process.env[key] || !/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[key])) {
      throw new Error(key + " must point to a local emulator. Never run against production.");
    }
  }
  if (!projectId.startsWith("demo-")) throw new Error("Unsafe Firebase project");
}
function web(name) {
  const app = initializeApp({
    apiKey: "emulator-only-fake-key",
    authDomain: projectId + ".firebaseapp.com",
    projectId, storageBucket: bucketName,
    appId: "1:123456:web:demo-" + name,
  }, "hybrid-emulator-" + name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://" + process.env.FIREBASE_AUTH_EMULATOR_HOST,
    { disableWarnings: true });
  const firestore = getFirestore(app);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  connectFirestoreEmulator(firestore, host, Number(port));
  const storage = getStorage(app);
  const [shost, sport] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(":");
  connectStorageEmulator(storage, shost, Number(sport));
  const client = { app, auth, firestore, storage };
  clients.push(client);
  return client;
}
async function makeUser(name, role, tenantId = "store-a", active = true) {
  const client = web(name);
  const result = await createUserWithEmailAndPassword(client.auth,
    name + "@example.test", "EmulatorOnly123!");
  client.uid = result.user.uid;
  identities.set(name, client);
  await adminDb.collection("users").doc(client.uid).set({
    role, tenantId, active, email: name + "@example.test",
  });
  return client;
}
function isPermissionDenied(err) {
  return /permission-denied|storage\/unauthorized|not authorized|does not have permission/i
    .test(String(err?.code || "") + " " + String(err?.message || ""));
}
async function denied(promise, purpose) {
  await assert.rejects(promise, isPermissionDenied, purpose);
}

before(async () => {
  requireEmulators(); // fail before creating any Firebase client
  adminApp = initializeAdmin({ projectId, storageBucket: bucketName },
    "hybrid-finance-emulator-admin");
  adminDb = getAdminFirestore(adminApp);
  const owner = await makeUser("owner-a", "owner");
  await makeUser("admin-a", "admin");
  await makeUser("cashier-a", "cashier");
  await makeUser("inactive-a", "admin", "store-a", false);
  await makeUser("owner-b", "owner", "store-b");
  await makeUser("super-admin", "super_admin", "");
  identities.set("anonymous", web("anonymous"));
  const batch = adminDb.batch();
  batch.set(adminDb.collection("tenants").doc("store-a"), {
    ownerUid: owner.uid, shopName: "Demo A", subscriptionStatus: "active",
  });
  batch.set(adminDb.collection("tenants").doc("store-b"), {
    ownerUid: identities.get("owner-b").uid, shopName: "Demo B",
  });
  for (const key of ["hybridBillingPeriods", "hybridBillingInvoices",
    "hybridBillingPaymentAttempts", "hybridBillingPaymentEvents"]) {
    const id = key === "hybridBillingInvoices" ? invoiceId : "record-a";
    batch.set(adminDb.doc("tenants/store-a/" + key + "/" + id), {
      tenantId: "store-a", id, status: "issued", amount: 500,
      date: "2026-10-25", signature: "a".repeat(64),
      version: "hybrid-invoice-v1",
    });
  }
  batch.set(adminDb.collection("financeSlipClaims").doc("file_" + "a".repeat(64)), {
    tenantId: "store-a", channel: "wallet_topup", recordId: "test-topup",
  });
  await batch.commit();
});
after(async () => {
  await Promise.allSettled(clients.map(client => deleteApp(client.app)));
  if (adminApp) await deleteAdmin(adminApp);
});

test("Firestore grants invoice read/list only to own tenant billing staff and Super Admin", async () => {
  for (const name of ["owner-a", "admin-a", "super-admin"]) {
    const db = identities.get(name).firestore;
    for (const key of ["hybridBillingPeriods", "hybridBillingInvoices",
      "hybridBillingPaymentAttempts", "hybridBillingPaymentEvents"]) {
      const id = key === "hybridBillingInvoices" ? invoiceId : "record-a";
      assert.equal((await getDoc(doc(db, "tenants/store-a/" + key + "/" + id))).exists(), true);
      assert.equal((await getDocs(collection(db, "tenants/store-a/" + key))).size, 1);
    }
  }
  for (const name of ["cashier-a", "inactive-a", "owner-b", "anonymous"]) {
    const db = identities.get(name).firestore;
    for (const key of ["hybridBillingPeriods", "hybridBillingInvoices",
      "hybridBillingPaymentAttempts", "hybridBillingPaymentEvents"]) {
      const id = key === "hybridBillingInvoices" ? invoiceId : "record-a";
      await denied(getDoc(doc(db, "tenants/store-a/" + key + "/" + id)),
        name + " must not get " + key);
      await denied(getDocs(collection(db, "tenants/store-a/" + key)),
        name + " must not list " + key);
    }
  }
});

test("All Browser roles including Super Admin are denied billing amount/status writes", async () => {
  for (const name of ["owner-a", "admin-a", "super-admin", "owner-b", "anonymous"]) {
    const db = identities.get(name).firestore;
    const invoice = doc(db, invoicePath);
    await denied(updateDoc(invoice, { status: "paid", amount: 0 }));
    await denied(deleteDoc(invoice));
    await denied(setDoc(doc(db, "tenants/store-a/hybridBillingInvoices/forged-" + name),
      { amount: 0, status: "paid" }));
    await denied(setDoc(doc(db, "tenants/store-a/hybridBillingPaymentAttempts/forged-" + name),
      { amount: 500, status: "paid" }));
  }
});

test("Browser roles cannot read, enumerate or forge server-only upload grants", async () => {
  const path = "tenants/store-a/hybridBillingUploadGrants/demo_grant_1234567890123456";
  await adminDb.doc(path).set({
    id: "demo_grant_1234567890123456", tenantId: "store-a",
    invoiceId, actorUid: identities.get("owner-a").uid,
    slipPath: proofPath, status: "reserved",
    contentType: "image/png", maxSize: 512,
    createdAt: new Date(), expiresAt: new Date(Date.now() + 600000),
    invoiceSignature: "a".repeat(64),
  });
  for (const name of ["owner-a", "admin-a", "cashier-a",
    "owner-b", "super-admin", "anonymous"]) {
    const clientDb = identities.get(name).firestore;
    await denied(getDoc(doc(clientDb, path)));
    await denied(getDocs(collection(clientDb, "tenants/store-a/hybridBillingUploadGrants")));
    await denied(setDoc(doc(clientDb, path), { status: "paid" }));
    await denied(updateDoc(doc(clientDb, path), { actorUid: "forged" }));
    await denied(deleteDoc(doc(clientDb, path)));
  }
});

test("Global bank/slip claims cannot be read or forged by any Browser role", async () => {
  for (const name of ["owner-a", "admin-a", "super-admin", "cashier-a", "anonymous"]) {
    const db = identities.get(name).firestore;
    const claim = doc(db, "financeSlipClaims/file_" + "a".repeat(64));
    await denied(getDoc(claim));
    await denied(setDoc(claim, { channel: "hybrid", tenantId: "store-b" }));
    await denied(deleteDoc(claim));
  }
});

test("Storage permits own owner/admin write-once slip, rejects replacement and deletion", async () => {
  const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  await seedDemoUploadGrant(proofPath, identities.get("owner-a").uid);
  await seedDemoUploadGrant(adminProofPath, identities.get("admin-a").uid);
  for (const name of ["owner-a", "admin-a"]) {
    const path = name === "owner-a" ? proofPath : adminProofPath;
    const target = storageRef(identities.get(name).storage, path);
    await uploadBytes(target, image, { contentType: "image/png" });
    assert.equal((await getBytes(target)).byteLength, image.byteLength);
    // Firebase Storage may classify a second upload as CREATE, not UPDATE.
    // The resource == null guard must deny both identical and changed bytes.
    await denied(uploadBytes(target, image, { contentType: "image/png" }),
      "The same bytes must not be uploaded again to existing bank evidence");
    const alteredImage = new Uint8Array([137, 80, 78, 71, 0, 99, 98, 97]);
    await denied(uploadBytes(target, alteredImage, { contentType: "image/png" }),
      "Even a different file must not replace an existing bank slip");
    await denied(updateMetadata(target, {
      customMetadata: { forgedFinanceStatus: "paid" },
    }), "Uploaded slip metadata must be immutable");
    assert.deepEqual(new Uint8Array(await getBytes(target)), image,
      "Rejected overwrites must preserve the original slip bytes");
    const metadata = await getMetadata(target);
    assert.equal(metadata.customMetadata?.forgedFinanceStatus, undefined,
      "Rejected metadata changes must never persist");
    await denied(deleteObject(target));
  }
  const other = storageRef(identities.get("owner-b").storage, proofPath);
  await denied(uploadBytes(other, image, { contentType: "image/png" }));
  await denied(getBytes(other));
  for (const name of ["cashier-a", "inactive-a", "anonymous"]) {
    await denied(uploadBytes(storageRef(identities.get(name).storage,
      proofPath.replace("proof.png", name + ".png")), image,
    { contentType: "image/png" }));
  }
});

test("Storage refuses unreserved paths, other owner reuse, expired and revoked upload grants", async () => {
  const owner = identities.get("owner-a");
  const admin = identities.get("admin-a");
  const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const randomPath = proofPath.replace("attempt_1234567890123456", "unreserved_attempt_12345678");
  await denied(uploadBytes(storageRef(owner.storage, randomPath),
    image, { contentType: "image/png" }), "No self-chosen paths");
  await denied(uploadBytes(storageRef(admin.storage,
    proofPath.replace("proof.png", "other.png")),
    image, { contentType: "image/png" }), "Grant must match exact filename");
  const expiredPath = proofPath.replace("attempt_1234567890123456", "expired_attempt_12345678");
  await seedDemoUploadGrant(expiredPath, owner.uid);
  await adminDb.doc("tenants/store-a/hybridBillingUploadGrants/expired_attempt_12345678")
    .update({ expiresAt: new Date(Date.now() - 1000) });
  await denied(uploadBytes(storageRef(owner.storage, expiredPath),
    image, { contentType: "image/png" }), "Grant expiry is enforced");
  const stolenPath = proofPath.replace("attempt_1234567890123456", "stolen_attempt_123456789");
  await seedDemoUploadGrant(stolenPath, owner.uid);
  await denied(uploadBytes(storageRef(admin.storage, stolenPath),
    image, { contentType: "image/png" }), "Admin cannot use another owner grant");
  const revokedPath = proofPath.replace("attempt_1234567890123456", "revoked_attempt_12345678");
  await seedDemoUploadGrant(revokedPath, owner.uid);
  await adminDb.collection("users").doc(owner.uid).update({ active: false });
  await denied(uploadBytes(storageRef(owner.storage, revokedPath),
    image, { contentType: "image/png" }), "Revoked owner cannot upload");
  await adminDb.collection("users").doc(owner.uid).update({ active: true });
});

test("Storage rejects invalid MIME, invoice/attempt path and oversized slip", async () => {
  const storage = identities.get("owner-a").storage;
  const buf = new Uint8Array([10, 20, 30]);
  await denied(uploadBytes(storageRef(storage, proofPath.replace("proof.png", "bad.txt")),
    buf, { contentType: "text/html" }));
  await denied(uploadBytes(storageRef(storage, proofPath.replace(invoiceId, "malformed")),
    buf, { contentType: "image/png" }));
  await denied(uploadBytes(storageRef(storage, proofPath.replace(invoiceId,
    "2026-10-22:delivery:2026-11-01")),
    buf, { contentType: "image/png" }),
  "Even a well-formed invoice ID must exist in the tenant ledger");
  await denied(uploadBytes(storageRef(storage,
    proofPath.replace("attempt_1234567890123456", "tiny")),
  buf, { contentType: "image/png" }));
  // Depending on the Storage emulator/SDK version, oversized uploads can
  // fail as a Rules denial or a transport-level payload-limit error.
  await assert.rejects(uploadBytes(storageRef(storage,
    proofPath.replace("proof.png", "too-big.png")),
    new Uint8Array(10 * 1024 * 1024 + 1), { contentType: "image/png" }));
});

test("Actual Admin Firestore transactions serialize cross-channel bank reference reuse", async () => {
  const evidence = {
    sha256: createHash("sha256").update("same-money-transfer").digest("hex"),
    referenceId: "bank-ref-emulator-test",
  };
  const claims = claimRefs(adminDb, evidence);
  async function reserve(channel) {
    return adminDb.runTransaction(async tx => {
      await checkClaimsInTransaction(tx, claims);
      createClaimsInTransaction(tx, claims, {
        channel, tenantId: "store-a", recordId: channel + "-emulator",
      }, FieldValue.serverTimestamp());
    });
  }
  const results = await Promise.allSettled([reserve("wallet_topup"),
    reserve("revenue_share"), reserve("hybrid")]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.equal(results.filter(row => row.status === "rejected").length, 2);
  assert.equal((await adminDb.getAll(...claims)).filter(doc => doc.exists).length, claims.length);
});

test("Actual Admin Firestore invoice writer is idempotent and preserves PAID", async () => {
  const ref = adminDb.collection("tenants").doc("store-b");
  const sales = [{ date: "2026-11-02", amount: 10000 }];
  const params = {
    cycleStartDate: "2026-10-22", cycleEndExclusiveDate: "2026-11-22",
    asOfDate: "2026-11-03", firstMonth: false, dailyDeliverySales: sales,
    settings: { monthlyFee: 590, deliveryThreshold: 10000,
      deliveryShareRate: 5, monthlySlipQuota: 100 },
  };
  const first = prepareInvoiceLedger(params);
  const issued = await persistHybridInvoiceLedger({
    db: adminDb, tenantRef: ref, ledger: first,
    serverTimestamp: FieldValue.serverTimestamp(),
  });
  assert.equal(issued.created, 1);
  const period = (await ref.collection("hybridBillingPeriods").doc(first.cycleStartDate).get()).data();
  const records = await ref.collection("hybridBillingInvoices").get();
  const oldInvoices = records.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  assert.equal(oldInvoices.length, 1);
  const claimed = ref.collection("hybridBillingInvoices").doc(oldInvoices[0].id);
  await claimed.update({ status: "paid", paidAt: FieldValue.serverTimestamp() });
  const replay = prepareInvoiceLedger({
    ...params, existingPeriod: period,
    existingInvoices: [{ ...oldInvoices[0], status: "paid" }],
  });
  const onceMore = await persistHybridInvoiceLedger({
    db: adminDb, tenantRef: ref, ledger: replay,
    serverTimestamp: FieldValue.serverTimestamp(),
  });
  assert.equal(onceMore.unchanged, true);
  assert.equal((await claimed.get()).data().status, "paid");
  assert.equal((await ref.collection("hybridBillingInvoices").get()).size, 1);
});


test("Real Admin transaction stages slip as pending, then finance review marks paid once", async () => {
  const tenantRef = adminDb.collection("tenants").doc("store-a");
  const raw = Buffer.from("proof-file-for-bank-verification-emulator");
  const verification = {
    provider: "slip2go", status: "matched", bankVerified: true,
    referenceId: "emulator-bank-ref-1", transRef: "emulator-bank-tx-1",
  };
  const prepared = {
    tenantId: "store-a", invoiceId,
    attemptId: "attempt_1234567890123456",
    slipPath: proofPath, size: raw.length, mime: "image/png",
    invoiceSignature: "a".repeat(64), invoiceAmount: 500,
    verification,
    fingerprintIds: fingerprintClaims(raw, verification),
    sharedClaimIds: claimIds({
      sha256: createHash("sha256").update(raw).digest("hex"),
      referenceId: verification.referenceId, transRef: verification.transRef,
    }),
  };
  const staged = await stageHybridInvoiceProof({
    requireUploadGrant: false, // Tests only the pre-existing bare transaction mechanics.
    db: adminDb, tenantRef, prepared, actorId: "test-owner",
    serverTimestamp: FieldValue.serverTimestamp(),
  });
  assert.equal(staged.status, "pending_review");
  const invoiceRef = tenantRef.collection("hybridBillingInvoices").doc(invoiceId);
  assert.equal((await invoiceRef.get()).data().status, "pending_review");
  const attempts = tenantRef.collection("hybridBillingPaymentAttempts");
  assert.equal((await attempts.doc(prepared.attemptId).get()).data().status, "pending_review");
  await assert.rejects(stageHybridInvoiceProof({
    requireUploadGrant: false, // Tests only the pre-existing bare transaction mechanics.
    db: adminDb, tenantRef, prepared, actorId: "test-owner",
    serverTimestamp: FieldValue.serverTimestamp(),
  }), /HYBRID_PAYMENT_ALREADY_PENDING_OR_PAID|FINANCE_SLIP_ALREADY_CLAIMED/);
  const approved = await reviewHybridInvoiceProof({
    db: adminDb, tenantRef, invoiceId, attemptId: prepared.attemptId,
    action: "approve", reviewerId: "test-super-admin", note: "Slip2Go bank confirmed",
    serverTimestamp: FieldValue.serverTimestamp(),
  });
  assert.equal(approved.status, "paid");
  assert.equal((await invoiceRef.get()).data().status, "paid");
  assert.equal((await invoiceRef.get()).data().amount, 500);
  await denied(uploadBytes(storageRef(identities.get("owner-a").storage,
    proofPath.replace("proof.png", "after-paid.png")),
    new Uint8Array([137, 80, 78, 71]), { contentType: "image/png" }),
  "Paid invoices cannot accept new bank slips");
  assert.equal((await tenantRef.get()).data().subscriptionStatus, "active",
    "Payment processing never changes unrelated store access");
  await assert.rejects(reviewHybridInvoiceProof({
    db: adminDb, tenantRef, invoiceId, attemptId: prepared.attemptId,
    action: "approve", reviewerId: "test-super-admin",
    serverTimestamp: FieldValue.serverTimestamp(),
  }), /HYBRID_PAYMENT_ALREADY_REVIEWED/);
});
