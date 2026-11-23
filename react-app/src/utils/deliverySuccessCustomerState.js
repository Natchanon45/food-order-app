// Presentation policy only. Firebase's server-written order and QR capability
// remain the sole authority for payment / kitchen release. This module never
// interprets a Stripe redirect, localStorage or a Sandbox badge as Paid.
const ACCEPTED = new Set(["accepted", "cooking", "ready", "served", "paid"]);
const STRIPE_METHODS = new Set(["stripe_connect", "stripe"]);
const PROMPTPAY_METHODS = new Set(["promptpay", "bank_transfer", "transfer"]);
const FAILED_PAYMENT = new Set(["failed", "cancelled", "canceled", "expired", "rejected"]);
const BILL = /^[A-Za-z0-9_-]{1,50}$/;

export function deliverySuccessCustomerState(order, { sandboxBadge = false } = {}) {
  const method = String(order?.paymentMethod || "").toLowerCase();
  const paymentStatus = String(order?.paymentStatus || "").toLowerCase();
  const orderStatus = String(order?.status || "pending").toLowerCase();
  const stripe = STRIPE_METHODS.has(method);
  const promptpay = PROMPTPAY_METHODS.has(method);
  const verifiedPaid = paymentStatus === "paid";
  const cancelled = orderStatus === "cancelled" || orderStatus === "canceled";
  const admittedUnverified =
    order?.companionKitchenRelease?.status === "admitted_unverified";
  const paymentPending = paymentStatus === "pending_verification";
  const confirmedQrPending = order?.paymentQrMode === "confirmed_order_5m" &&
    paymentPending && !admittedUnverified;
  const failedStripe = stripe && FAILED_PAYMENT.has(paymentStatus);
  const pendingStripe = stripe && !verifiedPaid && !failedStripe;
  // A persisted order can be accepted without money (COD or supervised
  // kitchen admission). That is NOT a payment-success claim.
  const orderReceived = !cancelled && !confirmedQrPending &&
    !pendingStripe && !failedStripe &&
    (ACCEPTED.has(orderStatus) || verifiedPaid || admittedUnverified);
  const payment = stripe ? "stripe" :
    promptpay ? "promptpay" : method === "cod" ? "cod" : "other";
  let badge = "";
  if (payment === "stripe") badge = verifiedPaid ? "ชำระผ่าน Stripe" : "Stripe";
  else if (payment === "promptpay") badge =
    verifiedPaid ? "ชำระผ่าน PromptPay QR" : "PromptPay QR · รอตรวจสอบยอด";
  else if (payment === "cod") badge = verifiedPaid ?
    "เก็บเงินปลายทาง · ชำระแล้ว" : "เก็บเงินปลายทาง · ยังไม่ชำระ";
  else badge = verifiedPaid ? "บันทึกชำระเงินแล้ว" : "รอตรวจสอบสถานะชำระเงิน";
  // "shop received" is a source-like success card, not a receipt for bank cash.
  const title = orderReceived ? "รับคำสั่งซื้อสำเร็จ" : "";
  const note = verifiedPaid ? "ร้านค้าได้รับคำสั่งซื้อของคุณแล้ว" :
    "ร้านค้าได้รับคำสั่งซื้อแล้ว การชำระเงินยังไม่ยืนยัน";
  const rawBill = String(order?.billNo || order?.billNumber || "");
  const billNo = BILL.test(rawBill) ? rawBill :
    String(order?.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12).toUpperCase();
  return {
    orderReceived,
    title, note, billNo,
    payment, badge,
    verifiedPaid, // Only a reflected server state; not independent bank proof.
    showSandboxBadge: Boolean(sandboxBadge && stripe),
    stripePending: !cancelled && pendingStripe,
    stripeFailed: failedStripe,
    hideToolbar: confirmedQrPending || pendingStripe || failedStripe,
    hideReceipt: confirmedQrPending || pendingStripe || failedStripe,
    paymentNeedsReview: paymentPending,
    canResumeStripe: false, // No Firebase operational Stripe Connect resumption.
    bankStatementIndependentlyVerified: false,
  };
}
