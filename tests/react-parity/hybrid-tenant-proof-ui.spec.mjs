import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mergeHybridTenantInvoicePage } from "../../react-app/src/data/hybridTenantInvoicePaging.js";
import {
  HYBRID_TENANT_PROOF_SUBMISSION_READY,
  MAX_HYBRID_PROOF_BYTES,
  HYBRID_PROOF_MIME_TYPES,
  isEligibleHybridInvoice,
  validateHybridProofFile,
  describeLocalHybridProof,
  submitHybridTenantProof,
} from "../../react-app/src/data/hybridTenantPaymentDraft.js";

const page = fs.readFileSync("react-app/src/pages/HybridBillingReportPage.jsx", "utf8");
const panel = fs.readFileSync("react-app/src/components/HybridTenantProofPanel.jsx", "utf8");
const model = fs.readFileSync("react-app/src/data/hybridTenantPaymentDraft.js", "utf8");
const css = fs.readFileSync("react-app/public/parity/css/hybrid-billing-review.css", "utf8");
const callable = fs.readFileSync("functions/hybrid-billing-payment-callables.js", "utf8");
const adapter = fs.readFileSync("react-app/src/data/hybridPaymentActions.js", "utf8");
const invoiceAdapter = fs.readFileSync("react-app/src/data/hybridInvoiceReviewData.js", "utf8");
const invoice = { id: "2026-10-22:delivery:trigger", amount: 590, status: "issued" };
const file = (values = {}) => ({
  name: "transfer.png", type: "image/png", size: 412000, ...values,
});

test("only real issued/rejected invoices with valid amount can prepare a local slip", () => {
  assert.equal(isEligibleHybridInvoice(invoice), true);
  assert.equal(isEligibleHybridInvoice({ ...invoice, status: "rejected" }), true);
  for (const status of ["paid", "pending_review", "preview", "expired", undefined]) {
    assert.equal(isEligibleHybridInvoice({ ...invoice, status }), false);
  }
  for (const invalid of [
    { id: "preview", amount: 590 }, { id: "../path", amount: 590 },
    { id: invoice.id, amount: 0 }, { id: invoice.id, amount: -20 },
    { id: invoice.id, amount: 0.0001 }, { id: invoice.id, amount: Infinity },
  ]) {
    assert.equal(isEligibleHybridInvoice({ ...invoice, ...invalid }), false);
  }
});

test("file checks match server and Storage MIME list and 10 MiB upper bound", () => {
  assert.equal(MAX_HYBRID_PROOF_BYTES, 10 * 1024 * 1024);
  assert.deepEqual(HYBRID_PROOF_MIME_TYPES, [
    "image/jpeg", "image/png", "image/webp", "application/pdf",
  ]);
  for (const type of HYBRID_PROOF_MIME_TYPES) {
    assert.equal(validateHybridProofFile(file({ type })).ok, true);
  }
  assert.equal(validateHybridProofFile(file({ size: 1 })).ok, true);
  assert.equal(validateHybridProofFile(file({ size: MAX_HYBRID_PROOF_BYTES })).ok, true);
  for (const size of [0, MAX_HYBRID_PROOF_BYTES + 1, -1, NaN, 1.2]) {
    assert.equal(validateHybridProofFile(file({ size })).ok, false);
  }
  for (const type of ["application/javascript", "text/html", "image/svg+xml", ""]) {
    assert.equal(validateHybridProofFile(file({ type })).ok, false);
  }
  for (const name of ["../transfer.png", "folder/transfer.png", "", "x".repeat(161)]) {
    assert.equal(validateHybridProofFile(file({ name })).ok, false);
  }
});

test("local slip draft binds tenant, invoice and file metadata but no payment instruction", () => {
  const accepted = describeLocalHybridProof({
    tenantId: "demo-shop-a", invoice, file: file(),
  });
  assert.deepEqual(accepted, {
    ok: true, code: "", invoiceId: invoice.id,
    invoiceAmount: 590, fileName: "transfer.png",
    fileSize: 412000, mimeType: "image/png", localOnly: true,
  });
  assert.equal(describeLocalHybridProof({ tenantId: "../forged", invoice, file: file() }).ok, false);
  assert.equal(describeLocalHybridProof({ tenantId: "demo-shop-a",
    invoice: { ...invoice, status: "paid" }, file: file() }).ok, false);
  assert.equal(describeLocalHybridProof({ tenantId: "demo-shop-a",
    invoice, file: file({ type: "text/html" }) }).ok, false);
  for (const forbidden of ["slipPath", "attemptId", "bankAccount",
    "bankReference", "verification", "paid", "actorId"]) {
    assert.equal(Object.hasOwn(accepted, forbidden), false);
  }
});

test("submitting evidence is hard blocked independent of file validity", async () => {
  assert.equal(HYBRID_TENANT_PROOF_SUBMISSION_READY, false);
  await assert.rejects(submitHybridTenantProof(), /HYBRID_PAYMENT_NOT_RELEASED/);
  await assert.rejects(submitHybridTenantProof({
    tenantId: "demo-shop-a", invoice, file: file(),
  }), /HYBRID_PAYMENT_NOT_RELEASED/);
  assert.match(callable, /HYBRID_PAYMENT_CALLABLE_READY = false/);
  assert.match(adapter, /HYBRID_PAYMENT_UI_READY = false/);
  assert.doesNotMatch(model + panel, /httpsCallable\(|uploadBytes\(|updateDoc\(|setDoc\(|addDoc\(|deleteDoc\(|fetch\(/);
});

test("tenant report keeps live invoice history separate from projections and filters payment eligibility", () => {
  assert.match(page, /getHybridBillingPreview\(month\)/);
  assert.match(page, /listHybridInvoices\(tenant\.id\)/);
  assert.match(page, /const chosenInvoice = issuedInvoices\.find/);
  assert.match(page, /isEligibleHybridInvoice\(invoice\)/);
  assert.match(page, /<HybridTenantProofPanel/);
  assert.match(page, /key=\{tenant\.id \+ ":" \+ chosenInvoice\.id \+ ":" \+ chosenInvoice\.status \+ ":" \+ chosenInvoice\.amount\}/);
  assert.match(page, /onClose=\{\(\) => setProofInvoiceId\(""\)\}/);
  assert.match(page, /setProofInvoiceId\(""\)/);
  assert.doesNotMatch(page, /submitHybridTenantProof|uploadBytes|confirmPayment|updateDoc\(/);
});

test("UI is multilingual, preview-only, responsive and never requests an unverified transfer", () => {
  assert.match(panel, /input id="hybridTenantProofFile" type="file"/);
  assert.match(panel, /type="file"/);
  assert.match(panel, /disabled=\{\s*!HYBRID_TENANT_PROOF_SUBMISSION_READY \|\| !validDraft/);
  assert.match(panel, /Do not transfer money based on this screen/);
  assert.match(panel, /It will not be uploaded or stored/);
  assert.match(panel, /not submitted/);
  assert.match(panel, /localError/);
  assert.match(panel, /aria-describedby="hybridTenantProofHelp"/);
  assert.match(css, /hybrid-tenant-proof/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.doesNotMatch(panel + model, /bankAccountNumber|promptPayNumber|bankRecipientId|setItem\(/);
});

// Paginated response reconciliation must preserve tenant isolation and immutability.
test("late invoice pages cannot mix shops or refresh generations", () => {
  const cursor = { snapshot: "page-one" };
  const first = { scope: "shop-a:owner:0",
    items: [{ id: "invoice-a" }], cursor, hasMore: true };
  const next = { items: [{ id: "invoice-b" }], cursor: { snapshot: "page-two" }, hasMore: false };
  assert.equal(mergeHybridTenantInvoicePage(first, "shop-b:owner:0", cursor, next), first);
  assert.equal(mergeHybridTenantInvoicePage(first, "shop-a:owner:1", cursor, next), first);
  assert.equal(mergeHybridTenantInvoicePage(first, first.scope, {}, next), first);
  assert.deepEqual(first.items, [{ id: "invoice-a" }]);
});

test("invoice pagination appends unique ledger IDs only for the matching cursor", () => {
  const cursor = { snapshot: "first" };
  const first = { scope: "shop-a:admin:2", items: [{ id: "invoice-a" }], cursor, hasMore: true };
  const incoming = { items: [
    { id: "invoice-a", amount: 999999 }, { id: "invoice-b", amount: 30 },
    { id: "invoice-b", amount: 40 },
  ], cursor: { snapshot: "second" }, hasMore: false };
  const result = mergeHybridTenantInvoicePage(first, first.scope, cursor, incoming);
  assert.deepEqual(result.items, [{ id: "invoice-a" }, { id: "invoice-b", amount: 30 }]);
  assert.equal(result.hasMore, false);
  assert.equal(first.items.length, 1);
});

test("tenant UI scopes both asynchronous lists and refresh clears the slip selector", () => {
  assert.match(page, /previewDataScope === previewScope/);
  assert.match(page, /token !== previewRequestRef\.current/);
  assert.match(page, /invoicePage\.scope === invoiceScope/);
  assert.match(page, /mergeHybridTenantInvoicePage/);
  assert.match(page, /setProofInvoiceId\(""\)/);
  assert.match(page, /setInvoiceRefreshKey\(value => value \+ 1\)/);
  assert.match(panel, /invoice\?\.status, invoice\?\.amount/);
  assert.match(invoiceAdapter, /\{ \.\.\.doc\.data\(\), id: doc\.id \}/);
});
