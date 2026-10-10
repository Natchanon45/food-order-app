import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
const css = fs.readFileSync("react-app/public/parity/css/cashier-refresh.css", "utf8");
const dict = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));

test("Cashier eye actions open in-page bill modal across all four order types", () => {
  assert.equal((page.match(/actions\.viewBill\(/g) || []).length, 4);
  assert.match(page, /function CashierBillPreviewModal\(/);
  assert.match(page, /<CashierBillPreviewModal preview=\{billPreview\}/);
  assert.match(page, /aria-modal="true" aria-labelledby="cashierBillPreviewTitle"/);
  assert.match(page, /data-ui-layer="modal"/);
  assert.match(page, /<ItemRows order=\{order\} t=\{t\} money=\{money\} \/>/);
  assert.match(page, /<img src=\{previewSlipUrl\} loading="lazy"/);
  assert.match(page, /window\.requestAnimationFrame\(\(\) => billPreviewTriggerRef.current\?\.focus/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /event\.target === event\.currentTarget/);
});

test("Cashier bill preview retains independent printing and original payment approval gates", () => {
  assert.doesNotMatch(page, /href=\{slipUrl\} target="_blank"/);
  assert.match(page, /const receiptUrl = cashierRoute\(/);
  assert.match(page, /await approveDeliveryPaymentReview\(\{ tenantId: tenant.id, orderId: order.id \}\)/);
  assert.match(page, /await updateOrder\(order.id, patch\)/);
  assert.match(page, /printOrder\(printWindow, order.id\)/);
  assert.match(page, /if \(event\.key === "Escape"\)/);
});

test("Bill modal CSS is layered, scrollable and responsive without modifying cashier cards", () => {
  assert.match(css, /\.cashier-bill-preview-backdrop \{/);
  assert.match(css, /z-index: var\(--ui-layer-modal-z/);
  assert.match(css, /\.cashier-bill-preview-body \{[\s\S]*?overflow-y: auto/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /font-family: var\(--app-ui-font\)/);
});

test("Bill preview title, close, and breakdown are available in all five languages", () => {
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    for (const key of ["view", "title", "order_code", "close", "slip", "subtotal", "delivery_fee"])
      assert.ok(dict[locale].cashier.bill_preview[key], locale + " missing " + key);
  }
});
