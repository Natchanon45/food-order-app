"use strict";

// Global server-only immutable claims shared by Revenue Share, Lalamove
// Wallet topups and Hybrid Billing. Never store bank references in cleartext.
// This module has no deployed callable; callers MUST use the SAME Firestore
// transaction that creates the associated payment/credit/attempt.
const { createHash } = require("node:crypto");

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}
function normalizeReference(ref) {
  const value = String(ref ?? "").trim().normalize("NFKC");
  if (value.length > 180 || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error("FINANCE_SLIP_INVALID_REFERENCE");
  }
  return value;
}
function claimIds({ sha256, referenceId = "", transRef = "" } = {}) {
  if (!/^[a-f0-9]{64}$/.test(String(sha256 || ""))) {
    throw new Error("FINANCE_SLIP_SHA256_REQUIRED");
  }
  // One shared bank namespace, independent of provider field. An ID used
  // as a transRef elsewhere cannot be reused as a referenceId here.
  const values = [
    "file_" + sha256,
    ...[referenceId, transRef].map(normalizeReference)
      .filter(Boolean).map(ref => "bank_" + digest("finance-slip-bank-v1:" + ref)),
  ];
  return [...new Set(values)].sort();
}
function claimRefs(db, data) {
  return claimIds(data).map(id => db.collection("financeSlipClaims").doc(id));
}
async function checkClaimsInTransaction(transaction, refs) {
  const snapshots = [];
  for (const ref of refs) snapshots.push(await transaction.get(ref));
  if (snapshots.some(snapshot => snapshot.exists)) {
    throw new Error("FINANCE_SLIP_ALREADY_CLAIMED");
  }
}
function createClaimsInTransaction(transaction, refs, metadata, timestamp) {
  if (!["revenue_share", "wallet_topup", "hybrid"].includes(metadata?.channel)
    || !/^[a-zA-Z0-9_-]{3,160}$/.test(String(metadata?.tenantId || ""))
    || !metadata?.recordId || !timestamp) {
    throw new Error("FINANCE_SLIP_INVALID_CLAIM_METADATA");
  }
  for (const ref of refs) transaction.create(ref, {
    channel: metadata.channel, tenantId: metadata.tenantId,
    recordId: metadata.recordId, createdAt: timestamp,
  });
}
module.exports = {
  normalizeReference, claimIds, claimRefs, checkClaimsInTransaction,
  createClaimsInTransaction,
};
