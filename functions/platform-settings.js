const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { createHmac, randomUUID } = require("crypto");

const REGION = "asia-southeast1";
const PRIVATE_COLLECTION = "platformPrivateSettings";
const LEGACY_SLIP2GO_API_URL = "https://connect.slip2go.com";
const SLIP2GO_API_URL_MIGRATION_FIELD = "migration20260929Slip2GoApiUrlBackfilledAt";

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
  return profile;
}

function mask(value = "") {
  const text = String(value || "").trim();
  return text ? `••••••••${text.slice(-4)}` : "";
}

function timestampIso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

async function privateData(id) {
  const snapshot = await getFirestore().collection(PRIVATE_COLLECTION).doc(id).get();
  return snapshot.exists ? snapshot.data() || {} : {};
}

function cleanSecret(value, max = 1024) {
  const text = String(value || "").trim();
  if (text.length > max) throw new HttpsError("invalid-argument", "Secret value is too long");
  return text;
}

function googleStatus(data = {}) {
  const maps = String(data.mapsBrowserKey || "");
  const routes = String(data.routesApiKey || "");
  const vision = String(data.visionApiKey || "");
  return {
    storageReady: true,
    mapsBrowserConfigured: Boolean(maps),
    mapsBrowserMasked: mask(maps),
    routesApiConfigured: Boolean(routes),
    routesApiMasked: mask(routes),
    visionApiConfigured: Boolean(vision),
    visionApiMasked: mask(vision),
    serverApiConfigured: Boolean(routes),
    serverApiMasked: mask(routes),
  };
}

function validBrandingPath(value = "", kind = "") {
  const path = String(value || "").trim();
  if (!path) return "";
  const prefixes = { logo: "logo-", favicon: "favicon-", appIcon: "app-icon-" };
  const prefix = prefixes[kind];
  if (!prefix || !path.startsWith(`platform-branding/${prefix}`)) {
    throw new HttpsError("invalid-argument", "PLATFORM_BRANDING_PATH_INVALID");
  }
  if (!/\.(?:png|jpe?g|webp|ico)$/i.test(path)) {
    throw new HttpsError("invalid-argument", "PLATFORM_BRANDING_PATH_INVALID");
  }
  return path;
}

function brandingPayload(data = {}) {
  const logoPath = String(data.logoPath || "");
  const faviconPath = String(data.faviconPath || "");
  const appIconPath = String(data.appIconPath || "");
  return {
    logoPath,
    faviconPath,
    appIconPath,
    logoConfigured: Boolean(logoPath),
    faviconConfigured: Boolean(faviconPath),
    appIconConfigured: Boolean(appIconPath),
  };
}

exports.getPlatformBranding = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const snapshot = await getFirestore().collection("platformSettings").doc("branding").get();
  return { item: brandingPayload(snapshot.exists ? snapshot.data() : {}) };
});

exports.updatePlatformBranding = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const ref = getFirestore().collection("platformSettings").doc("branding");
  const snapshot = await ref.get();
  const current = snapshot.exists ? snapshot.data() || {} : {};
  const data = request.data || {};
  const next = {
    logoPath: data.clearLogo === true ? "" : (
      Object.prototype.hasOwnProperty.call(data, "logoPath") && data.logoPath
        ? validBrandingPath(data.logoPath, "logo") : String(current.logoPath || "")
    ),
    faviconPath: data.clearFavicon === true ? "" : (
      Object.prototype.hasOwnProperty.call(data, "faviconPath") && data.faviconPath
        ? validBrandingPath(data.faviconPath, "favicon") : String(current.faviconPath || "")
    ),
    appIconPath: data.clearAppIcon === true ? "" : (
      Object.prototype.hasOwnProperty.call(data, "appIconPath") && data.appIconPath
        ? validBrandingPath(data.appIconPath, "appIcon") : String(current.appIconPath || "")
    ),
  };

  await ref.set({
    id: "branding",
    tenantId: "__platform__",
    ...next,
    updatedBy: request.auth.uid,
    updatedByEmail: request.auth.token?.email || "",
    updatedAt: FieldValue.serverTimestamp(),
    updatedAtMs: Date.now(),
  }, { merge: true });

  const oldPaths = [current.logoPath, current.faviconPath, current.appIconPath]
    .map(value => String(value || "").trim())
    .filter(Boolean);
  const nextPaths = new Set(Object.values(next).filter(Boolean));
  for (const oldPath of oldPaths) {
    if (!nextPaths.has(oldPath) && oldPath.startsWith("platform-branding/")) {
      await getStorage().bucket().file(oldPath).delete().catch(() => {});
    }
  }
  return { ok: true, item: brandingPayload(next) };
});

exports.getPlatformGoogleApis = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  return { item: googleStatus(await privateData("googleApis")) };
});

exports.updatePlatformGoogleApis = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const current = await privateData("googleApis");
  const next = { ...current };
  const data = request.data || {};
  const fields = [
    ["mapsBrowserKey", "clearMapsBrowserKey"],
    ["routesApiKey", "clearRoutesApiKey"],
    ["visionApiKey", "clearVisionApiKey"],
  ];
  for (const [key, clearKey] of fields) {
    if (data[clearKey] === true) next[key] = "";
    else {
      const incoming = cleanSecret(data[key], 512);
      if (incoming) next[key] = incoming;
    }
  }
  await getFirestore().collection(PRIVATE_COLLECTION).doc("googleApis").set({
    ...next,
    updatedBy: request.auth.uid,
    updatedByEmail: request.auth.token?.email || "",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { item: googleStatus(next) };
});

function normalizeSlipUrl(value = "") {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) return "";
  let url;
  try { url = new URL(text); } catch { throw new HttpsError("invalid-argument", "SLIP2GO_API_URL_INVALID"); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || (host !== "slip2go.com" && !host.endsWith(".slip2go.com")) || (url.port && url.port !== "443")) {
    throw new HttpsError("invalid-argument", "SLIP2GO_API_URL_INVALID");
  }
  return `https://${host}${url.port ? ":443" : ""}`;
}

function normalizeThaiName(value = "") {
  return String(value || "").trim().replace(/^(?:นาย|นางสาว|นาง)\s*/u, "").trim();
}
function normalizeEnglishName(value = "") {
  return String(value || "").trim().replace(/^(?:mr\.?|mrs\.?|ms\.?|miss)\s+/iu, "").trim();
}
function normalizeAccountNumber(value = "") {
  return String(value || "").replace(/[^A-Za-z0-9]/g, "");
}

function slipStatus(data = {}, googleVisionReady = false) {
  const provider = ["google_vision", "slip2go", "slip2go_fallback_vision"].includes(data.provider)
    ? data.provider : "google_vision";
  const apiUrl = String(data.slip2GoApiUrl || "");
  const secret = String(data.slip2GoSecret || "");
  const receiver = {
    accountType: String(data.receiverAccountType || ""),
    accountNameTH: String(data.receiverNameTh || ""),
    accountNameEN: String(data.receiverNameEn || ""),
    accountNumber: String(data.receiverAccountNumber || ""),
  };
  const receiverReady = Boolean(receiver.accountNumber || receiver.accountNameTH || receiver.accountNameEN);
  const credentialsReady = Boolean(apiUrl && secret);
  return {
    storageReady: true,
    provider,
    slip2GoApiUrl: apiUrl,
    slip2GoSecretConfigured: Boolean(secret),
    slip2GoSecretMasked: mask(secret),
    slip2GoCredentialsReady: credentialsReady,
    slip2GoReady: credentialsReady && receiverReady,
    receiver,
    googleVisionReady: Boolean(googleVisionReady),
  };
}

async function slipStatusWithGoogle(data) {
  const google = await privateData("googleApis");
  return slipStatus(data, Boolean(String(google.visionApiKey || "")));
}

async function migrateLegacySlip2GoApiUrlIfNeeded() {
  const ref = getFirestore().collection(PRIVATE_COLLECTION).doc("slipVerification");
  const snapshot = await ref.get();
  const data = snapshot.exists ? snapshot.data() || {} : {};
  const provider = String(data.provider || "");
  const needsUrl = !String(data.slip2GoApiUrl || "").trim();
  const hasSecret = Boolean(String(data.slip2GoSecret || ""));
  const alreadyMigrated = Boolean(data[SLIP2GO_API_URL_MIGRATION_FIELD]);
  const slip2GoProvider = ["slip2go", "slip2go_fallback_vision"].includes(provider);

  if (!needsUrl || !hasSecret || alreadyMigrated || !slip2GoProvider) return data;

  await ref.set({
    slip2GoApiUrl: LEGACY_SLIP2GO_API_URL,
    [SLIP2GO_API_URL_MIGRATION_FIELD]: FieldValue.serverTimestamp(),
    migration20260929Slip2GoApiUrlSource: "laravel_master",
  }, { merge: true });

  console.info("SLIP2GO_API_URL_LEGACY_BACKFILL", {
    provider,
    apiUrl: LEGACY_SLIP2GO_API_URL,
  });
  return { ...data, slip2GoApiUrl: LEGACY_SLIP2GO_API_URL };
}

exports.getPlatformSlipVerification = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const data = await migrateLegacySlip2GoApiUrlIfNeeded();
  return { item: await slipStatusWithGoogle(data) };
});

exports.updatePlatformSlipVerification = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const data = request.data || {};
  const provider = String(data.provider || "");
  if (!["google_vision", "slip2go", "slip2go_fallback_vision"].includes(provider)) {
    throw new HttpsError("invalid-argument", "Slip verification provider is invalid");
  }
  const current = await privateData("slipVerification");
  const next = {
    ...current,
    provider,
    slip2GoApiUrl: Object.prototype.hasOwnProperty.call(data, "slip2GoApiUrl")
      ? normalizeSlipUrl(data.slip2GoApiUrl) : String(current.slip2GoApiUrl || ""),
    receiverAccountType: String(data.receiverAccountType || "").trim().slice(0, 32),
    receiverNameTh: normalizeThaiName(data.receiverNameTh).slice(0, 180),
    receiverNameEn: normalizeEnglishName(data.receiverNameEn).slice(0, 180),
    receiverAccountNumber: normalizeAccountNumber(data.receiverAccountNumber).slice(0, 80),
  };
  if (data.clearSlip2GoSecret === true) next.slip2GoSecret = "";
  else {
    const incoming = cleanSecret(data.slip2GoSecret, 1024);
    if (incoming) next.slip2GoSecret = incoming;
  }
  await getFirestore().collection(PRIVATE_COLLECTION).doc("slipVerification").set({
    ...next,
    updatedBy: request.auth.uid,
    updatedByEmail: request.auth.token?.email || "",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { item: await slipStatusWithGoogle(next) };
});

function slip2GoConnectionStatus(code = "", httpStatus = 0) {
  const normalized = String(code || "");
  if (["401001", "401002", "401003", "401004", "401007"].includes(normalized) || [401, 403].includes(Number(httpStatus))) {
    return "config_invalid";
  }
  if (["401005", "401006"].includes(normalized)) return "quota_exhausted";
  if (normalized === "429000" || Number(httpStatus) === 429) return "rate_limited";
  return "unavailable";
}

exports.testPlatformSlipVerification = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  await assertSuperAdmin(request.auth);
  const data = await migrateLegacySlip2GoApiUrlIfNeeded();
  const apiUrl = normalizeSlipUrl(data.slip2GoApiUrl || "");
  const secret = String(data.slip2GoSecret || "");
  if (!apiUrl || !secret) throw new HttpsError("failed-precondition", "SLIP2GO_CONFIG_REQUIRED");
  try {
    const response = await fetch(`${apiUrl}/api/account/info`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(15000),
    });
    const responseText = await response.text();
    let payload = {};
    try { payload = responseText ? JSON.parse(responseText) : {}; } catch { payload = {}; }
    const code = String(payload?.code || "");
    const ok = response.ok && code === "200001";
    const status = ok ? "ready" : slip2GoConnectionStatus(code, response.status);
    const message = String(payload?.message || responseText || "").slice(0, 500);
    console.info("SLIP2GO_ACCOUNT_CHECK_RESULT", {
      ok,
      status,
      httpStatus: response.status,
      code: code || null,
      message,
    });
    return {
      ok,
      result: {
        ok,
        status,
        httpStatus: response.status,
        code: code || null,
        data: payload?.data && typeof payload.data === "object" ? payload.data : {},
        message,
      },
    };
  } catch (error) {
    console.warn("SLIP2GO_ACCOUNT_CHECK_FAILED", error?.message || error);
    return {
      ok: false,
      result: {
        ok: false,
        status: error?.name === "TimeoutError" ? "timeout" : "unavailable",
        httpStatus: null,
        code: null,
        data: {},
        message: String(error?.message || "").slice(0, 500),
      },
    };
  }
});

function lalamovePrefixesValid(data = {}) {
  const env = data.environment === "production" ? "production" : "sandbox";
  const key = String(data.apiKey || "");
  const secret = String(data.apiSecret || "");
  if (!key || !secret) return false;
  return key.startsWith(env === "production" ? "pk_prod" : "pk_test")
    && secret.startsWith(env === "production" ? "sk_prod" : "sk_test");
}

function lalamoveStatus(data = {}) {
  const environment = data.environment === "production" ? "production" : "sandbox";
  const apiKey = String(data.apiKey || "");
  const apiSecret = String(data.apiSecret || "");
  const verifiedAt = timestampIso(data.connectionVerifiedAt);
  const prefixesValid = lalamovePrefixesValid({ environment, apiKey, apiSecret });
  return {
    storageReady: true,
    environment,
    apiKeyConfigured: Boolean(apiKey),
    apiKeyMasked: mask(apiKey),
    apiSecretConfigured: Boolean(apiSecret),
    apiSecretMasked: mask(apiSecret),
    prefixesValid,
    connectionVerified: Boolean(verifiedAt),
    connectionVerifiedAt: verifiedAt,
    ready: Boolean(apiKey && apiSecret && prefixesValid && verifiedAt),
    market: "TH",
  };
}

async function lalamoveRequest(data, method, path, body = null) {
  const environment = data.environment === "production" ? "production" : "sandbox";
  const apiKey = String(data.apiKey || "");
  const apiSecret = String(data.apiSecret || "");
  if (!apiKey || !apiSecret) return { ok: false, status: 0, message: "LALAMOVE_CREDENTIALS_REQUIRED", requestId: randomUUID(), json: {} };
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
    const errors = Array.isArray(json?.errors) ? json.errors : [];
    const first = errors[0] || {};
    const message = String(json?.message || [first.id, first.message, first.detail].filter(Boolean).join(" "));
    return { ok: response.ok, status: response.status, message, requestId: String(json?.meta?.requestId || requestId), json };
  } catch (error) {
    console.warn("LALAMOVE_PLATFORM_REQUEST_FAILED", environment, path, requestId, error?.message || error);
    return { ok: false, status: 0, message: "LALAMOVE_CONNECTION_FAILED", requestId, json: {} };
  }
}

exports.getPlatformLalamove = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  return { item: lalamoveStatus(await privateData("lalamove")) };
});

exports.updatePlatformLalamove = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const data = request.data || {};
  const environment = data.environment === "production" ? "production" : data.environment === "sandbox" ? "sandbox" : null;
  if (!environment) throw new HttpsError("invalid-argument", "Lalamove environment is invalid");
  const current = await privateData("lalamove");
  const next = { ...current, environment };
  if (data.clearApiKey === true) next.apiKey = "";
  else {
    const incoming = cleanSecret(data.apiKey, 512);
    if (incoming) next.apiKey = incoming;
  }
  if (data.clearApiSecret === true) next.apiSecret = "";
  else {
    const incoming = cleanSecret(data.apiSecret, 512);
    if (incoming) next.apiSecret = incoming;
  }
  const changed = environment !== (current.environment || "sandbox")
    || String(next.apiKey || "") !== String(current.apiKey || "")
    || String(next.apiSecret || "") !== String(current.apiSecret || "");
  const write = {
    ...next,
    updatedBy: request.auth.uid,
    updatedByEmail: request.auth.token?.email || "",
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (changed) write.connectionVerifiedAt = null;
  await getFirestore().collection(PRIVATE_COLLECTION).doc("lalamove").set(write, { merge: true });
  if (changed) next.connectionVerifiedAt = null;
  return { item: lalamoveStatus(next) };
});

exports.testPlatformLalamove = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  await assertSuperAdmin(request.auth);
  const data = await privateData("lalamove");
  const ref = getFirestore().collection(PRIVATE_COLLECTION).doc("lalamove");
  if (!lalamovePrefixesValid(data)) {
    await ref.set({ connectionVerifiedAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw new HttpsError("failed-precondition", "LALAMOVE_CREDENTIAL_PREFIX_MISMATCH");
  }
  const result = await lalamoveRequest(data, "GET", "/v3/cities");
  if (!result.ok) {
    await ref.set({ connectionVerifiedAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw new HttpsError("unavailable", result.message || "LALAMOVE_CONNECTION_FAILED", { requestId: result.requestId });
  }
  const now = new Date();
  await ref.set({
    connectionVerifiedAt: now,
    updatedBy: request.auth.uid,
    updatedByEmail: request.auth.token?.email || "",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true, requestId: result.requestId, item: lalamoveStatus({ ...data, connectionVerifiedAt: now }) };
});

exports.registerPlatformLalamoveWebhook = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  await assertSuperAdmin(request.auth);
  const data = await privateData("lalamove");
  if (!lalamoveStatus(data).ready) throw new HttpsError("failed-precondition", "LALAMOVE_PLATFORM_NOT_READY");
  const urlText = String(request.data?.url || "").trim();
  let url;
  try { url = new URL(urlText); } catch { throw new HttpsError("invalid-argument", "LALAMOVE_WEBHOOK_PUBLIC_HTTPS_REQUIRED"); }
  if (url.protocol !== "https:" || !url.hostname || ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase()) || url.pathname !== "/api/lalamove/webhook") {
    throw new HttpsError("invalid-argument", "LALAMOVE_WEBHOOK_PUBLIC_HTTPS_REQUIRED");
  }
  const result = await lalamoveRequest(data, "PATCH", "/v3/webhook", { data: { url: urlText } });
  if (!result.ok) throw new HttpsError("unavailable", result.message || "LALAMOVE_WEBHOOK_SETUP_FAILED", { requestId: result.requestId });
  return { ok: true, url: String(result.json?.data?.url || urlText), requestId: result.requestId };
});
