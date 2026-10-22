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
    for (const key of ["view", "title", "order_code", "close", "slip", "subtotal", "delivery_fee", "net_total"])
      assert.ok(dict[locale].cashier.bill_preview[key], locale + " missing " + key);
  }
});

test("Delivery, takeaway and walk-in preview use net total; table bills retain table total", () => {
  assert.match(page, /first\\.orderType === "delivery" \\|\\| first\\.orderType === "takeaway" \\|\\| isWalkIn\\(first\\) \\? t\\("cashier\\.bill_preview\\.net_total"\\) : t\\("cashier\\.table\\.total"\\)/);
  assert.equal(dict.th.cashier.bill_preview.net_total, "ยอดรวมสุทธิ");
  assert.ok(dict.th.cashier.table.total.includes("โต๊ะ"));
});


test("Cashier Delivery card shows Kitchen matching food and delivery fee breakdown", () => {
  const start = page.indexOf("function DeliveryCard(");
  const end = page.indexOf("function TakeawayCard(");
  assert.ok(start >= 0 && end > start);
  const delivery = page.slice(start, end);
  assert.match(delivery, /className="card cashier-delivery-fee-summary"/);
  assert.match(delivery, /t\("kitchen\.order\.delivery_zone"\)/);
  assert.match(delivery, /order\.deliveryZoneLabel \|\| "-"/);
  assert.match(delivery, /t\("cashier\.bill_preview\.subtotal"\)/);
  assert.match(delivery, /order\.subtotalAmount \?\? \(Number\(order\.totalAmount \|\| 0\) - Number\(order\.deliveryFee \|\| 0\)\)/);
  assert.match(delivery, /t\("cashier\.bill_preview\.delivery_fee"\)/);
  assert.match(delivery, /money\(order\.deliveryFee \|\| 0\)/);
  assert.match(delivery, /money\(order\.totalAmount\)/);
  assert.ok(delivery.indexOf("cashier-delivery-fee-summary") < delivery.indexOf('t("cashier.delivery.net_total")'));
  assert.ok(delivery.indexOf('t("cashier.delivery.net_total")') < delivery.indexOf("<LalamoveDispatch"));
  // A paid 354 THB Delivery order must remain 295 food + 59 delivery = 354 total.
  const order = { subtotalAmount: 295, deliveryFee: 59, totalAmount: 354 };
  const food = order.subtotalAmount ?? (order.totalAmount - order.deliveryFee);
  assert.equal(food, 295);
  assert.equal(food + order.deliveryFee, order.totalAmount);
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    assert.ok(dict[locale].kitchen.order.delivery_zone, locale);
    assert.ok(dict[locale].cashier.bill_preview.subtotal, locale);
    assert.ok(dict[locale].cashier.bill_preview.delivery_fee, locale);
  }
});
