import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const app = read("react-app/src/app/App.jsx");
const platform = read("react-app/src/pages/PlatformPage.jsx");
const owner = read("react-app/src/pages/HybridBillingReportPage.jsx");
const admin = read("react-app/src/pages/HybridBillingReviewPage.jsx");
const data = read("react-app/src/data/hybridInvoiceReviewData.js");
const rules = read("firestore.rules");

test("Super Admin invoice review route remains protected while its Platform card stays hidden", () => {
  assert.match(app, /import \{ HybridBillingReviewPage \}/);
  assert.match(app, /path="\/platform\/hybrid-invoices" element=\{<HybridBillingReviewPage \/>\}/);
  assert.doesNotMatch(platform, /to="\/platform\/hybrid-invoices"/);
  assert.match(platform, /Hybrid invoice review route and its existing data are retained/);
  assert.match(admin, /auth\.profile\.role !== "super_admin"/);
  assert.match(admin, /<Navigate to="\/login\?next=%2Fplatform%2Fhybrid-invoices"/);
});

test("Tenant invoice history is visible separately from nonpayable projected fees", () => {
  assert.match(owner, /listHybridInvoices\(tenant\.id\)/);
  assert.match(owner, /Your issued invoices|รายการบิลจริงของร้าน/);
  assert.match(owner, /payments remain disabled/);
  assert.match(owner, /hybrid-review-status/);
  assert.match(owner, /getHybridBillingPreview\(month\)/);
});

test("Tenant and Super Admin lists use page cursors and Firestore tenant-scoped reads", () => {
  assert.match(data, /collection\(db, "tenants", tenantId, "hybridBillingInvoices"\)/);
  assert.match(data, /collection\(db, "tenants", tenantId, "hybridBillingPaymentAttempts"\)/);
  assert.match(data, /startAfter\(cursor\)/);
  assert.match(data, /queryLimit\(pageSize\)/);
  assert.match(admin, /loadMoreTenants\(tenantCursor\)/);
  assert.match(admin, /loadMoreDetails\("invoices", invoiceCursor,/);
  assert.match(admin, /loadMoreDetails\("attempts", attemptCursor,/);
});

test("Browser invoice UI does not approve, pay, upload proofs or mutate financial state", () => {
  assert.doesNotMatch(data + admin + owner, /reviewTrustedHybridProof|submitTrustedHybridProof|updateDoc\(|setDoc\(|deleteDoc\(|addDoc\(/);
  assert.doesNotMatch(data, /httpsCallable|uploadBytes|runTransaction/);
  assert.match(admin, /read-only|อ่านอย่างเดียว/);
  assert.match(rules, /match \/hybridBillingInvoices\/\{invoiceId\}/);
  assert.match(rules, /allow create, update, delete: if false/);
});

test("Localized page and responsive layout show only whitelisted bank metadata", () => {
  assert.match(admin, /intlLocale\.startsWith\("th"\)/);
  assert.match(admin, /LocaleSwitcher/);
  assert.match(data, /bankVerified: p\.verification\?\.bankVerified === true/);
  assert.doesNotMatch(data, /textExcerpt|slipPath: p\.|referenceId: p\./);
  const style = read("react-app/public/parity/css/hybrid-billing-review.css");
  assert.match(style, /@media\(max-width:760px\)/);
  assert.match(style, /hybrid-review-status\.pending_review/);
});

test("Super Admin finance audit reads only whitelisted immutable review events", () => {
  assert.match(data, /export async function listHybridPaymentReviewEvents\(/);
  assert.match(data, /collection\(db, "tenants", tenantId, "hybridBillingPaymentEvents"\)/);
  assert.match(data, /orderBy\("reviewedAt", "desc"\)/);
  assert.match(data, /notePreview: String\(event\.note \|\| ""\)/);
  assert.match(data, /\[redacted\]/);
  assert.match(data, /reviewerId: String\(event\.reviewerId \|\| ""\)/);
  assert.doesNotMatch(data, /rawVerification|referenceId: event|transRef: event|slipPath: event/);
  assert.match(admin, /listHybridPaymentReviewEvents\(selectedId\)/);
  assert.match(admin, /Finance review audit trail/);
  assert.match(admin, /setReviewEvents\(\[\]\)/);
  assert.match(admin, /loadMoreDetails\("events", eventCursor,/);
  assert.match(rules, /match \/hybridBillingPaymentEvents\/\{eventId\}/);
  assert.doesNotMatch(admin, /setDoc\(|updateDoc\(|deleteDoc\(/);
});

test("all three finance page types block stale tenant/refresh results and duplicates", () => {
  assert.match(admin, /detailScope = selectedId \+ ":" \+ revision/);
  assert.match(admin, /detailScopeRef\.current = detailScope/);
  assert.match(admin, /loadedDetailScope === detailScope/);
  assert.match(admin, /const visibleInvoices = detailsReady \? invoices : \[\]/);
  assert.match(admin, /const visibleAttempts = detailsReady \? attempts : \[\]/);
  assert.match(admin, /const visibleReviewEvents = detailsReady \? reviewEvents : \[\]/);
  assert.match(admin, /detailScopeRef\.current !== expectedScope/);
  assert.match(admin, /const seen = new Set\(previous\.map\(item => item\.id\)\)/);
  assert.match(admin, /setLoadedDetailScope\(detailScope\)/);
});

test("React audit pagination prevents synchronous duplicate requests", () => {
  assert.match(admin, /pageInFlightRef = useRef/);
  assert.match(admin, /pageInFlightRef\.current = requestScope/);
  assert.match(admin, /pageInFlightRef\.current === requestScope/);
});


test("finance adjustments and immutable review history are read-only and tenant scoped", () => {
  assert.match(data, /export async function listHybridAdjustments\(/);
  assert.match(data, /export async function listHybridAdjustmentReviewEvents\(/);
  assert.match(data, /collection\(db, "tenants", tenantId, "hybridBillingAdjustments"\)/);
  assert.match(data, /collection\(db, "tenants", tenantId, "hybridBillingAdjustmentEvents"\)/);
  assert.match(data, /orderBy\("proposedAt", "desc"\)/);
  assert.match(data, /orderBy\("reviewedAt", "desc"\)/);
  assert.match(admin, /listHybridAdjustments\(selectedId\)/);
  assert.match(admin, /listHybridAdjustmentReviewEvents\(selectedId\)/);
  assert.match(admin, /const visibleAdjustments = detailsReady \? adjustments : \[\]/);
  assert.match(admin, /const visibleAdjustmentEvents = detailsReady \? adjustmentEvents : \[\]/);
  assert.match(admin, /loadMoreDetails\("adjustments", adjustmentCursor,/);
  assert.match(admin, /loadMoreDetails\("adjustment-events", adjustmentEventCursor,/);
  assert.match(admin, /setAdjustments\(\[\]\)/);
  assert.match(admin, /setAdjustmentEvents\(\[\]\)/);
  assert.match(rules, /match \/hybridBillingAdjustments\/\{adjustmentId\}/);
  assert.match(rules, /match \/hybridBillingAdjustmentEvents\/\{eventId\}/);
  assert.match(rules, /match \/hybridBillingAdjustmentBalances\/\{invoiceId\}/);
  assert.doesNotMatch(admin + data, /setDoc\(|updateDoc\(|deleteDoc\(|addDoc\(/);
});

test("internal approval never masquerades as a bank refund or applied credit", () => {
  assert.match(admin, /Internally approved only/);
  assert.match(admin, /No confirmed payout/);
  assert.match(admin, /Payout not confirmed/);
  assert.match(admin, /Credit note \(not applied\)/);
  assert.match(data, /payoutConfirmed: false/);
  assert.doesNotMatch(data, /payoutReference:|bankAccount:|slipPath:|rawOCR:|rawVerification:/);
  assert.match(data, /safeFinanceText/);
  assert.match(admin, /hybrid-adjustment-unsettled/);
});


test("Super Admin sees refund evidence candidates without any bank settlement claim", () => {
  assert.match(data, /export async function listHybridRefundCandidates\(/);
  assert.match(data, /collection\(db, "tenants", tenantId, "hybridBillingRefundCandidates"\)/);
  assert.match(data, /orderBy\("createdAt", "desc"\)/);
  assert.match(data, /state: "awaiting_independent_bank_attestation"/);
  assert.match(data, /bankSourceConfirmed: false/);
  assert.match(admin, /listHybridRefundCandidates\(selectedId\)/);
  assert.match(admin, /visibleRefundCandidates = detailsReady \? refundCandidates : \[\]/);
  assert.match(admin, /setRefundCandidates\(\[\]\)/);
  assert.match(admin, /loadMoreDetails\("refund-candidates", refundCandidateCursor,/);
  assert.match(admin, /Evidence candidates only/);
  assert.match(admin, /Bank attestation pending/);
  assert.match(admin, /Payout not confirmed/);
  assert.match(rules, /match \/hybridBillingRefundCandidates\/\{adjustmentId\}/);
  assert.doesNotMatch(data, /instructionId: evidence\.|bankReferenceHash: evidence\.|destinationFingerprint: evidence\./);
});
