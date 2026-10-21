"use strict";
// Phase 3AB SOURCE safeguard: deployed legacy Admin SDK payment routes lack an
// atomic Hybrid receipt journal. Reject Hybrid transitions pending full cutover.
// Not global enforcement: other Admin SDK writers remain a release blocker.
function legacyDeliveryPaidWriterAllowed(tenant) {
  if (!tenant || typeof tenant !== "object" || Array.isArray(tenant)) return false;
  if (tenant.billingPolicyVersion === "hybrid_v1" || tenant.hybridBillingEnabled === true) return false;
  if (tenant.hybridReceiptJournalCoverageReady === true ||
      (tenant.hybridReceiptJournalMode !== undefined && tenant.hybridReceiptJournalMode !== null)) return false;
  return true;
}
module.exports = { legacyDeliveryPaidWriterAllowed };
