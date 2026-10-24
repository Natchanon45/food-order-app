import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs,
  collection, setDoc, updateDoc, deleteDoc, query, orderBy, limit } from "firebase/firestore";
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
const { recordHybridAdjustmentProposal, reviewHybridAdjustmentProposal } =
  fnRequire("./hybrid-billing-finance-records");
const { recordDemoHybridRefundCandidate } =
  fnRequire("./hybrid-billing-refund-candidate");
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
  // Direct private-function transactions use a separate synthetic actor.
  await adminDb.collection("users").doc("test-super-admin").set({
    role: "super_admin", tenantId: "", active: true,
  });
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

test("Financial compensation balance, proposals and reviewer events are never client-writable", async () => {
  const invoiceId = "2026-10-22:delivery:trigger";
  for (const [collectionName, documentId] of [
    ["hybridBillingAdjustments", "adjustment_12345678901234"],
    ["hybridBillingAdjustmentBalances", invoiceId],
    ["hybridBillingAdjustmentEvents", "adjustment_12345678901234-review"],
  ]) {
    const path = "tenants/store-a/" + collectionName + "/" + documentId;
    await adminDb.doc(path).set({ tenantId: "store-a", invoiceId, status: "proposed",
      amount: 500, proposedAt: FieldValue.serverTimestamp(),
      reviewedAt: FieldValue.serverTimestamp() });
    for (const name of ["owner-a", "admin-a", "cashier-a",
      "super-admin", "owner-b", "anonymous"]) {
      const db = identities.get(name).firestore;
      await denied(setDoc(doc(db, path), { status: "settled" }),
        name + " must not write finance compensation");
      await denied(updateDoc(doc(db, path), { amount: 0 }),
        name + " must not modify finance compensation");
      await denied(deleteDoc(doc(db, path)),
        name + " must not delete finance compensation");
      if (name !== "super-admin" || collectionName === "hybridBillingAdjustmentBalances") {
        await denied(getDoc(doc(db, path)), "Private finance records denied");
      } else {
        assert.equal((await getDoc(doc(db, path))).exists(), true);
      }
    }
  }
});

test("only Super Admin may list the read-only adjustment and decision audit tables", async () => {
  for (const [kind, key] of [
    ["hybridBillingAdjustments", "proposedAt"],
    ["hybridBillingAdjustmentEvents", "reviewedAt"],
  ]) {
    const tablePath = "tenants/store-a/" + kind;
    for (const name of ["super-admin", "owner-a", "admin-a",
      "cashier-a", "owner-b", "anonymous"]) {
      const db = identities.get(name).firestore;
      const table = query(collection(db, tablePath), orderBy(key, "desc"), limit(30));
      if (name === "super-admin") {
        const results = await getDocs(table);
        assert.equal(results.size, 1);
      } else {
        await denied(getDocs(table), name + " may not list private finance adjustments");
      }
    }
  }
  for (const name of ["super-admin", "owner-a", "admin-a", "anonymous"]) {
    const db = identities.get(name).firestore;
    await denied(getDocs(collection(db, "tenants/store-a/hybridBillingAdjustmentBalances")),
      "Per-invoice adjustment caps are never browser readable");
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


test("Admin Emulator locks concurrent adjustment reservations and forbids self-review", async () => {
  const tenantRef = adminDb.collection("tenants").doc("finance-adj-only");
  const financeInvoiceId = "2026-10-24:monthly:fixed";
  const invoiceRef = tenantRef.collection("hybridBillingInvoices").doc(financeInvoiceId);
  await tenantRef.set({
    billingPolicyVersion: "hybrid_v1", active: false,
    hybridBillingSuspended: true, suspensionReason: "security_hold",
  });
  await invoiceRef.create({
    id: financeInvoiceId, tenantId: tenantRef.id,
    version: "hybrid-invoice-v1", signature: "e".repeat(64),
    amount: 500, status: "paid",
  });
  const make = id => recordHybridAdjustmentProposal({
    db: adminDb, tenantRef, invoiceId: financeInvoiceId, proposerId: "test-super-admin",
    request: { id, kind: "refund_request", amount: 350,
      reason: "Independent reconciliation of the original test payment" },
    serverTimestamp: FieldValue.serverTimestamp(),
  });
  const ids = ["finance_adjustment_a_123456", "finance_adjustment_b_123456"];
  const outcomes = await Promise.allSettled(ids.map(id => make(id)));
  assert.equal(outcomes.filter(item => item.status === "fulfilled").length, 1,
    "Exactly one concurrent 350 THB refund can reserve a 500 THB invoice");
  assert.equal(outcomes.filter(item => item.status === "rejected").length, 1);
  const successfulId = ids[outcomes.findIndex(item => item.status === "fulfilled")];
  const reservedRef = tenantRef.collection("hybridBillingAdjustmentBalances")
    .doc(financeInvoiceId);
  assert.equal((await reservedRef.get()).data().reservedCents, 35000);
  const reviewerId = identities.get("super-admin").uid;
  await assert.rejects(reviewHybridAdjustmentProposal({
    db: adminDb, tenantRef, invoiceId: financeInvoiceId,
    adjustmentId: successfulId, reviewerId: "test-super-admin",
    action: "approve", note: "Attempt to approve own proposed financial adjustment",
    serverTimestamp: FieldValue.serverTimestamp(),
  }), /SELF_REVIEW_FORBIDDEN/);
  await adminDb.collection("users").doc(reviewerId).update({ active: false });
  try {
    await assert.rejects(reviewHybridAdjustmentProposal({
      db: adminDb, tenantRef, invoiceId: financeInvoiceId,
      adjustmentId: successfulId, reviewerId,
      action: "approve", note: "Independent finance signoff on a synthetic transfer",
      serverTimestamp: FieldValue.serverTimestamp(),
    }), /SUPER_ADMIN_REQUIRED/);
  } finally {
    await adminDb.collection("users").doc(reviewerId).update({ active: true });
  }
  const reviewed = await reviewHybridAdjustmentProposal({
    db: adminDb, tenantRef, invoiceId: financeInvoiceId,
    adjustmentId: successfulId, reviewerId,
    action: "reject", note: "Insufficient external bank evidence",
    serverTimestamp: FieldValue.serverTimestamp(),
  });
  assert.equal(reviewed.status, "rejected");
  assert.equal(reviewed.refundExecuted, false);
  assert.equal((await reservedRef.get()).data().reservedCents, 0);
  const event = await tenantRef.collection("hybridBillingAdjustmentEvents")
    .doc(successfulId + "-review").get();
  assert.equal(event.data().resultStatus, "rejected");
  assert.equal((await invoiceRef.get()).data().status, "paid");
  assert.equal((await tenantRef.get()).data().hybridBillingSuspended, true);
  assert.equal((await tenantRef.get()).data().active, false);
  await assert.rejects(reviewHybridAdjustmentProposal({
    db: adminDb, tenantRef, invoiceId: financeInvoiceId,
    adjustmentId: successfulId, reviewerId,
    action: "approve", note: "Attempting to reverse an audited decision",
    serverTimestamp: FieldValue.serverTimestamp(),
  }), /ALREADY_REVIEWED/);
  const next = await make("finance_adjustment_c_123456");
  assert.equal(next.status, "proposed",
    "Rejected request releases cap for another independent proposal");
});


test("Demo-only concurrent bank reference claims prevent cross-tenant refund evidence replay", async () => {
  const db = {
    app: { options: { projectId } }, // explicit Firebase Emulator identity
    collection: path => adminDb.collection(path),
    runTransaction: callback => adminDb.runTransaction(callback),
  };
  const financeId = "2026-10-24:monthly:fixed";
  const refHash = createHash("sha256").update("hybrid-refund-unique-reference-1").digest("hex");
  const destHash = createHash("sha256").update("demo-bank-destination").digest("hex");
  const evidence = [];
  for (const [name, adjustId] of [
    ["refund-demo-a", "adjustment_demo_a_123456789"],
    ["refund-demo-b", "adjustment_demo_b_123456789"],
  ]) {
    const tenantRef = adminDb.collection("tenants").doc(name);
    await tenantRef.set({ billingPolicyVersion: "hybrid_v1",
      active: false, hybridBillingSuspended: true });
    await tenantRef.collection("hybridBillingInvoices").doc(financeId).set({
      id: financeId, tenantId: name, version: "hybrid-invoice-v1",
      signature: "f".repeat(64), amount: 500, status: "paid",
    });
    await tenantRef.collection("hybridBillingAdjustments").doc(adjustId).set({
      id: adjustId, tenantId: name, invoiceId: financeId,
      invoiceSignature: "f".repeat(64), amount: 250, amountCents: 25000,
      kind: "refund_request", status: "approved", externallySettled: false,
      proposedBy: "first-super", reviewedBy: "second-super",
    });
    await tenantRef.collection("hybridBillingAdjustmentEvents")
      .doc(adjustId + "-review").set({
        tenantId: name, invoiceId: financeId, adjustmentId: adjustId,
        invoiceSignature: "f".repeat(64), action: "approve",
        resultStatus: "approved", reviewerId: "second-super",
        externallySettled: false,
      });
    const record = {
      db, tenantRef, invoiceId: financeId, adjustmentId: adjustId,
      actorUid: "test-super-admin",
      at: "2026-10-24T10:00:00Z",
      serverTimestamp: FieldValue.serverTimestamp(),
      disbursement: {
        tenantId: name, invoiceId: financeId, adjustmentId: adjustId,
        source: "trusted_finance_disbursement", state: "submitted",
        currency: "THB", amountCents: 25000,
        instructionId: "demo_instruction_123456789_" + (name.endsWith("a") ? "a" : "b"),
        bankReferenceHash: refHash, destinationFingerprint: destHash,
        submittedAt: "2026-10-24T09:00:00Z",
      },
      bankStatement: {
        tenantId: name, invoiceId: financeId, adjustmentId: adjustId,
        source: "trusted_bank_statement", direction: "debit",
        postingStatus: "posted", currency: "THB", amountCents: 25000,
        bankReferenceHash: refHash, destinationFingerprint: destHash,
        postedAt: "2026-10-24T09:30:00Z",
      },
    };
    evidence.push(record);
  }
  const outcomes = await Promise.allSettled(evidence.map(recordDemoHybridRefundCandidate));
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(x => x.status === "rejected").length, 1);
  const claim = await adminDb.collection("hybridRefundReferenceClaims").doc(refHash).get();
  assert.equal(claim.exists, true);
  const winningTenant = claim.data().tenantId;
  assert.equal(["refund-demo-a", "refund-demo-b"].includes(winningTenant), true);
  for (const e of evidence) {
    const candidate = await e.tenantRef.collection("hybridBillingRefundCandidates")
      .doc(e.adjustmentId).get();
    assert.equal(candidate.exists, e.tenantRef.id === winningTenant);
    if (candidate.exists) {
      assert.equal(candidate.data().settlementConfirmed, false);
      assert.equal(candidate.data().sourceIntegrationReady, false);
      assert.equal(candidate.data().state, "awaiting_independent_bank_attestation");
      await assert.rejects(recordDemoHybridRefundCandidate(e),
        /CANDIDATE_ALREADY_EXISTS|BANK_REFERENCE_ALREADY_CLAIMED/);
    }
    const original = await e.tenantRef.collection("hybridBillingInvoices")
      .doc(financeId).get();
    assert.equal(original.data().status, "paid");
    assert.equal((await e.tenantRef.get()).data().hybridBillingSuspended, true);
  }

  for (const name of ["owner-a", "admin-a", "cashier-a",
    "owner-b", "super-admin", "anonymous"]) {
    const browser = identities.get(name).firestore;
    await denied(getDoc(doc(browser, "hybridRefundReferenceClaims/" + refHash)),
      "No browser actor may read global refund claims");
    await denied(setDoc(doc(browser, "hybridRefundReferenceClaims/" + refHash),
      { state: "settled" }), "No browser actor may overwrite global refund claims");
    await denied(getDocs(collection(browser, "hybridRefundReferenceClaims")),
      "No browser role may enumerate bank reference hashes");
    const instruction = evidence.find(e => e.tenantRef.id === winningTenant)
      .disbursement.instructionId;
    const instructionHash = createHash("sha256")
      .update("hybrid-refund-instruction-v1:" + instruction).digest("hex");
    await denied(getDoc(doc(browser, "hybridRefundInstructionClaims/" + instructionHash)),
      "No browser actor may read outgoing instruction claims");
    await denied(setDoc(doc(browser, "hybridRefundInstructionClaims/" + instructionHash),
      { state: "settled" }), "No browser actor may rewrite outgoing instruction claims");
    const candidatePath = "tenants/" + winningTenant + "/hybridBillingRefundCandidates/" +
      evidence.find(e => e.tenantRef.id === winningTenant).adjustmentId;
    await denied(setDoc(doc(browser, candidatePath),
      { settlementConfirmed: true }), "No browser actor can forge settlement");
    if (name === "super-admin") {
      assert.equal((await getDoc(doc(browser, candidatePath))).exists(), true);
    } else {
      await denied(getDoc(doc(browser, candidatePath)),
        "Only active Super Admin can read demo candidate");
    }
  }
});


test("Emulator global instruction claim rejects separate references on same outgoing instruction", async () => {
  const guardedDb = {
    app: { options: { projectId } }, collection: path => adminDb.collection(path),
    runTransaction: fn => adminDb.runTransaction(fn),
  };
  const financeId = "2026-10-25:monthly:fixed";
  const instructionId = "demo_shared_outgoing_instruction_20261025";
  const destinations = ["instr-reuse-a", "instr-reuse-b"];
  const evidence = [];
  for (const [index, tenantId] of destinations.entries()) {
    const tenantRef = adminDb.collection("tenants").doc(tenantId);
    const adjustmentId = "adjustment_ref_test_12345" + index;
    await tenantRef.set({ billingPolicyVersion: "hybrid_v1", active: false,
      hybridBillingSuspended: true });
    await tenantRef.collection("hybridBillingInvoices").doc(financeId).set({
      id: financeId, tenantId, status: "paid", version: "hybrid-invoice-v1",
      signature: "d".repeat(64), amount: 800,
    });
    await tenantRef.collection("hybridBillingAdjustments").doc(adjustmentId).set({
      id: adjustmentId, tenantId, invoiceId: financeId,
      invoiceSignature: "d".repeat(64), amount: 200, amountCents: 20000,
      kind: "refund_request", status: "approved", externallySettled: false,
      proposedBy: "another-proposer", reviewedBy: "different-reviewer",
    });
    await tenantRef.collection("hybridBillingAdjustmentEvents")
      .doc(adjustmentId + "-review").set({
        tenantId, invoiceId: financeId, adjustmentId,
        invoiceSignature: "d".repeat(64), action: "approve",
        resultStatus: "approved", reviewerId: "different-reviewer",
        externallySettled: false,
      });
    const bankHash = createHash("sha256")
      .update("demo_outgoing_ref_" + index).digest("hex");
    const destinationHash = createHash("sha256")
      .update("dest_" + index).digest("hex");
    evidence.push({
      db: guardedDb, tenantRef, invoiceId: financeId,
      adjustmentId, actorUid: "test-super-admin",
      at: "2026-10-25T12:00:00Z",
      serverTimestamp: FieldValue.serverTimestamp(),
      disbursement: {
        tenantId, invoiceId: financeId, adjustmentId,
        source: "trusted_finance_disbursement", state: "submitted",
        currency: "THB", amountCents: 20000, instructionId,
        bankReferenceHash: bankHash, destinationFingerprint: destinationHash,
        submittedAt: "2026-10-25T09:00:00Z",
      },
      bankStatement: {
        tenantId, invoiceId: financeId, adjustmentId,
        source: "trusted_bank_statement", direction: "debit", postingStatus: "posted",
        currency: "THB", amountCents: 20000, bankReferenceHash: bankHash,
        destinationFingerprint: destinationHash, postedAt: "2026-10-25T10:00:00Z",
      },
    });
  }
  const results = await Promise.allSettled(evidence.map(recordDemoHybridRefundCandidate));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected").length, 1);
  const hash = createHash("sha256")
    .update("hybrid-refund-instruction-v1:" + instructionId).digest("hex");
  const claim = await adminDb.collection("hybridRefundInstructionClaims").doc(hash).get();
  assert.equal(claim.exists, true);
  for (const e of evidence) {
    const candidate = await e.tenantRef.collection("hybridBillingRefundCandidates")
      .doc(e.adjustmentId).get();
    assert.equal(candidate.exists, e.tenantRef.id === claim.data().tenantId);
  }
  // The new global outgoing-instruction namespace cannot be listed or
  // modified through any Browser identity, including Super Admin.
  for (const name of ["owner-a", "admin-a", "cashier-a", "owner-b",
    "super-admin", "anonymous"]) {
    const client = identities.get(name).firestore;
    const ref = doc(client, "hybridRefundInstructionClaims/" + hash);
    await denied(getDoc(ref), "Outgoing refund instruction claim is server-private");
    await denied(setDoc(ref, { state: "settled" }),
      "No Browser user can rewrite an outgoing instruction claim");
    await denied(getDocs(collection(client, "hybridRefundInstructionClaims")),
      "No Browser user can enumerate global outgoing instruction hashes");
  }
});
