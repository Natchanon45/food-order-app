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

test("Super Admin invoice review is routed, linked from platform and role protected", () => {
  assert.match(app, /import \{ HybridBillingReviewPage \}/);
  assert.match(app, /path="\/platform\/hybrid-invoices" element=\{<HybridBillingReviewPage \/>\}/);
  assert.match(platform, /to="\/platform\/hybrid-invoices"/);
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
  assert.match(admin, /listHybridInvoices\(selectedId, \{ cursor: invoiceCursor \}\)/);
  assert.match(admin, /listHybridPaymentAttempts\(selectedId, \{ cursor: attemptCursor \}\)/);
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
