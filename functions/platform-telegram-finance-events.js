"use strict";
// Port of committed Slip/Wallet/Revenue Share notice semantics from LUKKAJA.
// Firestore records are the source of truth; Telegram is an audit/navigation
// hint, NEVER settlement evidence. No bank details, images or credentials.
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createHash } = require("node:crypto");
const { _privateForTests: telegramSecrets } = require("./platform-telegram");
const { walletTopupManualReviewAllowed, revenueShareManualReviewAllowed } =
  require("./finance-manual-review-policy");

const secret = defineSecret("PENGUIN_TELEGRAM_ENCRYPTION_KEY");
const REGION = "asia-southeast1";
const CHANNEL_DOC = "telegram_superadmin_slip_manual";
const OUTBOX = "platformTelegramFinanceEvents";
const MAX_AMOUNT_BAHT = 1000000;
const ID = /^[a-zA-Z0-9_-]{8,128}$/;
const TENANT = /^[a-zA-Z0-9_-]{1,128}$/;
const labels = Object.freeze({
  wallet_topup: "เติมเครดิต Lalamove",
  delivery_share: "ส่วนแบ่ง Delivery",
  verified: "Slip2Go ตรวจผ่าน และบันทึกรายการชำระแล้ว",
  provider_rejected: "ผลตรวจไม่ผ่านเงื่อนไข ห้ามอนุมัติด้วยคนแทน",
  manual_review: "Slip2Go ขัดข้องทางเทคนิค อาจตรวจด้วยคนได้ตามสิทธิ์",
  pending_unverified: "รับหลักฐานแล้ว ยังไม่ยืนยันการชำระ ห้ามอนุมัติหากไม่เข้าเงื่อนไข",
  admin_approved: "Super Admin อนุมัติหลักฐานแล้ว",
  admin_rejected: "Super Admin ปฏิเสธหลักฐานแล้ว",
});
const resultText = Object.freeze({
  verified: labels.verified,
  provider_rejected: labels.provider_rejected,
  manual_review: labels.manual_review,
  pending_unverified: labels.pending_unverified,
  admin_approved: labels.admin_approved,
  admin_rejected: labels.admin_rejected,
});
function outcomeForNewRecord(channel, row) {
  const isWallet = channel === "wallet_topup";
  const provider = String(isWallet ? row.verificationProvider || "" :
    row.slipVerificationProvider || "");
  const verification = String(isWallet ? row.verificationStatus || "" :
    row.slipVerificationStatus || "");
  const trustedApproval = row.status === "approved"
    && row.reviewedBy === "system:slip2go"
    && provider === "slip2go" && verification === "matched"
    && row.ocr?.amountMatched === true;
  if (trustedApproval) return "verified";
  const canManual = isWallet ? walletTopupManualReviewAllowed(row) :
    revenueShareManualReviewAllowed(row);
  if (canManual) return "manual_review";
  if (provider === "slip2go"
    && ["mismatch", "receiver_mismatch", "duplicate", "invalid"].includes(verification))
    return "provider_rejected";
  return "pending_unverified";
}
function outcomeForReview(before, after) {
  if (before?.status !== "pending" || before.status === after?.status) return "";
  if (!after.reviewedBy || after.reviewedBy === "system:slip2go") return "";
  if (after.status === "approved") return "admin_approved";
  if (after.status === "rejected") return "admin_rejected";
  return "";
}
function eventMessage({ channel, tenantId, receiptId, outcome, amount }) {
  if (!["wallet_topup", "delivery_share"].includes(channel)
    || !TENANT.test(tenantId) || !ID.test(receiptId)
    || !resultText[outcome] || typeof amount !== "number"
    || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT_BAHT)
    return null;
  const satang = Math.round(amount * 100);
  if (!Number.isSafeInteger(satang)) return null;
  const key = createHash("sha256")
    .update([channel, tenantId, receiptId, outcome].join(":")).digest("hex");
  const amountLabel = new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(satang / 100);
  const text = [
    "PENGUIN | แจ้งผลสลิป: " + labels[channel],
    "ร้าน: " + tenantId,
    "ยอดหลักฐาน: " + amountLabel + " บาท",
    "สถานะ: " + resultText[outcome],
    "เลขอ้างอิง: " + receiptId,
    "เปิดรายการใน Super Admin: https://penguin-food.web.app/admin/tenants?reviewTenantId="
      + encodeURIComponent(tenantId),
  ].join("\n");
  return { id: key, channel, tenantId, receiptId, outcome,
    amountSatang: satang, text };
}
function classifyChange(channel, params, before, after) {
  if (!after || !TENANT.test(String(params.tenantId || ""))
    || !ID.test(String(params.receiptId || ""))) return null;
  if (before && before.status === after.status) return null;
  if (before && before.status !== "pending") return null;
  const outcome = before ? outcomeForReview(before, after)
    : outcomeForNewRecord(channel, after);
  if (!outcome) return null;
  const amount = Number(channel === "wallet_topup" ? after.amount :
    after.platformAmountDue);
  return eventMessage({ channel, tenantId: params.tenantId,
    receiptId: params.receiptId, outcome, amount });
}
async function enqueue(event) {
  if (!event) return { queued: false, reason: "INVALID_EVENT" };
  const db = getFirestore();
  const settings = (await db.collection("platformSettings").doc(CHANNEL_DOC).get()).data();
  if (settings?.enabled !== true || !String(settings.tokenEncrypted || "").startsWith("v1:")
    || !/^-?[0-9]{5,20}$/.test(String(settings.chatId || "")))
    return { queued: false, reason: "CHANNEL_DISABLED" };
  const outbox = db.collection(OUTBOX).doc(event.id);
  try {
    await outbox.create({
      ...event, purpose: "superadmin_slip_manual",
      status: "pending", createdAt: FieldValue.serverTimestamp(),
    });
    return { queued: true, eventId: event.id };
  } catch (error) {
    if (Number(error?.code) === 6 || error?.code === "already-exists")
      return { queued: false, reason: "DUPLICATE" };
    throw error;
  }
}
function snapshotRows(event) {
  return {
    before: event.data?.before?.exists ? event.data.before.data() : null,
    after: event.data?.after?.exists ? event.data.after.data() : null,
  };
}
async function processReceipt(channel, event, kind) {
  const { before, after } = snapshotRows(event);
  const item = classifyChange(channel, {
    tenantId: String(event.params?.tenantId || ""),
    receiptId: String(event.params?.[kind] || ""),
  }, before, after);
  if (item) await enqueue(item);
}
exports.notifyPlatformWalletTopupOutcome = onDocumentWritten({
  document: "tenants/{tenantId}/lalamoveWalletTopups/{topupId}",
  region: REGION,
}, async event => processReceipt("wallet_topup", event, "topupId"));
exports.notifyPlatformRevenueShareOutcome = onDocumentWritten({
  document: "tenants/{tenantId}/revenueSharePayments/{paymentId}",
  region: REGION,
}, async event => processReceipt("delivery_share", event, "paymentId"));

async function deliver(outboxId) {
  if (!/^[a-f0-9]{64}$/.test(String(outboxId || ""))) return;
  const db = getFirestore();
  const ref = db.collection(OUTBOX).doc(outboxId);
  const claimed = await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (!snapshot.exists || data.status !== "pending") return null;
    // At-most-once automatic attempt: if HTTP result is ambiguous, we retain
    // "unconfirmed" for explicit review instead of retrying and spamming.
    tx.update(ref, { status: "dispatching", attemptedAt: FieldValue.serverTimestamp() });
    return data;
  });
  if (!claimed) return;
  try {
    const settings = (await db.collection("platformSettings").doc(CHANNEL_DOC).get()).data();
    if (settings?.enabled !== true || !String(settings.tokenEncrypted || "").startsWith("v1:"))
      throw new Error("CHANNEL_NOT_CONFIGURED");
    if (!/^-?[0-9]{5,20}$/.test(String(settings.chatId || "")))
      throw new Error("CHANNEL_NOT_CONFIGURED");
    const token = telegramSecrets.decryptToken(settings.tokenEncrypted);
    const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: settings.chatId, text: claimed.text,
        disable_web_page_preview: true }),
      signal: AbortSignal.timeout(12000),
    });
    // Never log the request URL: it contains the Bot Token.
    if (!response.ok) throw new Error("DELIVERY_UNCONFIRMED");
    const body = await response.json().catch(() => null);
    if (body?.ok !== true) throw new Error("DELIVERY_UNCONFIRMED");
    await ref.update({ status: "sent", sentAt: FieldValue.serverTimestamp() });
  } catch {
    await ref.update({ status: "unconfirmed", unconfirmedAt: FieldValue.serverTimestamp() });
  }
}
exports.deliverPlatformTelegramFinanceEvent = onDocumentCreated({
  document: OUTBOX + "/{eventId}",
  region: REGION, secrets: [secret], timeoutSeconds: 25,
}, async event => deliver(event.params.eventId));

exports._privateForTests = { classifyChange, outcomeForNewRecord,
  outcomeForReview, eventMessage, enqueue, deliver, OUTBOX };
