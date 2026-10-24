"use strict";

// PRIVATE Final Phase 10: bounded, all-or-nothing cryptographic FORMAT preflight.
// Neither signed synthetic postings nor this batch establish bank provenance.
// Do not expose via callable, attach to a payout writer or import user keys.
const { createHash } = require("node:crypto");
const { verifyHybridSignedBankEvidencePreflight } =
  require("./hybrid-billing-bank-evidence-contract");

const MAX_POSTINGS = 100;
const INPUT_FIELDS = Object.freeze([
  "postings", "trustedRegistry", "expectedProviderId", "asOf",
]);
const ITEM_FIELDS = Object.freeze(["envelope", "expected"]);
const exact = (obj, fields) => Boolean(obj && typeof obj === "object"
  && !Array.isArray(obj) && Object.keys(obj).length === fields.length
  && fields.every(field => Object.hasOwn(obj, field)));
const fail = code => { throw Error("HYBRID_BANK_BATCH_" + code); };

/**
 * ONLY accepts a server-derived expected scope and server-supplied pinned
 * public keys. All input evidence remains UNTRUSTED until a real provider
 * identity and source are independently authenticated elsewhere.
 *
 * No partial results on invalid signature/scope, duplicate bank reference,
 * duplicate outgoing instruction or duplicate tenant+adjustment. These
 * comparisons are global across all tenants in this submitted batch, but
 * CANNOT establish uniqueness against other batches or historical channels.
 */
function preflightHybridSignedBankEvidenceBatch(input = {}) {
  if (!exact(input, INPUT_FIELDS)
    || !Array.isArray(input.postings)
    || input.postings.length === 0 || input.postings.length > MAX_POSTINGS) {
    fail("INPUT_OR_SIZE_INVALID");
  }
  const { postings, trustedRegistry, expectedProviderId, asOf } = input;
  const bankReferences = new Set();
  const instructions = new Set();
  const scopedAdjustments = new Set();
  const contentHashes = [];
  for (const item of postings) {
    if (!exact(item, ITEM_FIELDS)) fail("ITEM_FIELDS_INVALID");
    let checked;
    try {
      checked = verifyHybridSignedBankEvidencePreflight({
        envelope: item.envelope, trustedRegistry,
        expected: item.expected, expectedProviderId, asOf,
      });
    } catch {
      // Never echo an untrusted bank record, provider ID, reference or signer.
      fail("ITEM_REJECTED");
    }
    if (checked.signatureCryptographicallyValid !== true
      || checked.payloadScopeMatched !== true
      || checked.bankProviderIdentityIndependentlyAuthenticated !== false
      || checked.settlementAllowed !== false || checked.writesPerformed !== false) {
      fail("UNSAFE_CHECK_RESULT");
    }
    const expected = item.expected;
    if (bankReferences.has(expected.bankReferenceHash))
      fail("REPEATED_BANK_REFERENCE");
    if (instructions.has(expected.instructionHash))
      fail("REPEATED_OUTGOING_INSTRUCTION");
    const scopedAdjustment = JSON.stringify([
      expected.tenantId, expected.adjustmentId,
    ]);
    if (scopedAdjustments.has(scopedAdjustment))
      fail("REPEATED_TENANT_ADJUSTMENT");
    bankReferences.add(expected.bankReferenceHash);
    instructions.add(expected.instructionHash);
    scopedAdjustments.add(scopedAdjustment);
    contentHashes.push(checked.evidenceContentSha256);
  }
  // Order-insensitive content-set checksum for triage, not a signature,
  // global replay ledger, historical completeness or bank authentication.
  const batchContentSha256 = createHash("sha256")
    .update("PENGUIN-HYBRID-BANK-BATCH-CONTENT-V1\n"
      + JSON.stringify(contentHashes.sort()), "utf8").digest("hex");
  return Object.freeze({
    kind: "hybrid_bank_posting_batch_preflight_v1",
    mode: "private_cryptographic_format_check_only",
    postingsChecked: postings.length,
    uniqueBankReferences: bankReferences.size,
    uniqueOutgoingInstructions: instructions.size,
    uniqueTenantAdjustments: scopedAdjustments.size,
    batchContentSha256,
    bankProviderIdentityIndependentlyAuthenticated: false,
    realBankStatementSourceIntegrated: false,
    globalHistoricalReplayChecked: false,
    historicalPayoutsVerified: false,
    settlementConfirmed: false,
    settlementAllowed: false,
    releaseReady: false,
    writesPerformed: false,
  });
}

module.exports = { preflightHybridSignedBankEvidenceBatch };
