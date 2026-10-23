import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const actions = read("react-app/src/data/hybridPaymentActions.js");
const panel = read("react-app/src/components/HybridReviewDecisionPanel.jsx");
const page = read("react-app/src/pages/HybridBillingReviewPage.jsx");
const styles = read("react-app/public/parity/css/hybrid-billing-review.css");
const backend = read("functions/hybrid-billing-payment-callables.js");
const boot = read("functions/bootstrap.js");

test("UI and server both hard-lock approval, not configurable from Firestore", () => {
  assert.match(actions, /HYBRID_PAYMENT_UI_READY = false/);
  assert.match(actions, /if \(!HYBRID_PAYMENT_UI_READY\)/);
  assert.match(panel, /!HYBRID_PAYMENT_UI_READY \|\| busy/);
  assert.match(panel, /disabled=\{!HYBRID_PAYMENT_UI_READY \|\| busy \|\| !canApprove\}/);
  assert.match(panel, /disabled=\{!HYBRID_PAYMENT_UI_READY \|\| busy \|\| !canReject\}/);
  assert.match(backend, /HYBRID_PAYMENT_CALLABLE_READY = false/);
  assert.match(backend, /enforceAppCheck: true/);
  assert.doesNotMatch(boot, /hybrid-billing-payment-callables/);
});

test("Super Admin form never gets to patch Firestore status or client-defined amount", () => {
  assert.match(actions, /httpsCallable\(functions, "reviewHybridInvoicePaymentProof"\)/);
  assert.match(actions, /tenantId, invoiceId, attemptId, action, note, verifiedExternally/);
  assert.doesNotMatch(actions + panel, /setDoc\(|updateDoc\(|deleteDoc\(|runTransaction\(/);
  assert.doesNotMatch(actions + panel, /amount:|status: "paid"|walletBalance|subscriptionStatus/);
  assert.match(panel, /onReviewed\?\.\(\)/);
});

test("Finance review panel shows actual pending attempts and never changes invoice totals", () => {
  assert.match(page, /HybridReviewDecisionPanel/);
  assert.match(page, /tenantId=\{selectedId\} payment=\{row\}/);
  assert.match(panel, /payment.status !== "pending_review"/);
  assert.match(panel, /note.trim\(\).length >= 20/);
  assert.match(panel, /note.trim\(\).length >= 6/);
  assert.match(panel, /verifiedExternally/);
  assert.match(panel, /setRevision\(value => value \+ 1\)/);
});

test("Finance approval UX is responsive, bilingual and clearly disabled", () => {
  assert.match(panel, /Independently confirmed with the receiving bank/);
  assert.match(panel, /Review is disabled pending callable UAT/);
  assert.match(panel, /Finance review note/);
  assert.match(panel, /Approve/);
  assert.match(panel, /Reject/);
  assert.match(styles, /hybrid-review-decision/);
  assert.match(styles, /@media\(max-width:760px\)/);
});
