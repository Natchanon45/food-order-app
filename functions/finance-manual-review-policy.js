"use strict";
// Manual settlement is only available for a documented technical Slip2Go
// failure AFTER its verification HTTP call was attempted. A rejected,
// mismatched, duplicated, unverified, unsupported or Vision-only slip never
// becomes manual-review eligible.
// Purchased credit, package expiry and rate limits are operator capacity
// failures, not bank/provider outages. They never authorize settlement.
const TECHNICAL_REASONS = new Set([
  "slip2go_unavailable", "slip2go_bank_error",
]);
const ALLOWED_CODES = new Set(["200502"]);

function allowManualReview({provider, status, proof}) {
  if (provider !== "slip2go" || status !== "manual_review"
    || !proof || typeof proof !== "object"
    || proof.provider !== "slip2go"
    || proof.status !== "manual_review"
    || proof.fallbackAllowed !== true
    || !TECHNICAL_REASONS.has(String(proof.reason || ""))
    || proof.amountMatched === false
    || proof.receiverValidated === false) return false;
  const code = String(proof.code || "").trim();
  if (proof.reason === "slip2go_unavailable") {
    // No HTTP status exists if the call was attempted and the network failed.
    return !code;
  }
  const expectedByReason = {
    slip2go_bank_error: ["200502"],
  };
  return ALLOWED_CODES.has(code)
    && (expectedByReason[proof.reason] || []).includes(code);
}
function walletTopupManualReviewAllowed(row = {}) {
  return row.status === "pending" && allowManualReview({
    provider: String(row.verificationProvider || ""),
    status: String(row.verificationStatus || ""),
    proof: row.ocr,
  });
}
function revenueShareManualReviewAllowed(row = {}) {
  return row.status === "pending" && allowManualReview({
    provider: String(row.slipVerificationProvider || ""),
    status: String(row.slipVerificationStatus || ""),
    proof: row.ocr,
  });
}
module.exports = { allowManualReview, walletTopupManualReviewAllowed,
  revenueShareManualReviewAllowed };
