"use strict";

// Platform-only Telegram settings. The bot token is encrypted with an AES-GCM
// key stored in Firebase Secret Manager, never sent to the browser or logs.
// Only authenticated active super_admin can read metadata, rotate or test.
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createCipheriv, createDecipheriv, randomBytes } = require("node:crypto");

const encryptionKey = defineSecret("PENGUIN_TELEGRAM_ENCRYPTION_KEY");
const REGION = "asia-southeast1";
const PURPOSE = "superadmin_slip_manual";
const DOC = "telegram_superadmin_slip_manual";
const TOKEN_FORMAT = /^[0-9]{7,20}:[a-zA-Z0-9_-]{30,120}$/;
const CHAT_FORMAT = /^-?[0-9]{5,20}$/;
const ref = () => getFirestore().collection("platformSettings").doc(DOC);

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign-in required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Superadmin only");
  }
  return profile;
}

function encryptionBytes() {
  const raw = String(encryptionKey.value() || "");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length !== 32) {
    throw new HttpsError("failed-precondition", "Telegram encryption key not configured",
      { code: "TELEGRAM_SETTINGS_UNAVAILABLE" });
  }
  return bytes;
}

function encryptToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptToken(encoded) {
  const [version, ivText, tagText, encryptedText] = String(encoded || "").split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    throw new HttpsError("failed-precondition", "Telegram encryption format not available",
      { code: "TELEGRAM_SETTINGS_UNAVAILABLE" });
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionBytes(), Buffer.from(ivText, "base64"));
    decipher.setAuthTag(Buffer.from(tagText, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new HttpsError("failed-precondition", "Telegram token could not be decrypted",
      { code: "TELEGRAM_SETTINGS_UNAVAILABLE" });
  }
}

function visible(doc = {}) {
  const configured = typeof doc.tokenEncrypted === "string" && doc.tokenEncrypted.startsWith("v1:");
  return {
    purpose: PURPOSE,
    enabled: doc.enabled === true && configured && CHAT_FORMAT.test(String(doc.chatId || "")),
    chatId: String(doc.chatId || ""),
    tokenConfigured: configured,
    tokenMasked: configured ? "••••" + String(doc.tokenSuffix || "****") : "",
  };
}

exports.getPlatformTelegramSettings = onCall({ region: REGION, secrets: [encryptionKey] }, async request => {
  await assertSuperAdmin(request.auth);
  const snapshot = await ref().get();
  return { ok: true, storageReady: true, channels: [visible(snapshot.data())] };
});

exports.savePlatformTelegramSettings = onCall({ region: REGION, secrets: [encryptionKey] }, async request => {
  await assertSuperAdmin(request.auth);
  const data = request.data || {};
  if (String(data.purpose || "") !== PURPOSE || typeof data.enabled !== "boolean"
      || typeof data.clearToken !== "boolean") {
    throw new HttpsError("invalid-argument", "Invalid channel settings");
  }
  const chatId = String(data.chatId || "").trim();
  const submittedToken = String(data.botToken || "").trim();
  if ((chatId && !CHAT_FORMAT.test(chatId)) || (submittedToken && !TOKEN_FORMAT.test(submittedToken))
      || (data.clearToken && (submittedToken || data.enabled))) {
    throw new HttpsError("invalid-argument", "Invalid Telegram chat/token");
  }
  const previous = (await ref().get()).data() || {};
  const tokenEncrypted = data.clearToken ? "" : submittedToken
    ? encryptToken(submittedToken) : String(previous.tokenEncrypted || "");
  const tokenSuffix = data.clearToken ? "" : submittedToken
    ? submittedToken.slice(-4) : String(previous.tokenSuffix || "");
  if (data.enabled && (!CHAT_FORMAT.test(chatId) || !tokenEncrypted)) {
    throw new HttpsError("failed-precondition", "Chat ID and Bot Token required",
      { code: "TELEGRAM_CREDENTIALS_REQUIRED" });
  }
  const patch = {
    purpose: PURPOSE,
    enabled: data.enabled === true,
    chatId,
    tokenEncrypted,
    tokenSuffix,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: request.auth.uid,
  };
  await ref().set(patch, { merge: false });
  const confirmation = (await ref().get()).data();
  if (!confirmation || confirmation.tokenEncrypted !== tokenEncrypted || confirmation.chatId !== chatId
      || confirmation.enabled !== patch.enabled) {
    throw new HttpsError("failed-precondition", "Telegram settings acknowledgement uncertain",
      { code: "TELEGRAM_SETTINGS_SAVE_UNCONFIRMED" });
  }
  return { ok: true, item: visible(confirmation) };
});

exports.testPlatformTelegramSettings = onCall(
  { region: REGION, secrets: [encryptionKey], timeoutSeconds: 20 }, async request => {
    await assertSuperAdmin(request.auth);
    if (String(request.data?.purpose || "") !== PURPOSE) {
      throw new HttpsError("invalid-argument", "Unknown Telegram channel");
    }
    const settings = (await ref().get()).data() || {};
    if (settings.enabled !== true || !CHAT_FORMAT.test(String(settings.chatId || ""))
        || !settings.tokenEncrypted) {
      throw new HttpsError("failed-precondition", "Telegram not configured",
        { code: "TELEGRAM_CHANNEL_NOT_READY" });
    }
    const token = decryptToken(settings.tokenEncrypted);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: "PENGUIN: ทดสอบการแจ้งเตือน Superadmin สำเร็จ\nhttps://penguin-food.web.app/admin/tenants",
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(12000),
      });
      // Do not log the HTTP endpoint: it contains the sensitive bot token.
      if (!response.ok) throw Error("DELIVERY_REJECTED");
      const payload = await response.json();
      if (payload.ok !== true) throw Error("DELIVERY_REJECTED");
      return { ok: true, sent: true };
    } catch {
      throw new HttpsError("failed-precondition", "Telegram delivery was not confirmed",
        { code: "TELEGRAM_TEST_SEND_FAILED" });
    }
  }
);

exports._privateForTests = { visible, encryptToken, decryptToken, PURPOSE, DOC };
