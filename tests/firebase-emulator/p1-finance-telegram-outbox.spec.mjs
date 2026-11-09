import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
if (!getApps().length) initializeApp({ projectId: "demo-penguin-hybrid" });
const db = getFirestore();
const { _privateForTests: events } = require("./platform-telegram-finance-events");

const id = "p1-finance-test-tenant";
const walletId = "p1-telegram-wallet-12345";
const shareId = "p1-telegram-share-54321";
const verified = Object.freeze({
  provider: "slip2go", status: "matched",
  reason: "slip2go_verified", amountMatched: true, fallbackAllowed: false,
});
const tech = Object.freeze({
  provider: "slip2go", status: "manual_review", reason: "slip2go_bank_error",
  amountMatched: null, code: "200502", fallbackAllowed: true,
});

test("only committed wallet/share receipts produce correctly classified, safe notices", () => {
  const wallet = { status: "approved", reviewedBy: "system:slip2go",
    verificationProvider: "slip2go", verificationStatus: "matched",
    amount: 390.75, ocr: verified, destination: {
      accountName: "NEVER_SHARE_PERSONAL_NAME", accountNumber: "1234567890",
    }, slip: { path: "DO_NOT_EXPOSE_SLIP_PATH" },
  };
  const classified = events.classifyChange("wallet_topup",
    { tenantId: id, receiptId: walletId }, null, wallet);
  assert.equal(classified.outcome, "verified");
  assert.equal(classified.amountSatang, 39075);
  assert.match(classified.text, /Slip2Go ตรวจผ่าน/);
  assert.match(classified.text, /390.75|390,75/);
  assert.equal(JSON.stringify(classified).includes("1234567890"), false);
  assert.equal(JSON.stringify(classified).includes("NEVER_SHARE_PERSONAL_NAME"), false);
  assert.equal(JSON.stringify(classified).includes("DO_NOT_EXPOSE_SLIP_PATH"), false);
  const technical = events.classifyChange("delivery_share",
    { tenantId: id, receiptId: shareId }, null, {
      status: "pending", platformAmountDue: 89.50,
      slipVerificationProvider: "slip2go",
      slipVerificationStatus: "manual_review", ocr: tech,
    });
  assert.equal(technical.outcome, "manual_review");
  assert.notEqual(technical.id, classified.id);
  const unverified = events.classifyChange("wallet_topup",
    { tenantId: id, receiptId: walletId }, null,
    { status: "pending", amount: 250, verificationProvider: "google_vision",
      verificationStatus: "manual_review", ocr: {
        provider: "google_vision", status: "manual_review",
      } });
  assert.equal(unverified.outcome, "pending_unverified");
  assert.doesNotMatch(unverified.text, /Slip2Go ตรวจผ่าน/);
  const rejected = events.classifyChange("wallet_topup",
    { tenantId: id, receiptId: walletId }, null,
    { status: "pending", amount: 250, verificationProvider: "slip2go",
      verificationStatus: "mismatch" });
  assert.equal(rejected.outcome, "provider_rejected");
  assert.doesNotMatch(rejected.text, /อาจตรวจด้วยคนได้/);
  assert.equal(events.classifyChange("wallet_topup",
    { tenantId: "../../malicious", receiptId: walletId }, null, wallet), null);
  assert.equal(events.classifyChange("wallet_topup",
    { tenantId: id, receiptId: "../bad" }, null, wallet), null);
  assert.equal(events.classifyChange("wallet_topup",
    { tenantId: id, receiptId: walletId }, wallet, wallet), null);
});

test("manual review outcomes create distinct ids only after a status transition", () => {
  const before = { status: "pending", amount: 250 };
  const after = { ...before, status: "approved", reviewedBy: "superadmin-abc" };
  const approved = events.classifyChange("wallet_topup",
    { tenantId: id, receiptId: walletId }, before, after);
  assert.equal(approved.outcome, "admin_approved");
  const rejected = events.classifyChange("wallet_topup",
    { tenantId: id, receiptId: walletId }, before,
    { ...after, status: "rejected" });
  assert.equal(rejected.outcome, "admin_rejected");
  assert.notEqual(rejected.id, approved.id);
  assert.equal(events.classifyChange("wallet_topup",
    { tenantId: id, receiptId: walletId }, { status: "approved" }, after), null);
  assert.equal(events.classifyChange("wallet_topup",
    { tenantId: id, receiptId: walletId }, before,
    { ...after, reviewedBy: "system:slip2go" }), null);
});

test("Firestore outbox is idempotent and disabled config suppresses delivery", async () => {
  const sample = events.eventMessage({ channel: "wallet_topup",
    tenantId: id, receiptId: walletId, outcome: "pending_unverified", amount: 180 });
  const disabled = await events.enqueue(sample);
  assert.equal(disabled.queued, false);
  await db.collection("platformSettings").doc("telegram_superadmin_slip_manual").set({
    enabled: true, chatId: "-1001234567890", tokenEncrypted: "v1:placeholder-for-emulator-only",
  });
  const first = await events.enqueue(sample);
  assert.equal(first.queued, true);
  const duplicate = await events.enqueue(sample);
  assert.equal(duplicate.queued, false);
  assert.equal(duplicate.reason, "DUPLICATE");
  const outbox = await db.collection(events.OUTBOX).doc(sample.id).get();
  assert.equal(outbox.data().status, "pending");
  assert.equal(outbox.data().tenantId, id);
  assert.equal(JSON.stringify(outbox.data()).includes("placeholder-for-emulator-only"), false);
  // A disabled channel fails safe without network. No automatic duplicate retry.
  await db.collection("platformSettings").doc("telegram_superadmin_slip_manual").set({
    enabled: false,
  }, { merge: true });
  await events.deliver(sample.id);
  assert.equal((await outbox.ref.get()).data().status, "unconfirmed");
  await events.deliver(sample.id);
  assert.equal((await outbox.ref.get()).data().status, "unconfirmed");
});
