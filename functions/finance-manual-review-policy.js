"use strict";
// Manual settlement is only available for a documented technical Slip2Go
// failure AFTER its verification HTTP call was attempted. A rejected,
// mismatched, duplicated, unverified, unsupported or Vision-only slip never
// becomes manual-review eligible.
const TECHNICAL_REASONS = new Set([
  "slip2go_unavailable", "slip2go_bank_error",
  "slip2go_rate_limited", "slip2go_quota_exhausted",
  "slip2go_package_expired",
]);
const ALLOWED_CODES = new Set(["200502", "401004", "401005", "401006", "429000"]);

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
    slip2go_rate_limited: ["429000"],
    slip2go_quota_exhausted: ["401005", "401006"],
    slip2go_package_expired: ["401004"],
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
