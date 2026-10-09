import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  deliveryReceiptPaymentLabel,
  deliveryReceiptZoneLabel,
  deliveryReceiptItemLabel,
} from "../../react-app/src/utils/deliveryReceiptPresentation.js";

const texts = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));
const langs = ["th", "en", "my", "lo", "km"];
const translator = lang => key => key.split(".").reduce((object, part) => object?.[part], texts[lang]) ?? key;

test("pending slip review shows customer requested receipt text without marking order paid", () => {
  const order = Object.freeze({
    paymentStatus: "pending_verification",
    paymentMethod: "promptpay",
    paymentReviewRequired: true,
    slipCheckStatus: "manual_review",
  });
  assert.equal(deliveryReceiptPaymentLabel(order, translator("th")), "ชำระเงินแล้ว รอร้านตรวจสอบ");
  assert.equal(order.paymentStatus, "pending_verification");
  assert.equal(deliveryReceiptPaymentLabel(
    { ...order, paymentReviewRequired: false, slipCheckStatus: "pending" }, translator("th"),
  ), "ชำระเงินแล้ว รอร้านตรวจสอบ");
});

test("paid and cash-on-delivery receipts keep their distinct verified/unpaid status", () => {
  const t=translator("th");
  assert.equal(deliveryReceiptPaymentLabel({ paymentStatus: "paid", paymentMethod: "promptpay" },t),"ชำระเงินแล้ว");
  assert.equal(deliveryReceiptPaymentLabel({ paymentStatus: "unpaid", paymentMethod: "cod" },t),"เก็บเงินปลายทาง");
  assert.equal(deliveryReceiptPaymentLabel({ paymentStatus: "unpaid", paymentMethod: "promptpay" },t),"ยังไม่ชำระเงิน");
});

test("only Lalamove orders replace zone with delivered by Lalamove text", () => {
  const t=translator("th");
  assert.equal(deliveryReceiptZoneLabel({ deliveryProvider: "lalamove", deliveryZoneLabel: "Lalamove · สถานที่ A" },t),"จัดส่งโดย Lalamove");
  assert.equal(deliveryReceiptZoneLabel({ deliveryProvider: "LALAMOVE", deliveryZoneLabel: "Lalamove" },t),"จัดส่งโดย Lalamove");
  assert.equal(deliveryReceiptZoneLabel({ deliveryProvider: "self", deliveryZoneLabel: "พื้นที่ A" },t),"พื้นที่ A");
  assert.equal(deliveryReceiptZoneLabel({ deliveryProvider: "self" },t),"-");
});

test("receipt item name and quantity share exact requested inline format", () => {
  assert.equal(deliveryReceiptItemLabel({name:"ตำข้าวโพดไข่เค็ม",qty:1}),"ตำข้าวโพดไข่เค็ม x 1");
  assert.equal(deliveryReceiptItemLabel({name:"ส้มตำ",qty:3}),"ส้มตำ x 3");
});

test("receipt labels exist in five locales and receipt UI renders helpers", () => {
  const jsx=fs.readFileSync("react-app/src/pages/DeliverySuccessPage.jsx","utf8");
  for(const lang of langs){
    const t=translator(lang);
    assert.notEqual(t("delivery.success.payment.pending_verification"),"delivery.success.payment.pending_verification");
    assert.notEqual(t("delivery.success.receipt.lalamove_delivery"),"delivery.success.receipt.lalamove_delivery");
  }
  assert.match(jsx,/deliveryReceiptPaymentLabel\(order, t\)/);
  assert.match(jsx,/deliveryReceiptZoneLabel\(order, t\)/);
  assert.match(jsx,/deliveryReceiptItemLabel\(item\)/);
  assert.match(jsx,/id="receiptPayment"/);
  assert.match(jsx,/id="receiptDeliveryZone"/);
  assert.match(jsx,/id="receiptItems"/);
});
