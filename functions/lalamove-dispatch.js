const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createHmac, randomUUID } = require("crypto");
const {
  lalamoveCompletionPatch,
  lalamoveCompletionNeedsRepair,
} = require("./lalamove-order-lifecycle");

const REGION = "asia-southeast1";
const FINISHED = new Set(["COMPLETED", "CANCELED", "CANCELLED", "REJECTED", "EXPIRED"]);
const RETRYABLE = new Set(["CANCELED", "CANCELLED", "REJECTED", "EXPIRED"]);

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
function dateIso(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
function coordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}
function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return "+" + digits;
  if (digits.startsWith("66")) return "+" + digits;
  if (digits.startsWith("0")) return "+66" + digits.slice(1);
  return digits.length >= 9 ? "+66" + digits : "";
}
function prefixesValid(environment, apiKey, apiSecret) {
  const env = environment === "production" ? "production" : "sandbox";
  return Boolean(apiKey && apiSecret
    && String(apiKey).startsWith(env === "production" ? "pk_prod" : "pk_test")
    && String(apiSecret).startsWith(env === "production" ? "sk_prod" : "sk_test"));
}

async function profileFor(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  const snapshot = await getFirestore().collection("users").doc(auth.uid).get();
  const profile = snapshot.data();
  if (!profile || profile.active === false || !profile.tenantId) {
    throw new HttpsError("permission-denied", "ACTIVE_TENANT_USER_REQUIRED");
  }
  if (!["owner", "admin", "cashier"].includes(String(profile.role || ""))) {
    throw new HttpsError("permission-denied", "CASHIER_PERMISSION_REQUIRED");
  }
  return { ...profile, uid: auth.uid, tenantId: String(profile.tenantId) };
}

async function providerRequest(credentials, method, path, body = null) {
  const environment = credentials.environment === "production" ? "production" : "sandbox";
  const apiKey = String(credentials.apiKey || "");
  const apiSecret = String(credentials.apiSecret || "");
  if (!apiKey || !apiSecret) {
    return { ok: false, status: 0, message: "LALAMOVE_CREDENTIALS_REQUIRED", requestId: randomUUID(), json: {} };
  }
  const host = environment === "production" ? "https://rest.lalamove.com" : "https://rest.sandbox.lalamove.com";
  const bodyText = body === null ? "" : JSON.stringify(body);
  const timestamp = String(Date.now());
  const raw = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${bodyText}`;
  const signature = createHmac("sha256", apiSecret).update(raw).digest("hex");
  const requestId = randomUUID();
  try {
    const response = await fetch(host + path, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `hmac ${apiKey}:${timestamp}:${signature}`,
        Market: "TH",
        "Request-ID": requestId,
        ...(body !== null ? { "Content-Type": "application/json" } : {}),
      },
      body: body === null ? undefined : bodyText,
      signal: AbortSignal.timeout(12000),
    });
    const json = await response.json().catch(() => ({}));
    const first = Array.isArray(json?.errors) ? json.errors[0] || {} : {};
    const message = String(json?.message || [first.id, first.message, first.detail].filter(Boolean).join(" "));
    return {
      ok: response.ok,
      status: response.status,
      message,
      requestId: String(json?.meta?.requestId || requestId),
      json,
    };
  } catch (error) {
    console.warn("LALAMOVE_DISPATCH_PROVIDER_FAILED", path, requestId, error?.message || error);
    return { ok: false, status: 0, message: "LALAMOVE_CONNECTION_FAILED", requestId, json: {} };
  }
}

function providerError(code, result, details = {}) {
  const status = Number(result?.status || 0);
  const functionCode = status === 429 ? "resource-exhausted"
    : status >= 400 && status < 500 ? "failed-precondition" : "unavailable";
  return new HttpsError(functionCode, code, {
    providerError: String(result?.message || ""),
    requestId: String(result?.requestId || ""),
    providerStatus: status,
    ...details,
  });
}

function quotationFromResponse(result) {
  if (!result?.ok) throw providerError("LALAMOVE_DISPATCH_QUOTE_FAILED", result);
  const data = result.json?.data || {};
  const price = data.priceBreakdown || {};
  const distance = data.distance || {};
  const fee = Number(price.total);
  const quotationId = String(data.quotationId || "").trim();
  if (!quotationId || !Number.isFinite(fee)) {
    throw new HttpsError("unavailable", "LALAMOVE_PRICE_MISSING");
  }
  const meters = Number(distance.value || 0);
  return {
    quotationId,
    expiresAt: String(data.expiresAt || ""),
    serviceType: String(data.serviceType || "MOTORCYCLE"),
    specialRequests: Array.isArray(data.specialRequests) ? data.specialRequests.map(String) : [],
    priceBreakdown: price,
    fee,
    currency: String(price.currency || "THB"),
    distanceMeters: Number.isFinite(meters) ? Math.round(meters) : 0,
    distanceKm: Number.isFinite(meters) && meters > 0 ? Math.round(meters / 10) / 100 : null,
    stops: Array.isArray(data.stops) ? data.stops : [],
  };
}

function orderFromResponse(result) {
  if (!result?.ok) throw providerError("LALAMOVE_ORDER_REQUEST_FAILED", result);
  const data = result.json?.data || {};
  const orderId = String(data.orderId || "").trim();
  if (!orderId) throw new HttpsError("unavailable", "LALAMOVE_ORDER_ID_MISSING");
  const price = data.priceBreakdown || {};
  return {
    orderId,
    quotationId: String(data.quotationId || ""),
    fee: Number.isFinite(Number(price.total)) ? Number(price.total) : null,
    currency: String(price.currency || "THB"),
    driverId: String(data.driverId || ""),
    shareLink: String(data.shareLink || data.sharelink || ""),
    status: String(data.status || ""),
    stops: Array.isArray(data.stops) ? data.stops : [],
    metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : {},
  };
}

async function accountFor(tenantRef, forcedMode = "") {
  const db = getFirestore();
  const [publicSnap, privateSnap, platformSnap] = await Promise.all([
    tenantRef.collection("settings").doc("lalamove").get(),
    tenantRef.collection("privateSettings").doc("lalamove").get(),
    db.collection("platformPrivateSettings").doc("lalamove").get(),
  ]);
  const pub = publicSnap.data() || {};
  const priv = privateSnap.data() || {};
  const platform = platformSnap.data() || {};
  let mode = String(forcedMode || pub.accountMode || "disabled").toLowerCase();
  if (mode === "tenant") mode = "partner";
  if (!["partner", "fod_central"].includes(mode)) {
    return { ready: false, mode: "disabled", credentials: {} };
  }

  if (mode === "partner") {
    const environment = priv.environment === "production" ? "production" : "sandbox";
    const apiKey = String(priv.apiKey || "");
    const apiSecret = String(priv.apiSecret || "");
    const verified = Boolean(priv.connectionVerifiedAt || pub.tenantConnectionVerifiedAt);
    return {
      ready: verified && prefixesValid(environment, apiKey, apiSecret),
      mode: "tenant",
      credentials: { environment, apiKey, apiSecret },
    };
  }

  const environment = platform.environment === "production" ? "production" : "sandbox";
  const apiKey = String(platform.apiKey || "");
  const apiSecret = String(platform.apiSecret || "");
  const approved = pub.fodCentralApproved === true;
  const verified = Boolean(platform.connectionVerifiedAt);
  return {
    ready: approved && verified && prefixesValid(environment, apiKey, apiSecret),
    mode: "fod_central",
    credentials: { environment, apiKey, apiSecret },
  };
}

async function loadContext(request, { requireReady = true } = {}) {
  const profile = await profileFor(request.auth);
  const orderId = String(request.data?.orderId || "").trim();
  if (!orderId) throw new HttpsError("invalid-argument", "ORDER_ID_REQUIRED");
  const tenantRef = getFirestore().collection("tenants").doc(profile.tenantId);
  const [orderSnap, storeSnap] = await Promise.all([
    tenantRef.collection("orders").doc(orderId).get(),
    tenantRef.collection("settings").doc("store").get(),
  ]);
  if (!orderSnap.exists) throw new HttpsError("not-found", "ORDER_NOT_FOUND");
  const order = { id: orderSnap.id, ...orderSnap.data() };
  if (String(order.orderType || "") !== "delivery"
    || String(order.deliveryProvider || "").toLowerCase() !== "lalamove") {
    throw new HttpsError("failed-precondition", "ORDER_NOT_LALAMOVE");
  }
  const account = await accountFor(tenantRef, String(order.lalamoveAccountMode || ""));
  if (requireReady && !account.ready) {
    await appendFailure(tenantRef, order, "account", "LALAMOVE_ACCOUNT_NOT_READY");
    throw new HttpsError("failed-precondition", "LALAMOVE_ACCOUNT_NOT_READY");
  }
  return {
    profile,
    tenantRef,
    orderRef: orderSnap.ref,
    order,
    settings: storeSnap.exists ? storeSnap.data() : {},
    account,
  };
}

function readyToDispatch(order) {
  const status = String(order.status || "").toLowerCase();
  const payment = String(order.paymentStatus || "").toLowerCase();
  const isCod = String(order.paymentMethod || "").toLowerCase() === "cod"
    && order.lalamoveCodEnabled === true;
  return (payment === "paid" || (isCod && payment === "unpaid"))
    && ["ready", "served", "paid"].includes(status);
}

async function codSpecialRequest(credentials) {
  const result = await providerRequest(credentials, "GET", "/v3/cities");
  if (!result.ok) return "";
  for (const city of Array.isArray(result.json?.data) ? result.json.data : []) {
    for (const service of Array.isArray(city?.services) ? city.services : []) {
      if (String(service?.key || "") !== "MOTORCYCLE") continue;
      const names = (Array.isArray(service?.specialRequests) ? service.specialRequests : [])
        .map(item => String(item?.name || ""));
      if (names.includes("CASH_ON_DELIVERY")) return "CASH_ON_DELIVERY";
    }
  }
  return "";
}

function stop(lat, lng, address) {
  const n = value => Number(value).toFixed(7).replace(/0+$/, "").replace(/\.$/, "");
  return { coordinates: { lat: n(lat), lng: n(lng) }, address: String(address || "").trim() };
}

async function freshQuotation(context) {
  const { settings, order, account } = context;
  const pickupLat = coordinate(settings.storeLatitude, -90, 90);
  const pickupLng = coordinate(settings.storeLongitude, -180, 180);
  const dropoffLat = coordinate(order.deliveryLatitude, -90, 90);
  const dropoffLng = coordinate(order.deliveryLongitude, -180, 180);
  if (pickupLat === null || pickupLng === null) {
    throw new HttpsError("failed-precondition", "LALAMOVE_STORE_LOCATION_REQUIRED");
  }
  if (dropoffLat === null || dropoffLng === null) {
    throw new HttpsError("failed-precondition", "LALAMOVE_DELIVERY_LOCATION_REQUIRED");
  }
  const data = {
    serviceType: "MOTORCYCLE",
    language: "th_TH",
    stops: [
      stop(pickupLat, pickupLng, settings.shopAddress || settings.shopName || "Store"),
      stop(dropoffLat, dropoffLng, order.deliveryAddress || "Customer"),
    ],
  };
  if (String(order.paymentMethod || "").toLowerCase() === "cod") {
    const cod = await codSpecialRequest(account.credentials);
    if (!cod) throw new HttpsError("failed-precondition", "LALAMOVE_COD_UNAVAILABLE");
    data.specialRequests = [cod];
  }
  return quotationFromResponse(await providerRequest(
    account.credentials,
    "POST",
    "/v3/quotations",
    { data },
  ));
}

async function publicStorefrontLalamoveContext(slugValue) {
  const slug = String(slugValue || "").trim().toLowerCase();
  if (!slug) throw new HttpsError("invalid-argument", "STOREFRONT_SLUG_REQUIRED");
  const db = getFirestore();
  const slugSnap = await db.collection("tenantSlugs").doc(slug).get();
  if (!slugSnap.exists || slugSnap.data()?.active === false) {
    throw new HttpsError("not-found", "STOREFRONT_NOT_FOUND");
  }
  const tenantId = String(slugSnap.data()?.tenantId || "").trim();
  if (!tenantId) throw new HttpsError("not-found", "TENANT_NOT_FOUND");
  const tenantRef = db.collection("tenants").doc(tenantId);
  const settingsSnap = await tenantRef.collection("settings").doc("store").get();
  const settings = settingsSnap.data() || {};
  if (String(settings.deliveryProvider || "self").toLowerCase() !== "lalamove") {
    throw new HttpsError("failed-precondition", "LALAMOVE_NOT_ENABLED_FOR_TENANT");
  }
  const account = await accountFor(tenantRef);
  if (!account.ready) {
    throw new HttpsError("failed-precondition", "LALAMOVE_ACCOUNT_NOT_READY");
  }
  return { tenantId, tenantRef, settings, account };
}

async function publicLalamoveQuotation(request) {
  const context = await publicStorefrontLalamoveContext(request.data?.slug);
  const latitude = coordinate(request.data?.latitude, -90, 90);
  const longitude = coordinate(request.data?.longitude, -180, 180);
  if (latitude === null || longitude === null) {
    throw new HttpsError("invalid-argument", "LALAMOVE_DELIVERY_LOCATION_REQUIRED");
  }
  const paymentMethod = String(request.data?.paymentMethod || "").trim().toLowerCase();
  if (paymentMethod && !["promptpay", "cod"].includes(paymentMethod)) {
    throw new HttpsError("invalid-argument", "LALAMOVE_PAYMENT_METHOD_INVALID");
  }
  const address = String(request.data?.address || "").trim().slice(0, 500);
  const quote = await freshQuotation({
    ...context,
    order: {
      deliveryLatitude: latitude,
      deliveryLongitude: longitude,
      deliveryAddress: address,
      paymentMethod,
    },
  });
  return {
    item: {
      ...quote,
      accountMode: String(context.account.mode || "disabled"),
      accountEnvironment: String(context.account.credentials?.environment || "sandbox"),
    },
  };
}

async function usableQuotation(context) {
  const stored = context.order.lalamoveDispatchQuote && typeof context.order.lalamoveDispatchQuote === "object"
    ? context.order.lalamoveDispatchQuote : {};
  const quotationId = String(stored.quotationId || "").trim();
  const expiresAt = new Date(String(stored.expiresAt || "")).getTime();
  if (quotationId && Number.isFinite(expiresAt) && expiresAt > Date.now() + 10000) {
    const result = await providerRequest(
      context.account.credentials,
      "GET",
      `/v3/quotations/${encodeURIComponent(quotationId)}`,
    );
    if (result.ok) {
      const quote = quotationFromResponse(result);
      const isCod = String(context.order.paymentMethod || "").toLowerCase() === "cod";
      if (!isCod || quote.specialRequests.includes("CASH_ON_DELIVERY")) return quote;
    }
  }
  return freshQuotation(context);
}

function quotePatch(order, quote) {
  const checkoutFee = Math.max(0, Number(order.deliveryBaseFee || 0));
  const dispatchFee = Math.max(0, Number(quote.fee || 0));
  const difference = money(Math.max(0, dispatchFee - checkoutFee));
  return {
    lalamoveDispatchQuote: {
      quotationId: String(quote.quotationId || ""),
      expiresAt: String(quote.expiresAt || ""),
      fee: dispatchFee,
      currency: String(quote.currency || "THB"),
      distanceKm: quote.distanceKm ?? null,
      priceBreakdown: quote.priceBreakdown || {},
      specialRequests: quote.specialRequests || [],
      stops: quote.stops || [],
    },
    lalamoveDispatchFee: dispatchFee,
    lalamoveDispatchPriceDifference: difference,
    lalamoveDispatchRequiresApproval: difference > 0.009,
    lalamoveDispatchQuotedAt: new Date().toISOString(),
  };
}

function contacts(settings, order) {
  const senderName = String(settings.shopName || "").trim();
  const senderPhone = normalizePhone(settings.shopPhone);
  const recipientName = String(order.recipientName || "").trim();
  const recipientPhone = normalizePhone(order.recipientPhone);
  if (!senderName || !senderPhone) throw new HttpsError("failed-precondition", "LALAMOVE_SENDER_CONTACT_REQUIRED");
  if (!recipientName || !recipientPhone) throw new HttpsError("failed-precondition", "LALAMOVE_RECIPIENT_CONTACT_REQUIRED");
  let remarks = String(order.deliveryNote || order.orderNote || order.note || "").trim();
  const isCod = String(order.paymentMethod || "").toLowerCase() === "cod" && order.lalamoveCodEnabled === true;
  if (isCod) {
    const codAmount = money(Math.max(0, Number(order.lalamoveCodAmount ?? order.totalAmount ?? 0)));
    remarks = `COD: collect THB ${codAmount.toFixed(2)} from recipient${remarks ? " | " + remarks : ""}`;
  }
  return { senderName, senderPhone, recipientName, recipientPhone, remarks };
}

function dispatchState(order) {
  const quote = order.lalamoveDispatchQuote && typeof order.lalamoveDispatchQuote === "object"
    ? order.lalamoveDispatchQuote : {};
  return {
    fodOrderId: String(order.id || ""),
    ready: readyToDispatch(order),
    checkoutFee: Math.max(0, Number(order.deliveryBaseFee || 0)),
    quoteFee: Number.isFinite(Number(quote.fee)) ? Number(quote.fee) : null,
    difference: Number(order.lalamoveDispatchPriceDifference || 0),
    requiresApproval: order.lalamoveDispatchRequiresApproval === true,
    cod: String(order.paymentMethod || "").toLowerCase() === "cod" && order.lalamoveCodEnabled === true,
    codAmount: Math.max(0, Number(order.lalamoveCodAmount || 0)),
    quotationId: String(quote.quotationId || ""),
    expiresAt: String(quote.expiresAt || ""),
    currency: String(quote.currency || order.lalamoveCurrency || "THB"),
    accountMode: String(order.lalamoveAccountMode || ""),
    accountEnvironment: String(order.lalamoveAccountEnvironment || ""),
    accountOwner: String(order.lalamoveAccountOwner || ""),
    lalamoveOrderId: String(order.lalamoveOrderId || ""),
    lalamoveStatus: String(order.lalamoveOrderStatus || ""),
    driverId: String(order.lalamoveDriverId || ""),
    shareLink: String(order.lalamoveShareLink || ""),
    dispatchFee: Number.isFinite(Number(order.lalamoveDispatchFee)) ? Number(order.lalamoveDispatchFee) : null,
    walletDebitAmount: Number.isFinite(Number(order.lalamoveWalletDebitedAmount)) ? Number(order.lalamoveWalletDebitedAmount) : null,
    walletBalanceAfter: Number.isFinite(Number(order.lalamoveWalletBalanceAfter)) ? Number(order.lalamoveWalletBalanceAfter) : null,
    walletDebitPending: order.lalamoveWalletDebitPending === true,
    placedAt: String(order.lalamoveDispatchPlacedAt || ""),
    lastSyncedAt: String(order.lalamoveOrderLastSyncedAt || ""),
  };
}

function accountPatch(tenantId, account) {
  return {
    lalamoveAccountMode: account.mode,
    lalamoveAccountEnvironment: String(account.credentials?.environment || "sandbox"),
    lalamoveAccountOwner: account.mode === "tenant" ? tenantId : account.mode === "fod_central" ? "LUKKAJA" : "",
  };
}

function archiveDispatch(order) {
  const history = Array.isArray(order.lalamoveDispatchHistory) ? [...order.lalamoveDispatchHistory] : [];
  history.push({
    orderId: String(order.lalamoveOrderId || ""),
    status: String(order.lalamoveOrderStatus || ""),
    dispatchFee: Number.isFinite(Number(order.lalamoveDispatchFee)) ? Number(order.lalamoveDispatchFee) : null,
    shareLink: String(order.lalamoveShareLink || ""),
    placedAt: String(order.lalamoveDispatchPlacedAt || ""),
    walletDebitTransactionId: String(order.lalamoveWalletDebitTransactionId || ""),
    walletDebitedAmount: Number.isFinite(Number(order.lalamoveWalletDebitedAmount)) ? Number(order.lalamoveWalletDebitedAmount) : null,
    walletDebitPending: order.lalamoveWalletDebitPending === true,
    finishedAt: String(order.lalamoveOrderLastSyncedAt || new Date().toISOString()),
  });
  const patch = { lalamoveDispatchHistory: history.slice(-10) };
  for (const key of [
    "lalamoveOrderId", "lalamoveOrderStatus", "lalamoveDriverId",
    "lalamoveDriverName", "lalamoveDriverPhone", "lalamoveShareLink",
    "lalamoveDispatchPlacedAt", "lalamoveDispatchApprovedFee",
    "lalamoveDispatchCanceledAt", "lalamoveCancelSource",
    "lalamoveWalletDebitTransactionId", "lalamoveWalletDebitedAmount",
    "lalamoveWalletBalanceAfter", "lalamoveWalletDebitedAt",
    "lalamoveWalletDebitPending", "lalamoveWalletDebitError",
    "lalamoveWalletDebitAttemptedAmount", "lalamoveWalletDebitAttemptedAt",
    "lalamoveOrderLastSyncedAt", "lalamoveWebhookLastEventId",
    "lalamoveWebhookLastEventType", "lalamoveWebhookLastTimestamp",
  ]) patch[key] = FieldValue.delete();
  return patch;
}

async function appendFailure(tenantRef, order, stage, error, context = {}) {
  const quote = order.lalamoveDispatchQuote && typeof order.lalamoveDispatchQuote === "object"
    ? order.lalamoveDispatchQuote : {};
  const entry = {
    error: String(error || "LALAMOVE_DISPATCH_FAILED"),
    stage,
    providerError: String(context.providerError || context.message || ""),
    requestId: String(context.requestId || ""),
    requiredAmount: Number.isFinite(Number(context.requiredAmount)) ? money(context.requiredAmount) : null,
    walletBalance: Number.isFinite(Number(context.walletBalance)) ? money(context.walletBalance) : null,
    quoteFee: Number.isFinite(Number(context.quoteFee))
      ? money(context.quoteFee)
      : Number.isFinite(Number(quote.fee)) ? money(quote.fee) : null,
    currency: String(context.currency || quote.currency || order.lalamoveCurrency || "THB"),
    quotationId: String(context.quotationId || quote.quotationId || ""),
    occurredAt: new Date().toISOString(),
  };
  const history = Array.isArray(order.lalamoveDispatchFailureHistory)
    ? [...order.lalamoveDispatchFailureHistory, entry].slice(-20) : [entry];
  await tenantRef.collection("orders").doc(order.id).set({
    lalamoveDispatchFailureHistory: history,
    lalamoveLastDispatchFailure: entry,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return entry;
}

async function debitCentralWallet(tenantRef, order, quote, lalamoveOrder) {
  const db = getFirestore();
  const amount = money(quote.fee);
  if (amount <= 0.009) return null;
  const walletRef = tenantRef.collection("settings").doc("lalamoveWallet");
  const txId = randomUUID();
  const ledgerRef = tenantRef.collection("lalamoveWalletTransactions").doc(txId);
  let result = null;
  await db.runTransaction(async transaction => {
    const walletSnap = await transaction.get(walletRef);
    const before = money(walletSnap.data()?.balance);
    if (before + 0.009 < amount) {
      throw new HttpsError("failed-precondition", "FOD_WALLET_INSUFFICIENT_BALANCE", {
        requiredAmount: amount,
        walletBalance: before,
        currency: String(walletSnap.data()?.currency || "THB"),
      });
    }
    const after = money(before - amount);
    transaction.set(walletRef, {
      balance: after,
      currency: "THB",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(ledgerRef, {
      type: "delivery_debit",
      direction: "debit",
      amount,
      balanceBefore: before,
      balanceAfter: after,
      currency: "THB",
      orderId: order.id,
      lalamoveOrderId: String(lalamoveOrder.orderId || ""),
      quotationId: String(quote.quotationId || ""),
      reference: String(lalamoveOrder.orderId || "") ? `LALAMOVE:${lalamoveOrder.orderId}` : "",
      note: "Lalamove delivery fee via LUKKAJA Central",
      metadata: {
        accountMode: "fod_central",
        environment: String(order.lalamoveAccountEnvironment || "sandbox"),
        providerFee: Number.isFinite(Number(lalamoveOrder.fee)) ? Number(lalamoveOrder.fee) : amount,
      },
      createdBy: "system:lalamove-dispatch",
      createdAt: FieldValue.serverTimestamp(),
    });
    result = { id: txId, amount, balanceBefore: before, balanceAfter: after };
  });
  return result;
}

async function quoteAction(request) {
  const context = await loadContext(request);
  let order = context.order;
  if (!readyToDispatch(order)) throw new HttpsError("failed-precondition", "LALAMOVE_ORDER_NOT_READY");
  const currentId = String(order.lalamoveOrderId || "");
  if (currentId) {
    if (!RETRYABLE.has(String(order.lalamoveOrderStatus || "").toUpperCase())) {
      return { item: dispatchState(order), alreadyPlaced: true };
    }
    const archived = archiveDispatch(order);
    await context.orderRef.set(archived, { merge: true });
    order = {
      ...order,
      lalamoveDispatchHistory: archived.lalamoveDispatchHistory,
    };
    for (const key of [
      "lalamoveOrderId", "lalamoveOrderStatus", "lalamoveDriverId",
      "lalamoveDriverName", "lalamoveDriverPhone", "lalamoveShareLink",
      "lalamoveDispatchPlacedAt", "lalamoveDispatchApprovedFee",
      "lalamoveDispatchCanceledAt", "lalamoveCancelSource",
      "lalamoveWalletDebitTransactionId", "lalamoveWalletDebitedAmount",
      "lalamoveWalletBalanceAfter", "lalamoveWalletDebitedAt",
      "lalamoveWalletDebitPending", "lalamoveWalletDebitError",
      "lalamoveWalletDebitAttemptedAmount", "lalamoveWalletDebitAttemptedAt",
      "lalamoveOrderLastSyncedAt",
    ]) delete order[key];
  }
  const quote = await freshQuotation({ ...context, order });
  const patch = {
    ...accountPatch(context.profile.tenantId, context.account),
    ...quotePatch(order, quote),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await context.orderRef.set(patch, { merge: true });
  return { item: dispatchState({ ...order, ...patch }) };
}

exports.quotePublicLalamoveDelivery = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  try {
    return await publicLalamoveQuotation(request);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("PUBLIC_LALAMOVE_QUOTE_FAILED", error);
    throw new HttpsError("internal", "LALAMOVE_QUOTATION_FAILED");
  }
});

exports.quoteTenantLalamoveDispatch = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  try {
    return await quoteAction(request);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("LALAMOVE_QUOTE_FAILED", error);
    throw new HttpsError("internal", "LALAMOVE_DISPATCH_QUOTE_FAILED");
  }
});

exports.placeTenantLalamoveDispatch = onCall({ region: REGION, timeoutSeconds: 45 }, async request => {
  const context = await loadContext(request);
  let order = {
    ...context.order,
    ...accountPatch(context.profile.tenantId, context.account),
  };
  if (!readyToDispatch(order)) throw new HttpsError("failed-precondition", "LALAMOVE_ORDER_NOT_READY");
  if (String(order.lalamoveOrderId || "")) {
    return { item: dispatchState(order), alreadyPlaced: true };
  }

  let quote;
  try {
    quote = await usableQuotation({ ...context, order });
  } catch (error) {
    await appendFailure(context.tenantRef, order, "quote", error.message, error.details || {});
    throw error;
  }
  order = { ...order, ...quotePatch(order, quote) };
  const difference = money(Math.max(0, Number(quote.fee || 0) - Number(order.deliveryBaseFee || 0)));
  const approveDifference = request.data?.approveDifference === true;
  const approvedFee = Math.max(0, Number(request.data?.approvedFee || 0));
  if (difference > 0.009 && (!approveDifference || approvedFee + 0.009 < Number(quote.fee || 0))) {
    await context.orderRef.set({ ...quotePatch(order, quote), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await appendFailure(context.tenantRef, order, "price_approval", "LALAMOVE_PRICE_DIFFERENCE_APPROVAL_REQUIRED", {
      requiredAmount: Number(quote.fee || 0), quoteFee: Number(quote.fee || 0),
    });
    throw new HttpsError("failed-precondition", "LALAMOVE_PRICE_DIFFERENCE_APPROVAL_REQUIRED", {
      requiredAmount: Number(quote.fee || 0), item: dispatchState(order),
    });
  }

  const contact = contacts(context.settings, order);
  const stops = Array.isArray(quote.stops) ? quote.stops : [];
  const pickupStopId = String(stops[0]?.stopId || "");
  const dropoffStopId = String(stops[1]?.stopId || "");
  if (!pickupStopId || !dropoffStopId) {
    await appendFailure(context.tenantRef, order, "quote", "LALAMOVE_STOP_ID_MISSING");
    throw new HttpsError("unavailable", "LALAMOVE_STOP_ID_MISSING");
  }
  const isCod = String(order.paymentMethod || "").toLowerCase() === "cod" && order.lalamoveCodEnabled === true;
  if (isCod && !(quote.specialRequests || []).includes("CASH_ON_DELIVERY")) {
    await appendFailure(context.tenantRef, order, "quote", "LALAMOVE_COD_QUOTATION_REQUIRED");
    throw new HttpsError("failed-precondition", "LALAMOVE_COD_QUOTATION_REQUIRED");
  }

  if (context.account.mode === "fod_central") {
    const walletSnap = await context.tenantRef.collection("settings").doc("lalamoveWallet").get();
    const balance = money(walletSnap.data()?.balance);
    const required = money(quote.fee);
    if (required > balance + 0.009) {
      await appendFailure(context.tenantRef, order, "wallet", "FOD_WALLET_INSUFFICIENT_BALANCE", {
        requiredAmount: required,
        walletBalance: balance,
        quoteFee: required,
        currency: String(walletSnap.data()?.currency || "THB"),
      });
      throw new HttpsError("failed-precondition", "FOD_WALLET_INSUFFICIENT_BALANCE", {
        requiredAmount: required,
        walletBalance: balance,
        currency: String(walletSnap.data()?.currency || "THB"),
      });
    }
  }

  const metadata = {
    fodOrderId: String(order.id),
    tenantId: String(context.profile.tenantId),
    paymentMethod: String(order.paymentMethod || "").toLowerCase(),
    ...(isCod ? { codAmount: money(order.lalamoveCodAmount ?? order.totalAmount ?? 0).toFixed(2) } : {}),
  };
  const body = {
    data: {
      quotationId: String(quote.quotationId),
      sender: {
        stopId: pickupStopId,
        name: contact.senderName,
        phone: contact.senderPhone,
      },
      recipients: [{
        stopId: dropoffStopId,
        name: contact.recipientName,
        phone: contact.recipientPhone,
        remarks: String(contact.remarks || "").slice(0, 1500),
      }],
      isPODEnabled: false,
      metadata: Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)])),
    },
  };

  const provider = await providerRequest(context.account.credentials, "POST", "/v3/orders", body);
  if (!provider.ok) {
    await appendFailure(context.tenantRef, order, "place", "LALAMOVE_ORDER_CREATE_FAILED", {
      providerError: provider.message,
      requestId: provider.requestId,
      quoteFee: quote.fee,
    });
    throw providerError("LALAMOVE_ORDER_CREATE_FAILED", provider);
  }
  const placed = orderFromResponse(provider);
  let walletDebit = null;
  let walletDebitError = "";
  if (context.account.mode === "fod_central") {
    try {
      walletDebit = await debitCentralWallet(
        context.tenantRef,
        { ...order, lalamoveAccountEnvironment: context.account.credentials.environment },
        quote,
        placed,
      );
    } catch (error) {
      walletDebitError = String(error?.message || "FOD_WALLET_DEBIT_FAILED");
      const walletSnap = await context.tenantRef.collection("settings").doc("lalamoveWallet").get();
      await appendFailure(context.tenantRef, order, "wallet_debit", walletDebitError, {
        requiredAmount: Number(quote.fee || 0),
        walletBalance: Number(walletSnap.data()?.balance || 0),
        quoteFee: quote.fee,
        currency: "THB",
      });
    }
  }

  const nowIso = new Date().toISOString();
  const completion = lalamoveCompletionPatch(order, placed.status, nowIso);
  const patch = {
    ...accountPatch(context.profile.tenantId, context.account),
    ...quotePatch(order, quote),
    lalamoveOrderId: placed.orderId,
    lalamoveOrderStatus: placed.status,
    lalamoveDriverId: placed.driverId,
    lalamoveShareLink: placed.shareLink,
    lalamoveDispatchPlacedAt: nowIso,
    lalamoveDispatchApprovedFee: difference > 0.009 ? Number(quote.fee || 0) : null,
    lalamoveOrderLastSyncedAt: nowIso,
    ...(Number.isFinite(Number(placed.fee)) ? { lalamoveDispatchFee: Number(placed.fee) } : {}),
    ...completion,
    ...(walletDebit ? {
      lalamoveWalletDebitTransactionId: walletDebit.id,
      lalamoveWalletDebitedAmount: walletDebit.amount,
      lalamoveWalletBalanceAfter: walletDebit.balanceAfter,
      lalamoveWalletDebitedAt: nowIso,
      lalamoveWalletDebitPending: false,
      lalamoveWalletDebitError: FieldValue.delete(),
    } : walletDebitError ? {
      lalamoveWalletDebitPending: true,
      lalamoveWalletDebitError: walletDebitError,
      lalamoveWalletDebitAttemptedAmount: Number(quote.fee || 0),
      lalamoveWalletDebitAttemptedAt: nowIso,
    } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await context.orderRef.set(patch, { merge: true });
  const stateOrder = {
    ...order,
    ...patch,
    lalamoveWalletDebitError: walletDebitError || "",
  };
  return { item: dispatchState(stateOrder), created: true };
});

exports.refreshTenantLalamoveDispatch = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const context = await loadContext(request, { requireReady: false });
  const orderId = String(context.order.lalamoveOrderId || "").trim();
  if (!orderId) return { item: dispatchState(context.order) };

  // Repair stale terminal data from the already persisted provider status before
  // requiring live credentials or making another Lalamove API request.
  if (lalamoveCompletionNeedsRepair(context.order)) {
    const repairedAt = new Date().toISOString();
    const repair = lalamoveCompletionPatch(
      context.order,
      context.order.lalamoveOrderStatus,
      repairedAt,
    );
    await context.orderRef.set({ ...repair, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { item: dispatchState({ ...context.order, ...repair }), cached: true, repaired: true };
  }

  if (!context.account.ready) throw new HttpsError("failed-precondition", "LALAMOVE_ACCOUNT_NOT_READY");

  const lastSync = new Date(String(context.order.lalamoveOrderLastSyncedAt || "")).getTime();
  if (Number.isFinite(lastSync) && Date.now() - lastSync < 10000) {
    return { item: dispatchState(context.order), cached: true };
  }
  const provider = await providerRequest(
    context.account.credentials,
    "GET",
    `/v3/orders/${encodeURIComponent(orderId)}`,
  );
  if (!provider.ok) throw providerError("LALAMOVE_ORDER_STATUS_FAILED", provider);
  const current = orderFromResponse(provider);
  const nowIso = new Date().toISOString();
  const completion = lalamoveCompletionPatch(context.order, current.status, nowIso);
  const patch = {
    lalamoveOrderStatus: current.status,
    lalamoveDriverId: current.driverId,
    lalamoveShareLink: current.shareLink,
    lalamoveOrderLastSyncedAt: nowIso,
    ...(Number.isFinite(Number(current.fee)) ? { lalamoveDispatchFee: Number(current.fee) } : {}),
    ...completion,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await context.orderRef.set(patch, { merge: true });
  return { item: dispatchState({ ...context.order, ...patch }) };
});

exports.cancelTenantLalamoveDispatch = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const context = await loadContext(request);
  const orderId = String(context.order.lalamoveOrderId || "").trim();
  if (!orderId) throw new HttpsError("failed-precondition", "LALAMOVE_ORDER_NOT_PLACED");
  const current = String(context.order.lalamoveOrderStatus || "").toUpperCase();
  if (["CANCELED", "CANCELLED"].includes(current)) {
    return { item: dispatchState(context.order), alreadyCanceled: true };
  }
  if (["PICKED_UP", "COMPLETED"].includes(current)) {
    throw new HttpsError("failed-precondition", "LALAMOVE_ORDER_CANCEL_FORBIDDEN");
  }
  const provider = await providerRequest(
    context.account.credentials,
    "DELETE",
    `/v3/orders/${encodeURIComponent(orderId)}`,
  );
  if (!provider.ok) throw providerError("LALAMOVE_ORDER_CANCEL_FAILED", provider);
  const nowIso = new Date().toISOString();
  const patch = {
    lalamoveOrderStatus: "CANCELED",
    lalamoveDispatchCanceledAt: nowIso,
    lalamoveCancelSource: "FOD_CASHIER",
    lalamoveOrderLastSyncedAt: nowIso,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await context.orderRef.set(patch, { merge: true });
  return { item: dispatchState({ ...context.order, ...patch }), canceled: true };
});
