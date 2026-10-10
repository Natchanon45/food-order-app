import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { openReceiptPrintLoading, updateReceiptPrintLoading } from "../../react-app/src/utils/receiptPrintWindow.js";

function mockPopup() {
  const elements = {
    receiptPrintLoadingTitle: { textContent: "" },
    receiptPrintLoadingMessage: { textContent: "" },
  };
  const doc = {
    html: "",
    calls: [],
    documentElement: { lang: "th" },
    open() { this.calls.push("open"); },
    write(html) { this.calls.push("write"); this.html = html; },
    close() { this.calls.push("close"); },
    getElementById(id) { return elements[id] || null; },
  };
  const tab = { document: doc, opener: {}, closed: false, close() { this.closed = true; } };
  const host = { calls: [], open(url, target) { this.calls.push([url, target]); return tab; } };
  return { elements, doc, tab, host };
}

test("Receipt tab is opened synchronously with a real centered loading document before payment finishes", () => {
  const { host, tab, doc, elements } = mockPopup();
  const result = openReceiptPrintLoading({
    title: "กำลังยืนยันการชำระเงิน",
    message: "กรุณารอสักครู่",
    language: "th",
  }, host);
  assert.equal(result, tab);
  assert.deepEqual(host.calls, [["", "_blank"]]);
  assert.equal(tab.opener, null);
  assert.deepEqual(doc.calls, ["open", "write", "close"]);
  assert.match(doc.html, /receipt-print-loading-spinner/);
  assert.match(doc.html, /place-items: center/);
  assert.match(doc.html, /role="status"/);
  assert.match(doc.html, /aria-busy="true"/);
  assert.equal(elements.receiptPrintLoadingTitle.textContent, "กำลังยืนยันการชำระเงิน");
  assert.equal(elements.receiptPrintLoadingMessage.textContent, "กรุณารอสักครู่");
});

test("Receipt loading transitions from checking to preparing without re-opening a window", () => {
  const { host, tab, doc, elements } = mockPopup();
  openReceiptPrintLoading({ title: "Checking", message: "Please wait" }, host);
  updateReceiptPrintLoading(tab, { title: "Preparing receipt", message: "Opening print screen", language: "en" });
  assert.deepEqual(host.calls, [["", "_blank"]]);
  assert.deepEqual(doc.calls, ["open", "write", "close"]);
  assert.equal(doc.documentElement.lang, "en");
  assert.equal(elements.receiptPrintLoadingTitle.textContent, "Preparing receipt");
  assert.equal(elements.receiptPrintLoadingMessage.textContent, "Opening print screen");
});

test("Popup labels are set via textContent, never interpolated into the document HTML", () => {
  const { host, doc, elements } = mockPopup();
  const untrusted = '<img src=x onerror=alert(1)>';
  openReceiptPrintLoading({ title: untrusted, message: untrusted }, host);
  assert.equal(elements.receiptPrintLoadingTitle.textContent, untrusted);
  assert.ok(!doc.html.includes(untrusted));
});

test("Popup blocked or failing to initialize returns a safe same-tab fallback", () => {
  assert.equal(openReceiptPrintLoading({}, { open: () => null }), null);
  const { host, tab, doc } = mockPopup();
  doc.write = () => { throw new Error("WRITE_FAILED"); };
  const originalError = console.error;
  let logged = false;
  console.error = () => { logged = true; };
  try { assert.equal(openReceiptPrintLoading({}, host), null); }
  finally { console.error = originalError; }
  assert.equal(tab.closed, true);
  assert.equal(logged, true);
});

test("Cashier preserves successful Firebase payment gate, print navigation and error cleanup", () => {
  const src = fs.readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
  assert.match(src, /const printWindow = openReceiptPrintWindow\(\);\s+setBusyKey\(`pay:/);
  assert.match(src, /await approveDeliveryPaymentReview\(\{ tenantId: tenant.id, orderId: order.id \}\);[\s\S]*?printOrder\(printWindow, order.id\);/);
  assert.match(src, /const printOrder = \(printWindow, orderId\) => \{[\s\S]*?updateReceiptPrintLoading\(printWindow,[\s\S]*?location.replace\(url\)/);
  assert.match(src, /const printTable = \(printWindow, rounds\) => \{[\s\S]*?updateReceiptPrintLoading\(printWindow,/);
  assert.match(src, /catch \(error\) \{\s+closePrintWindow\(printWindow\);\s+console.error\("CASHIER_PAYMENT_FAILED"/);
  assert.match(src, /else location.assign\(url\)/);
});

test("All supported locales provide separate payment and receipt loading explanations", () => {
  const dict = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    for (const key of ["payment_review", "payment_review_help", "receipt_preparing", "receipt_preparing_help"]) {
      assert.ok(dict[locale].cashier.loading[key], locale + "." + key);
    }
  }
});

test("Cashier loading popup uses local Kanit system font and no PG PENGUIN mark", () => {
  const { host, doc } = mockPopup();
  openReceiptPrintLoading({}, host);
  assert.match(doc.html, /font-family: "Kanit Local"/);
  assert.match(doc.html, /\/assets\/fonts\/Kanit-Regular\.ttf/);
  assert.doesNotMatch(doc.html, /receipt-print-loading-brand|receipt-print-loading-mark/);
  const locales = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));
  assert.equal(locales.th.cashier.loading.receipt_preparing_help, "ระบบกำลังเปิดหน้าพิมพ์ใบเสร็จ กรุณารอสักครู่...");
});
