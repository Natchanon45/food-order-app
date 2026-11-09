import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
if (!getApps().length) initializeApp({ projectId: "demo-penguin-hybrid" });
const db = getFirestore();
const wallet = require("./tenant-lalamove-wallet");
const revenue = require("./revenue-share");
const policy = require("./finance-manual-review-policy");
const admin = { auth: { uid: "p1-slip-policy-superadmin" } };
const tenantId = "p1-slip-policy-tenant";
const tenantRef = db.collection("tenants").doc(tenantId);
const technical = Object.freeze({
  provider: "slip2go", status: "manual_review", reason: "slip2go_bank_error",
  code: "200502", fallbackAllowed: true, amountMatched: null,
});
const baseWallet = (id, proof) => ({
  id, amount: 500, currency: "THB", status: "pending",
  verificationProvider: "slip2go", verificationStatus: proof.status, ocr: proof,
});
const baseRevenue = (id, proof) => ({
  id, platformAmountDue: 50, status: "pending", periodType: "daily",
  periodStart: "2026-11-07", periodEnd: "2026-11-07",
  slipVerificationProvider: "slip2go",
  slipVerificationStatus: proof.status, ocr: proof,
});
test("manual approval policy only accepts checked Slip2Go technical failures", () => {
  assert.equal(policy.walletTopupManualReviewAllowed(baseWallet("good", technical)), true);
  assert.equal(policy.revenueShareManualReviewAllowed(baseRevenue("good", technical)), true);
  const variants = [
    ...[["slip2go_package_expired", "401004"],
      ["slip2go_quota_exhausted", "401005"],
      ["slip2go_quota_exhausted", "401006"],
      ["slip2go_rate_limited", "429000"]].map(([reason, code]) =>
        ({ ...technical, reason, code })),
    { ...technical, reason: "amount_not_matched", status: "mismatch", fallbackAllowed: false },
    { ...technical, reason: "slip2go_receiver_mismatch", status: "receiver_mismatch", fallbackAllowed: false },
    { ...technical, reason: "slip2go_duplicate", status: "duplicate", fallbackAllowed: false },
    { ...technical, reason: "slip2go_date_mismatch", fallbackAllowed: false, code: "200403" },
    { ...technical, reason: "slip2go_found_unverified", fallbackAllowed: false, code: "200000" },
    { ...technical, reason: "slip2go_condition_request_invalid", fallbackAllowed: false, code: "400400" },
    { ...technical, reason: "slip2go_http_error", fallbackAllowed: false, code: "" },
    { ...technical, reason: "slip2go_image_required", code: "" },
    { ...technical, reason: "slip2go_config_required", code: "" },
    { ...technical, code: "200402" },
    { ...technical, amountMatched: false },
    { ...technical, provider: "google_vision" },
    { ...technical, fallbackAllowed: false },
  ];
  variants.forEach((variant, index) => {
    assert.equal(policy.walletTopupManualReviewAllowed(baseWallet("bad" + index, variant)),
      false, JSON.stringify(variant));
    assert.equal(policy.revenueShareManualReviewAllowed(baseRevenue("bad" + index, variant)),
      false, JSON.stringify(variant));
  });
  assert.equal(policy.walletTopupManualReviewAllowed(baseWallet("a", {
    ...technical, reason: "slip2go_unavailable", code: "",
  })), true);
  assert.equal(policy.walletTopupManualReviewAllowed(baseWallet("b", {
    ...technical, reason: "slip2go_rate_limited", code: "429000",
  })), false);
});

test("Wallet review rejects mismatched slip without credit and allows technical-only approval", async () => {
  await db.collection("users").doc(admin.auth.uid).set({
    uid: admin.auth.uid, role: "super_admin", active: true,
  });
  await tenantRef.set({ id: tenantId, slug: "p1-slip-tenant", active: true,
    name: "Test Slip Wallet" });
  await tenantRef.collection("settings").doc("lalamoveWallet").set({
    balance: 75, currency: "THB",
  });
  const badId = "p1-slip-wallet-mismatch";
  await tenantRef.collection("lalamoveWalletTopups").doc(badId).set(baseWallet(
    badId, { ...technical, status: "mismatch", reason: "amount_not_matched",
      fallbackAllowed: false, code: "200402" },
  ));
  await assert.rejects(wallet.reviewTenantLalamoveWalletTopup.run({
    ...admin, data: { tenantId, topupId: badId, action: "approve" },
  }), error => error.code === "failed-precondition"
    && error.message.includes("SLIP_MANUAL_REVIEW_NOT_ELIGIBLE"));
  assert.equal((await tenantRef.collection("lalamoveWalletTopups").doc(badId).get())
    .data().status, "pending");
  assert.equal((await tenantRef.collection("settings").doc("lalamoveWallet").get())
    .data().balance, 75);

  const technicalId = "p1-slip-wallet-technical";
  await tenantRef.collection("lalamoveWalletTopups").doc(technicalId).set(
    baseWallet(technicalId, technical));
  const approved = await wallet.reviewTenantLalamoveWalletTopup.run({
    ...admin, data: { tenantId, topupId: technicalId, action: "approve",
      note: "Bank verification provider unavailable" },
  });
  assert.equal(approved.ok, true);
  assert.equal((await tenantRef.collection("settings").doc("lalamoveWallet").get())
    .data().balance, 575);
  assert.equal((await tenantRef.collection("lalamoveWalletTopups").doc(technicalId).get())
    .data().status, "approved");
  await assert.rejects(wallet.reviewTenantLalamoveWalletTopup.run({
    ...admin, data: { tenantId, topupId: technicalId, action: "approve" },
  }), error => error.code === "already-exists");
  assert.equal((await tenantRef.collection("settings").doc("lalamoveWallet").get())
    .data().balance, 575);

  const rejected = await wallet.reviewTenantLalamoveWalletTopup.run({
    ...admin, data: { tenantId, topupId: badId, action: "reject",
      note: "Amount mismatch" },
  });
  assert.equal(rejected.ok, true);
  assert.equal((await tenantRef.collection("lalamoveWalletTopups").doc(badId).get())
    .data().status, "rejected");
  assert.equal((await tenantRef.collection("settings").doc("lalamoveWallet").get())
    .data().balance, 575);
});

test("Revenue Share manual review refuses a persisted Slip2Go mismatch before settlement", async () => {
  const id = "p1-slip-share-mismatched";
  const ref = tenantRef.collection("revenueSharePayments").doc(id);
  await ref.set(baseRevenue(id, { ...technical, status: "receiver_mismatch",
    reason: "slip2go_receiver_mismatch", code: "200401",
    fallbackAllowed: false }));
  await assert.rejects(revenue.reviewRevenueSharePayment.run({
    ...admin, data: { tenantId, paymentId: id, action: "approve" },
  }), error => error.code === "failed-precondition"
    && error.message.includes("SLIP_MANUAL_REVIEW_NOT_ELIGIBLE"));
  assert.equal((await ref.get()).data().status, "pending");
});

test("exhausted, expired and rate-limited provider accounts cannot credit Wallet or settle Revenue Share", async () => {
  const balanceBefore = (await tenantRef.collection("settings").doc("lalamoveWallet").get()).data().balance;
  for (const [reason, code] of [["slip2go_package_expired", "401004"],
    ["slip2go_quota_exhausted", "401005"], ["slip2go_quota_exhausted", "401006"],
    ["slip2go_rate_limited", "429000"]]) {
    const proof = { ...technical, reason, code };
    const topupId = "p1-capacity-wallet-" + code;
    const paymentId = "p1-capacity-share-" + code;
    await tenantRef.collection("lalamoveWalletTopups").doc(topupId).set(baseWallet(topupId, proof));
    await tenantRef.collection("revenueSharePayments").doc(paymentId).set(baseRevenue(paymentId, proof));
    await assert.rejects(wallet.reviewTenantLalamoveWalletTopup.run({ ...admin,
      data: { tenantId, topupId, action: "approve" },
    }), error => error.code === "failed-precondition");
    await assert.rejects(revenue.reviewRevenueSharePayment.run({ ...admin,
      data: { tenantId, paymentId, action: "approve" },
    }), error => error.code === "failed-precondition");
    assert.equal((await tenantRef.collection("lalamoveWalletTopups").doc(topupId).get()).data().status, "pending");
    assert.equal((await tenantRef.collection("revenueSharePayments").doc(paymentId).get()).data().status, "pending");
  }
  assert.equal((await tenantRef.collection("settings").doc("lalamoveWallet").get()).data().balance, balanceBefore);
});
