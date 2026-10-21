"use strict";
// Critical legacy-import admission, used ONLY by old SaaS migrations.
// Transactionally re-read target finance policy before each write.
// Does NOT provide global privileged-writer enforcement.
const { legacyDeliveryPaidWriterAllowed } = require("./hybrid-billing-legacy-payment-guard");
async function transactLegacyMigration({ db, tenantRef, allowCreate = false, onAllowed } = {}) {
  if (!db || typeof db.runTransaction !== "function" || !tenantRef ||
      typeof onAllowed !== "function") throw Error("HYBRID_LEGACY_MIGRATION_BAD_REQUEST");
  return db.runTransaction(async tx => {
    const snap = await tx.get(tenantRef);
    if (snap.exists) {
      if (!legacyDeliveryPaidWriterAllowed(snap.data()))
        throw Error("HYBRID_LEGACY_MIGRATION_TRUSTED_WRITER_REQUIRED");
    } else if (!allowCreate) {
      throw Error("HYBRID_LEGACY_MIGRATION_TARGET_MISSING");
    }
    return onAllowed(tx, snap);
  });
}
module.exports = { transactLegacyMigration };
