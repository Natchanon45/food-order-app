"use strict";
const { createHmac, timingSafeEqual } = require("node:crypto");
const TEST_KEY = /^sk_test_[A-Za-z0-9_]{8,240}$/;
const HOOK_KEY = /^whsec_[A-Za-z0-9_]{8,240}$/;
const ACCOUNT = /^acct_[A-Za-z0-9]{12,80}$/;
const SESSION = /^cs_test_[A-Za-z0-9_]{8,240}$/;
const INTENT = /^pi_[A-Za-z0-9_]{8,240}$/;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
function configurationReady(key, hook, account) {
  return TEST_KEY.test(key || "") && HOOK_KEY.test(hook || "") && ACCOUNT.test(account || "");
}
function accountVerified(account, expected) {
  return ACCOUNT.test(expected || "") && account?.id === expected &&
    account.country === "TH" && account.charges_enabled === true && account.livemode === false;
}
function promptPayEnabled(configs) {
  return Array.isArray(configs?.data) && configs.data.some(row =>
    row.active === true && row.promptpay?.available === true && row.promptpay?.display_preference?.value === "on");
}
function safeCheckoutURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "checkout.stripe.com" &&
        !url.username && !url.password && !url.port && /^\/(c|g)\/pay\//.test(url.pathname)) return url.href;
  } catch {}
  return "";
}
// Verify RAW HTTP bytes; never trust parsed body or any browser status.
function verifyWebhook(raw, signature, secret, nowSeconds = Math.floor(Date.now()/1000)) {
  if (!Buffer.isBuffer(raw) || raw.length > 256*1024 || !HOOK_KEY.test(secret || "") ||
      typeof signature !== "string" || signature.length > 4096) return false;
  const parts = signature.split(",").map(value => value.trim());
  const stamps = parts.filter(value => value.startsWith("t="));
  if (stamps.length !== 1 || !/^t=\d{1,12}$/.test(stamps[0])) return false;
  const stamp = Number(stamps[0].slice(2));
  if (!Number.isSafeInteger(stamp) || Math.abs(nowSeconds-stamp)>300) return false;
  const expected = createHmac("sha256",secret).update(String(stamp)+".").update(raw).digest();
  return parts.some(value => /^v1=[a-f0-9]{64}$/.test(value) &&
    timingSafeEqual(expected,Buffer.from(value.slice(3),"hex")));
}
// Settlement proof must be an independently retrieved TEST session and intent.
// This deliberately cannot credit a production wallet or authorize delivery.
function verifiedSandboxPayment({attempt,session,intent,expectedAccount}) {
  if (!attempt || !UUID.test(attempt.referenceId || "") || typeof attempt.tenantId !== "string" ||
      !attempt.tenantId || attempt.mode !== "test" || !ACCOUNT.test(expectedAccount || "") ||
      attempt.accountId !== expectedAccount || !SESSION.test(attempt.sessionId || "") ||
      !Number.isSafeInteger(attempt.amountSatang) || attempt.amountSatang < 1000 || attempt.amountSatang > 99999999) return false;
  const bound = metadata => metadata?.referenceId === attempt.referenceId &&
    metadata?.tenantId === attempt.tenantId && metadata?.purpose === "penguin_lalamove_wallet_sandbox";
  return session?.id === attempt.sessionId && session.livemode === false && session.mode === "payment" &&
    session.status === "complete" && session.payment_status === "paid" && session.currency === "thb" &&
    session.amount_total === attempt.amountSatang && bound(session.metadata) &&
    Array.isArray(session.payment_method_types) && session.payment_method_types.length === 1 &&
    session.payment_method_types[0] === "promptpay" && INTENT.test(intent?.id || "") &&
    session.payment_intent === intent.id && intent.livemode === false && intent.status === "succeeded" &&
    intent.currency === "thb" && intent.amount === attempt.amountSatang &&
    intent.amount_received === attempt.amountSatang && bound(intent.metadata) &&
    Array.isArray(intent.payment_method_types) && intent.payment_method_types.length === 1 &&
    intent.payment_method_types[0] === "promptpay";
}
module.exports={configurationReady,accountVerified,promptPayEnabled,safeCheckoutURL,verifyWebhook,verifiedSandboxPayment};
