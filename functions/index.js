const { onCall } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

// เตรียมไว้สำหรับ Version ถัดไป:
// - ตรวจสอบ QR token ของโต๊ะ
// - สร้างออเดอร์ผ่าน Cloud Function
// - กำหนดสิทธิ์ Admin / Kitchen / Cashier

exports.healthCheck = onCall(() => ({
  ok: true,
  service: "food-order-functions"
}));
