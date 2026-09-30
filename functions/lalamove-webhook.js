const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createHmac, timingSafeEqual } = require("crypto");

const REGION = "asia-southeast1";
const PATH = "/api/lalamove/webhook";

function json(res, status, body) {
  res.status(status).set("Cache-Control", "no-store, max-age=0").json(body);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function centralCredentials() {
  const snapshot = await getFirestore().collection("platformPrivateSettings").doc("lalamove").get();
  const data = snapshot.data() || {};
  return {
    apiKey: String(data.apiKey || "").trim(),
    apiSecret: String(data.apiSecret || "").trim(),
  };
}

function validSignature(payload, secret) {
  const timestamp = String(payload?.timestamp || "");
  const signature = String(payload?.signature || "").trim().toLowerCase();
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  if (!timestamp || !signature || !secret) return false;
  const body = JSON.stringify(data);
  const raw = `${timestamp}\r\nPOST\r\n${PATH}\r\n\r\n${body}`;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  return safeEqual(expected, signature);
}

function nowIso() {
  return new Date().toISOString();
}

exports.lalamoveWebhook = onRequest({ region: REGION, timeoutSeconds: 20 }, async (req, res) => {
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    return json(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const raw = req.rawBody ? req.rawBody.toString("utf8") : "";
  if (!raw.trim()) return json(res, 200, { ok: true });

  let payload = req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    try { payload = JSON.parse(raw); } catch { return json(res, 400, { error: "INVALID_JSON" }); }
  }

  const credentials = await centralCredentials();
  const incomingApiKey = String(payload.apiKey || "").trim();
  if (!incomingApiKey || !credentials.apiKey || !safeEqual(incomingApiKey, credentials.apiKey)) {
    return json(res, 401, { error: "LALAMOVE_WEBHOOK_API_KEY_INVALID" });
  }
  if (!credentials.apiSecret) return json(res, 503, { error: "LALAMOVE_CREDENTIALS_REQUIRED" });
  if (!validSignature(payload, credentials.apiSecret)) {
    return json(res, 401, { error: "LALAMOVE_WEBHOOK_SIGNATURE_INVALID" });
  }

  const eventType = String(payload.eventType || "").trim().toUpperCase();
  const eventId = String(payload.eventId || "").trim();
  const timestamp = Number(payload.timestamp || 0);
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const order = data.order && typeof data.order === "object" ? data.order : {};
  const orderId = String(order.orderId || data.orderId || "").trim();
  if (!orderId) return json(res, 200, { ok: true, ignored: true });

  const db = getFirestore();
  let matches;
  try {
    matches = await db.collectionGroup("orders").where("lalamoveOrderId", "==", orderId).limit(2).get();
  } catch (error) {
    console.error("LALAMOVE_WEBHOOK_ORDER_QUERY_FAILED", orderId, error);
    return json(res, 500, { error: "LALAMOVE_WEBHOOK_ORDER_QUERY_FAILED" });
  }
  if (matches.empty) return json(res, 200, { ok: true, ignored: true });

  const orderRef = matches.docs[0].ref;
  const outcome = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) return { ignored: true };
    const current = snapshot.data() || {};
    const lastTimestamp = Number(current.lalamoveWebhookLastTimestamp || 0);
    const lastEventId = String(current.lalamoveWebhookLastEventId || "");
    if ((eventId && eventId === lastEventId) || (timestamp > 0 && timestamp < lastTimestamp)) {
      return { duplicate: true };
    }

    const status = String(order.status || "").trim().toUpperCase();
    const driver = data.driver && typeof data.driver === "object" ? data.driver : {};
    const driverIdPresent = Object.prototype.hasOwnProperty.call(order, "driverId")
      || Object.prototype.hasOwnProperty.call(driver, "driverId");
    const updates = {
      lalamoveWebhookLastEventId: eventId,
      lalamoveWebhookLastEventType: eventType,
      lalamoveWebhookLastTimestamp: timestamp,
      lalamoveOrderLastSyncedAt: nowIso(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (status) updates.lalamoveOrderStatus = status;
    if (driverIdPresent) updates.lalamoveDriverId = String(order.driverId || driver.driverId || "").trim();
    if (Object.prototype.hasOwnProperty.call(driver, "name")) updates.lalamoveDriverName = String(driver.name || "").trim();
    if (Object.prototype.hasOwnProperty.call(driver, "phone")) updates.lalamoveDriverPhone = String(driver.phone || "").trim();
    if (Object.prototype.hasOwnProperty.call(order, "shareLink")) updates.lalamoveShareLink = String(order.shareLink || "");

    if (status === "PICKED_UP" && String(current.status || "").toLowerCase() === "ready") {
      updates.status = "served";
      updates.lalamovePickedUpAt = nowIso();
    }

    if (status === "COMPLETED") {
      updates.lalamoveCompletedAt = nowIso();
      const isCod = String(current.paymentMethod || "").toLowerCase() === "cod"
        && current.lalamoveCodEnabled === true;
      if (isCod) {
        updates.paymentStatus = "paid";
        updates.paidAt = nowIso();
        updates.lalamoveCodCollectedAt = nowIso();
      }
      if (isCod || String(current.paymentStatus || "").toLowerCase() === "paid") {
        updates.status = "paid";
        updates.completedAt = nowIso();
      }
    }

    transaction.set(orderRef, updates, { merge: true });
    return { updated: true };
  });

  if (outcome.duplicate) return json(res, 200, { ok: true, duplicate: true });
  if (outcome.ignored) return json(res, 200, { ok: true, ignored: true });
  return json(res, 200, { ok: true });
});
