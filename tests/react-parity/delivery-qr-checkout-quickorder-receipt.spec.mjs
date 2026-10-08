import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cashierOrderAlertEligible } from "../../react-app/src/components/orderAlertEligibility.js";
import { svgQrPngBlob } from "../../react-app/src/utils/downloadQrPng.js";

const delivery = fs.readFileSync("react-app/src/pages/DeliveryPage.jsx", "utf8");
const cashier = fs.readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
const quick = fs.readFileSync("react-app/src/pages/QuickOrderPage.jsx", "utf8");
const receipt = fs.readFileSync("react-app/src/pages/CashierReceiptPage.jsx", "utf8");

test("Delivery QR download is native link to a prepared PNG, not an SVG renamed .png", () => {
  assert.match(delivery, /svgQrPngBlob\(promptPayQr\.src\)/);
  assert.match(delivery, /URL\.createObjectURL\(blob\)/);
  assert.match(delivery, /URL\.revokeObjectURL\(url\)/);
  assert.match(delivery, /id="downloadPaymentQr" href=\{paymentQrDownloadUrl\} download=/);
  assert.doesNotMatch(delivery, /href=\{promptPayQr\.src\} download=/);
});

test("SVG QR is decoded, rasterized into a white-backed real image/png Blob", async () => {
  const prevImage = globalThis.Image;
  const prevDocument = globalThis.document;
  let drawn = false;
  let imageSmoothing = true;
  const context = {
    fillStyle: "",
    fillRect(x, y, w, h) { assert.deepEqual([x, y, w, h], [0, 0, 640, 640]); },
    drawImage() { drawn = true; },
    set imageSmoothingEnabled(value) { imageSmoothing = value; },
  };
  globalThis.Image = class {
    set src(value) { assert.match(value, /^data:image\/svg\+xml/); queueMicrotask(() => this.onload()); }
  };
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      return {
        width: 0, height: 0,
        getContext(type) { assert.equal(type, "2d"); return context; },
        toBlob(callback, mime) {
          assert.equal(mime, "image/png");
          callback(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: mime }));
        },
      };
    },
  };
  try {
    const blob = await svgQrPngBlob("data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E");
    assert.equal(blob.type, "image/png");
    assert.equal(blob.size, 8);
    assert.ok(drawn);
    assert.equal(imageSmoothing, false);
    await assert.rejects(() => svgQrPngBlob("data:text/plain,not-qr"), /QR_SVG_REQUIRED/);
  } finally {
    globalThis.Image = prevImage;
    globalThis.document = prevDocument;
  }
});

test("Delivery success replaces checkout history and clears locked/cart state only after order commit", () => {
  const save = delivery.indexOf("await createPublicDeliveryOrder(tenant, payload");
  const clear = delivery.indexOf("setCart([]);", save);
  const replace = delivery.indexOf('location.replace("/s/"', clear);
  assert.ok(save > 0 && clear > save && replace > clear);
  assert.match(delivery.slice(save, replace), /setPaymentLocked\(false\)/);
  assert.match(delivery.slice(save, replace), /setLockedTotal\(null\)/);
  assert.doesNotMatch(delivery, /location\.assign\("\/s\/"/);
});

test("Paid cashier-origin Walk-in does not generate a new cashier alert but still reaches Kitchen", () => {
  const alreadyReceived = {
    orderType: "walkin", orderSource: "cashier_walkin",
    paymentStatus: "paid", status: "pending",
  };
  assert.equal(cashierOrderAlertEligible(alreadyReceived, "cashier"), false);
  assert.equal(cashierOrderAlertEligible(alreadyReceived, "kitchen"), true);
  assert.equal(cashierOrderAlertEligible({ ...alreadyReceived, paymentStatus: "unpaid" }, "cashier"), true);
  assert.equal(cashierOrderAlertEligible({ ...alreadyReceived, orderSource: "customer" }, "cashier"), true);
  assert.equal(cashierOrderAlertEligible({ ...alreadyReceived, orderType: "delivery" }, "cashier"), true);
  assert.match(cashier, /setOrdersSynced\(true\)/);
  assert.match(cashier, /ordersSynced \? <CashierOrderNotifier/);
});

test("Quick Order print tab returns after print; normal Cashier receipts remain unchanged", () => {
  assert.match(quick, /&autoprint=1&closeafterprint=quick-order/);
  assert.match(receipt, /params\.get\("closeafterprint"\) !== "quick-order"/);
  assert.match(receipt, /addEventListener\("afterprint", onAfterPrint/);
  assert.match(receipt, /window\.close\(\)/);
  assert.match(receipt, /if \(!window\.closed\) location\.replace\("\/cashier\/quick-order"\)/);
});
