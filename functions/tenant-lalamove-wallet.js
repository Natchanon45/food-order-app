const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { createHash, createHmac, randomUUID } = require("crypto");

const REGION = "asia-southeast1";

async function assertSuperAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!profile || profile.active === false || profile.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Super admin permission required");
  }
  return profile;
}

async function assertTenantAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const profile = (await getFirestore().collection("users").doc(auth.uid).get()).data();
  if (!profile || profile.active === false || !["owner", "admin"].includes(profile.role) || !profile.tenantId) {
    throw new HttpsError("permission-denied", "Owner or admin permission required");
  }
  return { ...profile, uid: auth.uid, tenantId: String(profile.tenantId) };
}

function mask(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const prefix = text.match(/^(?:pk|sk)_(?:test|prod)/)?.[0] || "";
  return `${prefix}••••${text.slice(-4)}`;
}

function lalamovePrefixesValid(environment, apiKey, apiSecret) {
  const env = environment === "production" ? "production" : "sandbox";
  const keyPrefix = env === "production" ? "pk_prod" : "pk_test";
  const secretPrefix = env === "production" ? "sk_prod" : "sk_test";
  return Boolean(apiKey && apiSecret && String(apiKey).startsWith(keyPrefix) && String(apiSecret).startsWith(secretPrefix));
}

async function lalamoveRequest(credentials, method = "GET", path = "/v3/cities") {
  const environment = credentials.environment === "production" ? "production" : "sandbox";
  const apiKey = String(credentials.apiKey || "");
  const apiSecret = String(credentials.apiSecret || "");
  if (!apiKey || !apiSecret) return { ok: false, status: 0, message: "LALAMOVE_CREDENTIALS_REQUIRED", requestId: randomUUID() };
  const host = environment === "production" ? "https://rest.lalamove.com" : "https://rest.sandbox.lalamove.com";
  const timestamp = String(Date.now());
  const raw = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n`;
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
      },
      signal: AbortSignal.timeout(12000),
    });
    const json = await response.json().catch(() => ({}));
    const first = Array.isArray(json?.errors) ? json.errors[0] || {} : {};
    const message = String(json?.message || [first.id, first.message, first.detail].filter(Boolean).join(" "));
    return { ok: response.ok, status: response.status, message, requestId: String(json?.meta?.requestId || requestId) };
  } catch (error) {
    console.warn("LALAMOVE_TENANT_REQUEST_FAILED", environment, path, requestId, error?.message || error);
    return { ok: false, status: 0, message: "LALAMOVE_CONNECTION_FAILED", requestId };
  }
}

async function tenantRef(tenantId) {
  const id = String(tenantId || "").trim();
  if (!id) throw new HttpsError("invalid-argument", "Tenant ID is required");
  const ref = getFirestore().collection("tenants").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "TENANT_NOT_FOUND");
  return ref;
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function accountStatus(data = {}, platformReady = false) {
  const mode = ["disabled", "fod_central", "partner"].includes(String(data.accountMode || ""))
    ? String(data.accountMode)
    : "disabled";
  const approved = data.fodCentralApproved === true;
  const tenantVerified = Boolean(data.tenantConnectionVerifiedAt || data.connectionVerifiedAt);
  return {
    accountMode: mode,
    fodCentralApproved: approved,
    tenantConnectionVerified: tenantVerified,
    available: mode === "fod_central" ? approved && platformReady : mode === "partner" && tenantVerified,
  };
}

async function platformLalamoveStatus() {
  const snapshot = await getFirestore().collection("platformPrivateSettings").doc("lalamove").get();
  const data = snapshot.data() || {};
  const environment = data.environment === "production" ? "production" : "sandbox";
  const apiKey = String(data.apiKey || "");
  const apiSecret = String(data.apiSecret || "");
  const ready = Boolean(apiKey && apiSecret && lalamovePrefixesValid(environment, apiKey, apiSecret) && data.connectionVerifiedAt);
  return { ready, environment, apiKey, apiSecret };
}

async function platformReady() {
  return (await platformLalamoveStatus()).ready;
}

async function tenantLalamoveStatus(ref) {
  const [publicSnapshot, privateSnapshot, platform] = await Promise.all([
    ref.collection("settings").doc("lalamove").get(),
    ref.collection("privateSettings").doc("lalamove").get(),
    platformLalamoveStatus(),
  ]);
  const publicData = publicSnapshot.data() || {};
  const privateData = privateSnapshot.data() || {};
  const mode = ["disabled", "fod_central", "partner"].includes(String(publicData.accountMode || ""))
    ? String(publicData.accountMode) : "disabled";
  const environment = privateData.environment === "production" ? "production" : "sandbox";
  const apiKey = String(privateData.apiKey || "");
  const apiSecret = String(privateData.apiSecret || "");
  const verifiedAt = privateData.connectionVerifiedAt || publicData.tenantConnectionVerifiedAt || null;
  const tenantReady = mode === "partner"
    && lalamovePrefixesValid(environment, apiKey, apiSecret)
    && Boolean(verifiedAt);
  const centralApproved = publicData.fodCentralApproved === true;
  const available = mode === "partner"
    ? tenantReady
    : mode === "fod_central" && centralApproved && platform.ready;
  return {
    storageReady: true,
    configured: publicSnapshot.exists || privateSnapshot.exists,
    legacyCentral: false,
    accountMode: mode === "partner" ? "tenant" : mode,
    effectiveMode: available ? (mode === "partner" ? "tenant" : mode) : "disabled",
    available,
    environment: mode === "partner" ? environment : platform.environment,
    tenantApiKeyConfigured: Boolean(apiKey),
    tenantApiKeyMasked: mask(apiKey),
    tenantApiSecretConfigured: Boolean(apiSecret),
    tenantApiSecretMasked: mask(apiSecret),
    tenantConnectionVerified: Boolean(verifiedAt),
    tenantConnectionVerifiedAt: dateValue(verifiedAt),
    tenantReady,
    fodCentralApproved: centralApproved,
    fodCentralApprovedAt: dateValue(publicData.fodCentralApprovedAt),
    platformReady: platform.ready,
    platformApiKeyConfigured: centralApproved && Boolean(platform.apiKey),
    platformApiKeyMasked: centralApproved ? mask(platform.apiKey) : "",
    platformApiSecretConfigured: centralApproved && Boolean(platform.apiSecret),
    platformApiSecretMasked: centralApproved ? mask(platform.apiSecret) : "",
  };
}

async function slipDestination() {
  const snapshot = await getFirestore().collection("platformPrivateSettings").doc("slipVerification").get();
  const data = snapshot.data() || {};
  const accountType = String(data.receiverAccountType || "");
  const accountNameTH = String(data.receiverNameTh || "");
  const accountNameEN = String(data.receiverNameEn || "");
  const accountNumber = String(data.receiverAccountNumber || "");
  return {
    configured: Boolean(accountNumber),
    accountType,
    accountTypeLabel: accountType,
    accountName: accountNameTH || accountNameEN,
    accountNameTH,
    accountNameEN,
    accountNumber,
  };
}

function slipVerificationBase(provider, expectedAmount) {
  return {
    provider,
    expectedAmount: money(expectedAmount),
    checkedAt: new Date().toISOString(),
    referenceId: null,
    transRef: null,
    detectedAmount: null,
    amountMatched: null,
    fallbackAllowed: false,
  };
}

const VISION_MONEY_PATTERN = /(?:฿\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;
const VISION_AMOUNT_HINT = /(?:จำนวน|ยอด(?:เงิน|โอน|ชำระ|สุทธิ)?|amount|transfer(?:red)?\s*amount|total\s*amount)/i;
const VISION_FEE_HINT = /(?:ค่าธรรมเนียม|fee|fees|service\s*charge)/i;
const VISION_DATE_HINT = /(?:วันที่|date|เวลา|time|พ\.?ศ\.?|ค\.?ศ\.?|a\.?m\.?|p\.?m\.?|น\.)/i;
const VISION_REFERENCE_HINT = /(?:เลขที่รายการ|เลขอ้างอิง|reference|ref\.?|transaction|บัญชี|account)/i;

function visionMoneyValues(line = "") {
  const values = [];
  VISION_MONEY_PATTERN.lastIndex = 0;
  for (const match of String(line || "").matchAll(VISION_MONEY_PATTERN)) {
    const raw = (String(match[1] || "") + (match[2] ? "." + match[2] : "")).replace(/,/g, "");
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0 && value <= 10000000) values.push(money(value));
  }
  return values;
}

function detectVisionAmount(text = "") {
  const lines = String(text || "").normalize("NFC").replace(/\u0e4d\u0e32/g, "\u0e33")
    .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const ranked = [];
  lines.forEach((line, index) => {
    const values = visionMoneyValues(line);
    if (!values.length) return;
    let score = 0;
    if (VISION_AMOUNT_HINT.test(line)) score += 120;
    if (/บาท|thb|฿/i.test(line)) score += 35;
    if (/\b\d{1,3}(?:,\d{3})+\.\d{2}\b/.test(line)) score += 75;
    else if (/^\s*(?:฿\s*)?\d+\.\d{2}\s*(?:บาท|thb)?\s*$/i.test(line)) score += 45;
    if (VISION_FEE_HINT.test(line)) score -= 180;
    if (VISION_DATE_HINT.test(line)) score -= 100;
    if (VISION_REFERENCE_HINT.test(line)) score -= 90;
    if (/\d{1,2}[:.]\d{2}/.test(line) && !/,\d{3}\.\d{2}/.test(line)) score -= 60;
    values.forEach(value => ranked.push({ value, score, line: line.slice(0, 250), index }));
  });
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!VISION_AMOUNT_HINT.test(lines[index]) || VISION_FEE_HINT.test(lines[index])) continue;
    for (const value of visionMoneyValues(lines[index + 1])) {
      ranked.push({ value, score: 115, line: (lines[index] + " " + lines[index + 1]).slice(0, 250), index });
    }
  }
  ranked.sort((a, b) => b.score - a.score || b.value - a.value || a.index - b.index);
  const best = ranked.find(candidate => candidate.score > 0) || null;
  return { amount: best?.value ?? null, ranked: ranked.slice(0, 20) };
}

async function inspectGoogleVisionTopupSlip(buffer, mime, expectedAmount) {
  const base = {
    provider: "google_vision",
    expectedAmount: money(expectedAmount),
    checkedAt: new Date().toISOString(),
    parserVersion: 4,
  };
  const snapshot = await getFirestore().collection("platformPrivateSettings").doc("googleApis").get();
  const apiKey = String(snapshot.data()?.visionApiKey || "").trim();
  if (!apiKey) return { ...base, status: "config_required", reason: "google_api_key_required", detectedAmount: null, textExcerpt: "" };
  if (!String(mime || "").startsWith("image/")) {
    return { ...base, status: "manual_review", reason: "pdf_requires_manual_review", detectedAmount: null, textExcerpt: "" };
  }
  try {
    const response = await fetch("https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: buffer.toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["th", "en"] },
        }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if ([400, 401, 403].includes(response.status)) {
      return { ...base, status: "config_invalid", reason: "google_api_key_invalid", detectedAmount: null, textExcerpt: "" };
    }
    if (!response.ok) throw new Error("VISION_HTTP_" + response.status);
    const payload = await response.json();
    const result = payload?.responses?.[0] || {};
    if (result.error) {
      const code = Number(result.error.code || 0);
      if ([400, 401, 403].includes(code)) {
        return { ...base, status: "config_invalid", reason: "google_api_key_invalid", detectedAmount: null, textExcerpt: "" };
      }
      throw new Error(String(result.error.message || "VISION_API_ERROR"));
    }
    const text = String(result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || "").trim();
    if (!text) return { ...base, status: "unreadable", reason: "no_text_detected", detectedAmount: null, textExcerpt: "" };
    const detection = detectVisionAmount(text);
    const detectedAmount = detection.amount;
    const amountMatched = detectedAmount !== null && Math.abs(detectedAmount - money(expectedAmount)) <= 0.05;
    return {
      ...base,
      status: detectedAmount === null ? "unreadable" : (amountMatched ? "matched" : "mismatch"),
      reason: detectedAmount === null ? "no_amount_detected" : (amountMatched ? "amount_matched" : "amount_not_matched"),
      detectedAmount,
      amountMatched,
      amountEvidence: detection.ranked.slice(0, 8),
      textExcerpt: text.slice(0, 4000),
    };
  } catch (error) {
    console.warn("FOD_WALLET_VISION_OCR_FAILED", error?.message || error);
    return { ...base, status: "manual_review", reason: "vision_error", detectedAmount: null, textExcerpt: "" };
  }
}

function slipFallbackResult(primary, fallback, expectedAmount) {
  return {
    provider: "slip2go_fallback_vision",
    status: "manual_review",
    reason: "slip2go_fallback_vision",
    expectedAmount: money(expectedAmount),
    detectedAmount: fallback?.detectedAmount ?? null,
    amountMatched: fallback?.amountMatched ?? null,
    checkedAt: new Date().toISOString(),
    referenceId: primary?.referenceId ?? null,
    transRef: primary?.transRef ?? null,
    fallbackAllowed: false,
    primary,
    fallback,
  };
}

async function inspectTopupSlip(buffer, mime, filename, expectedAmount) {
  const snapshot = await getFirestore().collection("platformPrivateSettings").doc("slipVerification").get();
  const settings = snapshot.data() || {};
  const provider = ["google_vision", "slip2go", "slip2go_fallback_vision"].includes(settings.provider)
    ? settings.provider : "google_vision";
  if (provider === "google_vision") {
    return inspectGoogleVisionTopupSlip(buffer, mime, expectedAmount);
  }
  const apiUrl = String(settings.slip2GoApiUrl || "").replace(/\/$/, "");
  const secret = String(settings.slip2GoSecret || "");
  const receiver = {
    accountType: String(settings.receiverAccountType || ""),
    accountNameTH: String(settings.receiverNameTh || ""),
    accountNameEN: String(settings.receiverNameEn || ""),
    accountNumber: String(settings.receiverAccountNumber || ""),
  };
  const receiverReady = Boolean(receiver.accountNumber || receiver.accountNameTH || receiver.accountNameEN);
  const base = slipVerificationBase("slip2go", expectedAmount);
  if (!apiUrl || !secret || !receiverReady) {
    const result = { ...base, status: "config_required", reason: "slip2go_config_required", fallbackAllowed: true };
    if (provider === "slip2go_fallback_vision") {
      return slipFallbackResult(result, await inspectGoogleVisionTopupSlip(buffer, mime, expectedAmount), expectedAmount);
    }
    return result;
  }
  if (!String(mime || "").startsWith("image/")) {
    const result = { ...base, status: "manual_review", reason: "slip2go_image_required", fallbackAllowed: true };
    if (provider === "slip2go_fallback_vision") {
      return slipFallbackResult(result, await inspectGoogleVisionTopupSlip(buffer, mime, expectedAmount), expectedAmount);
    }
    return result;
  }
  const payload = {
    checkDuplicate: true,
    checkAmount: { type: "eq", amount: money(expectedAmount).toFixed(2) },
    checkReceiver: [Object.fromEntries(Object.entries(receiver).filter(([, value]) => value))],
  };
  try {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mime }), filename || "slip.jpg");
    form.append("payload", JSON.stringify(payload));
    const response = await fetch(`${apiUrl}/api/verify-slip/qr-image/info`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${secret}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json().catch(() => ({}));
    const code = String(body?.code || "");
    const data = body?.data && typeof body.data === "object" ? body.data : {};
    const detectedAmount = Number.isFinite(Number(data.amount)) ? money(data.amount) : null;
    const details = {
      code,
      message: String(body?.message || "").slice(0, 500),
      referenceId: String(data.referenceId || "") || null,
      transRef: String(data.transRef || "") || null,
      detectedAmount,
      amountMatched: detectedAmount !== null ? Math.abs(detectedAmount - money(expectedAmount)) <= 0.01 : null,
    };
    if (code === "200200") return { ...base, ...details, status: "matched", reason: "slip2go_verified" };
    const mapped = {
      "200401": ["receiver_mismatch", "slip2go_receiver_mismatch", false],
      "200402": ["mismatch", "amount_not_matched", false],
      "200403": ["manual_review", "slip2go_date_mismatch", false],
      "200404": ["invalid", "slip2go_not_found", false],
      "200500": ["invalid", "slip2go_fraud", false],
      "200501": ["duplicate", "slip2go_duplicate", false],
      "200502": ["manual_review", "slip2go_bank_error", true],
      "401001": ["config_invalid", "slip2go_config_invalid", true],
      "401002": ["config_invalid", "slip2go_config_invalid", true],
      "401003": ["config_invalid", "slip2go_config_invalid", true],
      "401004": ["config_invalid", "slip2go_config_invalid", true],
      "401007": ["config_invalid", "slip2go_config_invalid", true],
      "401005": ["manual_review", "slip2go_quota_exhausted", true],
      "401006": ["manual_review", "slip2go_quota_exhausted", true],
      "429000": ["manual_review", "slip2go_rate_limited", true],
    }[code] || ["manual_review", "slip2go_error", true];
    const result = { ...base, ...details, status: mapped[0], reason: mapped[1], fallbackAllowed: mapped[2] };
    if (provider === "slip2go_fallback_vision" && result.fallbackAllowed) {
      return slipFallbackResult(result, await inspectGoogleVisionTopupSlip(buffer, mime, expectedAmount), expectedAmount);
    }
    return result;
  } catch (error) {
    console.warn("SLIP2GO_TOPUP_VERIFY_FAILED", error?.message || error);
    const result = { ...base, status: "manual_review", reason: "slip2go_unavailable", fallbackAllowed: true };
    return provider === "slip2go_fallback_vision"
      ? slipFallbackResult(result, await inspectGoogleVisionTopupSlip(buffer, mime, expectedAmount), expectedAmount)
      : result;
  }
}

function transactionPayload(doc) {
  const row = doc.data() || {};
  return {
    id: doc.id,
    type: String(row.type || "adjustment"),
    direction: String(row.direction || "credit"),
    amount: money(row.amount),
    balanceBefore: money(row.balanceBefore),
    balanceAfter: money(row.balanceAfter),
    currency: String(row.currency || "THB"),
    orderId: String(row.orderId || ""),
    lalamoveOrderId: String(row.lalamoveOrderId || ""),
    quotationId: String(row.quotationId || ""),
    reference: String(row.reference || ""),
    note: String(row.note || ""),
    createdAt: dateValue(row.createdAt),
  };
}

function topupPayload(doc) {
  const row = doc.data() || {};
  return {
    id: doc.id,
    amount: money(row.amount),
    currency: String(row.currency || "THB"),
    paymentChannel: String(row.paymentChannel || ""),
    destination: row.destination && typeof row.destination === "object" ? row.destination : {},
    status: String(row.status || "pending"),
    verificationProvider: String(row.verificationProvider || ""),
    verificationStatus: String(row.verificationStatus || ""),
    slip2GoReferenceId: String(row.slip2GoReferenceId || ""),
    slip2GoTransRef: String(row.slip2GoTransRef || ""),
    walletTransactionId: String(row.walletTransactionId || ""),
    reviewNote: String(row.reviewNote || ""),
    submittedAt: dateValue(row.createdAt || row.submittedAt),
    reviewedAt: dateValue(row.reviewedAt),
    ocr: row.ocr && typeof row.ocr === "object" ? row.ocr : null,
    slip: row.slip && typeof row.slip === "object" ? row.slip : {},
  };
}

async function walletSummary(ref, transactionLimit = 50, topupLimit = 50) {
  const [walletSnapshot, transactionsSnapshot, topupsSnapshot, lalamoveSnapshot, ready, destination, tenantStatus] = await Promise.all([
    ref.collection("settings").doc("lalamoveWallet").get(),
    ref.collection("lalamoveWalletTransactions").orderBy("createdAt", "desc").limit(transactionLimit).get(),
    ref.collection("lalamoveWalletTopups").orderBy("createdAt", "desc").limit(topupLimit).get(),
    ref.collection("settings").doc("lalamove").get(),
    platformReady(),
    slipDestination(),
    tenantLalamoveStatus(ref),
  ]);
  const wallet = walletSnapshot.data() || {};
  const topups = topupsSnapshot.docs.map(topupPayload);
  const account = accountStatus(lalamoveSnapshot.data() || {}, ready);
  const topupAllowed = tenantStatus.accountMode === "fod_central" && tenantStatus.fodCentralApproved === true;
  return {
    storageReady: true,
    balance: money(wallet.balance),
    currency: String(wallet.currency || "THB"),
    creditPolicy: { unit: "credit", thbPerCredit: 1, creditsPerThb: 1, cashOutAllowed: false },
    transactions: transactionsSnapshot.docs.map(transactionPayload),
    topups,
    topup: {
      storageReady: true,
      allowed: topupAllowed,
      destination,
      items: topups,
    },
    ...account,
  };
}

exports.updateTenantLalamoveApproval = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const ref = await tenantRef(request.data?.tenantId);
  const approved = request.data?.approved === true;
  await ref.collection("settings").doc("lalamove").set({
    fodCentralApproved: approved,
    fodCentralApprovedBy: request.auth.uid,
    fodCentralApprovedByEmail: request.auth.token?.email || "",
    fodCentralApprovedAt: approved ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const snapshot = await ref.collection("settings").doc("lalamove").get();
  return { ok: true, item: accountStatus(snapshot.data() || {}, await platformReady()) };
});

exports.getTenantLalamoveWallet = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const ref = await tenantRef(request.data?.tenantId);
  return { item: await walletSummary(ref) };
});

exports.reviewTenantLalamoveWalletTopup = onCall({ region: REGION }, async request => {
  await assertSuperAdmin(request.auth);
  const tenantId = String(request.data?.tenantId || "").trim();
  const topupId = String(request.data?.topupId || "").trim();
  const action = String(request.data?.action || "").trim().toLowerCase();
  const note = String(request.data?.note || "").trim().slice(0, 1000);
  if (!tenantId || !topupId) throw new HttpsError("invalid-argument", "Top-up reference is required");
  if (!["approve", "reject"].includes(action)) throw new HttpsError("invalid-argument", "FOD_WALLET_TOPUP_REVIEW_ACTION_INVALID");
  if (action === "reject" && !note) throw new HttpsError("invalid-argument", "FOD_WALLET_TOPUP_REVIEW_NOTE_REQUIRED");

  const ref = await tenantRef(tenantId);
  const db = getFirestore();
  const topupRef = ref.collection("lalamoveWalletTopups").doc(topupId);
  const walletRef = ref.collection("settings").doc("lalamoveWallet");

  const result = await db.runTransaction(async transaction => {
    const topupSnapshot = await transaction.get(topupRef);
    if (!topupSnapshot.exists) throw new HttpsError("not-found", "FOD_WALLET_TOPUP_NOT_FOUND");
    const topup = topupSnapshot.data() || {};
    if (String(topup.status || "pending") !== "pending") {
      throw new HttpsError("already-exists", "FOD_WALLET_TOPUP_ALREADY_REVIEWED");
    }

    let walletTransactionId = "";
    if (action === "approve") {
      const amount = money(topup.amount);
      if (!(amount > 0)) throw new HttpsError("failed-precondition", "FOD_WALLET_AMOUNT_INVALID");
      const walletSnapshot = await transaction.get(walletRef);
      const before = money(walletSnapshot.data()?.balance);
      const after = money(before + amount);
      walletTransactionId = randomUUID();
      const ledgerRef = ref.collection("lalamoveWalletTransactions").doc(walletTransactionId);
      transaction.set(walletRef, {
        balance: after,
        currency: "THB",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(ledgerRef, {
        type: "topup",
        direction: "credit",
        amount,
        balanceBefore: before,
        balanceAfter: after,
        currency: "THB",
        reference: `TOPUP:${topupId}`,
        note: note || "Approved LUKKAJA Wallet top-up",
        metadata: { topupId },
        createdBy: request.auth.uid,
        createdByEmail: request.auth.token?.email || "",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.set(topupRef, {
      status: action === "approve" ? "approved" : "rejected",
      walletTransactionId: walletTransactionId || null,
      reviewedBy: request.auth.uid,
      reviewedByEmail: request.auth.token?.email || "",
      reviewedAt: FieldValue.serverTimestamp(),
      reviewNote: note || null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { walletTransactionId };
  });

  return {
    ok: true,
    walletTransactionId: result.walletTransactionId,
    item: await walletSummary(ref, 20, 50),
  };
});


function cleanCredential(value, max = 512) {
  const text = String(value || "").trim();
  if (text.length > max) throw new HttpsError("invalid-argument", "LALAMOVE_CREDENTIAL_TOO_LONG");
  return text;
}

function topupDedupeRef(db, type, value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const digest = type === "hash" ? raw : createHash("sha256").update(raw).digest("hex");
  return db.collection("lalamoveWalletTopupDedupe").doc(`${type}_${digest}`);
}

function topupDedupeRefs(db, { sha256 = "", referenceId = "", transRef = "" } = {}) {
  return [
    topupDedupeRef(db, "hash", sha256),
    topupDedupeRef(db, "reference", referenceId),
    topupDedupeRef(db, "trans", transRef),
  ].filter(Boolean);
}

async function deleteStoragePath(path) {
  const value = String(path || "").trim();
  if (!value) return;
  try {
    await getStorage().bucket().file(value).delete({ ignoreNotFound: true });
  } catch (error) {
    console.warn("LALAMOVE_TOPUP_STORAGE_DELETE_FAILED", value, error?.message || error);
  }
}

exports.getTenantLalamoveSettings = onCall({ region: REGION }, async request => {
  const profile = await assertTenantAdmin(request.auth);
  const ref = await tenantRef(profile.tenantId);
  return { item: await tenantLalamoveStatus(ref) };
});

exports.updateTenantLalamoveSettings = onCall({ region: REGION }, async request => {
  const profile = await assertTenantAdmin(request.auth);
  const ref = await tenantRef(profile.tenantId);
  const data = request.data || {};
  const requestedMode = String(data.accountMode || "").trim().toLowerCase();
  if (!["disabled", "tenant", "fod_central"].includes(requestedMode)) {
    throw new HttpsError("invalid-argument", "TENANT_LALAMOVE_ACCOUNT_MODE_INVALID");
  }
  const mode = requestedMode === "tenant" ? "partner" : requestedMode;
  const environment = data.environment === "production" ? "production"
    : data.environment === "sandbox" ? "sandbox" : "sandbox";
  const privateRef = ref.collection("privateSettings").doc("lalamove");
  const publicRef = ref.collection("settings").doc("lalamove");
  const [privateSnapshot, publicSnapshot] = await Promise.all([privateRef.get(), publicRef.get()]);
  const currentPrivate = privateSnapshot.data() || {};
  const currentPublic = publicSnapshot.data() || {};
  const incomingKey = cleanCredential(data.apiKey);
  const incomingSecret = cleanCredential(data.apiSecret);
  const nextKey = data.clearApiKey === true ? "" : (incomingKey || String(currentPrivate.apiKey || ""));
  const nextSecret = data.clearApiSecret === true ? "" : (incomingSecret || String(currentPrivate.apiSecret || ""));
  const currentEnvironment = currentPrivate.environment === "production" ? "production" : "sandbox";
  const changed = environment !== currentEnvironment
    || nextKey !== String(currentPrivate.apiKey || "")
    || nextSecret !== String(currentPrivate.apiSecret || "");
  const now = FieldValue.serverTimestamp();
  const batch = getFirestore().batch();
  batch.set(privateRef, {
    environment,
    apiKey: nextKey,
    apiSecret: nextSecret,
    ...(changed ? { connectionVerifiedAt: null } : {}),
    updatedBy: profile.uid,
    updatedByEmail: profile.email || request.auth.token?.email || "",
    updatedAt: now,
  }, { merge: true });
  batch.set(publicRef, {
    accountMode: mode,
    ...(changed ? { tenantConnectionVerifiedAt: null } : {}),
    tenantEnvironment: environment,
    tenantApiKeyConfigured: Boolean(nextKey),
    tenantApiKeyMasked: mask(nextKey),
    tenantApiSecretConfigured: Boolean(nextSecret),
    tenantApiSecretMasked: mask(nextSecret),
    updatedBy: profile.uid,
    updatedByEmail: profile.email || request.auth.token?.email || "",
    updatedAt: now,
    ...(Object.prototype.hasOwnProperty.call(currentPublic, "fodCentralApproved")
      ? {} : { fodCentralApproved: false }),
  }, { merge: true });
  await batch.commit();
  return { item: await tenantLalamoveStatus(ref) };
});

exports.testTenantLalamoveConnection = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const profile = await assertTenantAdmin(request.auth);
  const ref = await tenantRef(profile.tenantId);
  const publicRef = ref.collection("settings").doc("lalamove");
  const privateRef = ref.collection("privateSettings").doc("lalamove");
  const [publicSnapshot, privateSnapshot] = await Promise.all([publicRef.get(), privateRef.get()]);
  const publicData = publicSnapshot.data() || {};
  const privateData = privateSnapshot.data() || {};
  if (String(publicData.accountMode || "") !== "partner") {
    throw new HttpsError("failed-precondition", "TENANT_LALAMOVE_ACCOUNT_MODE_REQUIRED");
  }
  const environment = privateData.environment === "production" ? "production" : "sandbox";
  const apiKey = String(privateData.apiKey || "");
  const apiSecret = String(privateData.apiSecret || "");
  if (!lalamovePrefixesValid(environment, apiKey, apiSecret)) {
    const batch = getFirestore().batch();
    batch.set(privateRef, { connectionVerifiedAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.set(publicRef, { tenantConnectionVerifiedAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
    throw new HttpsError("failed-precondition", "LALAMOVE_CREDENTIAL_PREFIX_MISMATCH");
  }
  const result = await lalamoveRequest({ environment, apiKey, apiSecret });
  if (!result.ok) {
    const batch = getFirestore().batch();
    batch.set(privateRef, { connectionVerifiedAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.set(publicRef, { tenantConnectionVerifiedAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
    throw new HttpsError("unavailable", result.message || "LALAMOVE_CONNECTION_FAILED", {
      providerStatus: result.status,
      requestId: result.requestId,
    });
  }
  const verifiedAt = new Date();
  const batch = getFirestore().batch();
  batch.set(privateRef, {
    connectionVerifiedAt: verifiedAt,
    updatedBy: profile.uid,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(publicRef, {
    tenantConnectionVerifiedAt: verifiedAt,
    updatedBy: profile.uid,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return { ok: true, requestId: result.requestId, item: await tenantLalamoveStatus(ref) };
});

exports.getOwnTenantLalamoveWallet = onCall({ region: REGION }, async request => {
  const profile = await assertTenantAdmin(request.auth);
  const ref = await tenantRef(profile.tenantId);
  return { item: await walletSummary(ref, 20, 50) };
});


exports.submitTenantLalamoveWalletTopup = onCall({ region: REGION, timeoutSeconds: 60, memory: "512MiB" }, async request => {
  const profile = await assertTenantAdmin(request.auth);
  const tenantId = profile.tenantId;
  const ref = await tenantRef(tenantId);
  const account = await tenantLalamoveStatus(ref);
  if (account.accountMode !== "fod_central" || account.fodCentralApproved !== true) {
    throw new HttpsError("permission-denied", "FOD_WALLET_TOPUP_NOT_ALLOWED");
  }
  const destination = await slipDestination();
  if (!destination.configured) {
    throw new HttpsError("failed-precondition", "FOD_WALLET_TOPUP_DESTINATION_REQUIRED");
  }

  const amount = money(request.data?.amount);
  const topupId = String(request.data?.topupId || "").trim();
  const storagePath = String(request.data?.storagePath || "").trim();
  const slipName = String(request.data?.slipName || "").trim().slice(0, 255);
  if (!(amount >= 1 && amount <= 1000000) || !/^[A-Za-z0-9_-]{8,128}$/.test(topupId)) {
    throw new HttpsError("invalid-argument", "FOD_WALLET_TOPUP_INVALID");
  }
  const prefix = `tenants/${tenantId}/lalamove-wallet-topups/${topupId}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) {
    throw new HttpsError("invalid-argument", "FOD_WALLET_TOPUP_SLIP_PATH_INVALID");
  }

  const storageFile = getStorage().bucket().file(storagePath);
  let metadata;
  try {
    [metadata] = await storageFile.getMetadata();
  } catch (error) {
    console.warn("FOD_WALLET_TOPUP_SLIP_METADATA_FAILED", storagePath, error?.message || error);
    throw new HttpsError("not-found", "FOD_WALLET_TOPUP_SLIP_NOT_FOUND");
  }
  const size = Number(metadata?.size || 0);
  const mime = String(metadata?.contentType || request.data?.slipMime || "").toLowerCase();
  const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  if (!(size > 0 && size <= 10 * 1024 * 1024) || !allowedMime.has(mime)) {
    await deleteStoragePath(storagePath);
    throw new HttpsError("invalid-argument", "FOD_WALLET_TOPUP_SLIP_INVALID");
  }

  const [buffer] = await storageFile.download();
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const db = getFirestore();
  const hashRef = topupDedupeRef(db, "hash", sha256);
  if ((await hashRef.get()).exists) {
    await deleteStoragePath(storagePath);
    throw new HttpsError("already-exists", "FOD_WALLET_TOPUP_DUPLICATE_SLIP");
  }

  const verification = await inspectTopupSlip(buffer, mime, slipName || storagePath.split("/").pop(), amount);
  if (verification.status === "config_required") {
    await deleteStoragePath(storagePath);
    throw new HttpsError("failed-precondition", "SLIP2GO_CONFIG_REQUIRED");
  }
  if (verification.status === "config_invalid") {
    await deleteStoragePath(storagePath);
    throw new HttpsError("failed-precondition", "SLIP2GO_CONFIG_INVALID");
  }
  if (verification.status === "duplicate") {
    await deleteStoragePath(storagePath);
    throw new HttpsError("already-exists", "FOD_WALLET_TOPUP_DUPLICATE_SLIP");
  }

  const referenceId = String(verification.referenceId || "");
  const transRef = String(verification.transRef || "");
  const autoApproved = verification.provider === "slip2go"
    && verification.status === "matched"
    && verification.amountMatched === true
    && Boolean(referenceId || transRef);

  const topupRef = ref.collection("lalamoveWalletTopups").doc(topupId);
  const walletRef = ref.collection("settings").doc("lalamoveWallet");
  const ledgerId = autoApproved ? randomUUID() : "";
  const ledgerRef = ledgerId ? ref.collection("lalamoveWalletTransactions").doc(ledgerId) : null;
  const dedupeRefs = topupDedupeRefs(db, { sha256, referenceId, transRef });

  try {
    await db.runTransaction(async transaction => {
      const refsToRead = [topupRef, ...dedupeRefs, ...(autoApproved ? [walletRef] : [])];
      const snapshots = [];
      for (const documentRef of refsToRead) snapshots.push(await transaction.get(documentRef));
      if (snapshots[0].exists) throw new HttpsError("already-exists", "FOD_WALLET_TOPUP_ALREADY_EXISTS");
      for (let index = 1; index <= dedupeRefs.length; index += 1) {
        if (snapshots[index]?.exists) throw new HttpsError("already-exists", "FOD_WALLET_TOPUP_DUPLICATE_SLIP");
      }

      let balanceBefore = 0;
      let balanceAfter = 0;
      if (autoApproved) {
        const walletSnapshot = snapshots[snapshots.length - 1];
        balanceBefore = money(walletSnapshot?.data()?.balance);
        balanceAfter = money(balanceBefore + amount);
        transaction.set(walletRef, {
          balance: balanceAfter,
          currency: "THB",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(ledgerRef, {
          type: "topup",
          direction: "credit",
          amount,
          balanceBefore,
          balanceAfter,
          currency: "THB",
          reference: `TOPUP:${topupId}`,
          note: "Auto-approved by Slip2Go",
          metadata: {
            topupId,
            verificationProvider: verification.provider,
            verificationStatus: verification.status,
            referenceId,
            transRef,
          },
          createdBy: "system:slip2go",
          createdByEmail: "",
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.set(topupRef, {
        amount,
        currency: "THB",
        paymentChannel: destination.accountType || "",
        destination: {
          accountType: destination.accountType || "",
          accountName: destination.accountName || "",
          accountNumber: destination.accountNumber || "",
        },
        status: autoApproved ? "approved" : "pending",
        verificationProvider: String(verification.provider || ""),
        verificationStatus: String(verification.status || "manual_review"),
        slip2GoReferenceId: referenceId,
        slip2GoTransRef: transRef,
        walletTransactionId: ledgerId || "",
        reviewNote: autoApproved ? "Auto-approved by Slip2Go" : "",
        reviewedBy: autoApproved ? "system:slip2go" : "",
        reviewedAt: autoApproved ? FieldValue.serverTimestamp() : null,
        ocr: verification,
        slipSha256: sha256,
        slip: {
          path: storagePath,
          name: slipName || storagePath.split("/").pop(),
          mime,
          size,
          sha256,
        },
        submittedBy: profile.uid,
        submittedByEmail: profile.email || request.auth.token?.email || "",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      dedupeRefs.forEach(documentRef => transaction.set(documentRef, {
        tenantId,
        topupId,
        storagePath,
        createdAt: FieldValue.serverTimestamp(),
      }));
    });
  } catch (error) {
    await deleteStoragePath(storagePath);
    throw error;
  }

  const snapshot = await topupRef.get();
  return {
    ok: true,
    autoApproved,
    item: topupPayload(snapshot),
    wallet: await walletSummary(ref, 20, 50),
  };
});

exports.deleteTenantLalamoveWalletTopup = onCall({ region: REGION }, async request => {
  const profile = await assertTenantAdmin(request.auth);
  const ref = await tenantRef(profile.tenantId);
  const topupId = String(request.data?.topupId || "").trim();
  if (!topupId) throw new HttpsError("invalid-argument", "FOD_WALLET_TOPUP_REFERENCE_REQUIRED");
  const topupRef = ref.collection("lalamoveWalletTopups").doc(topupId);
  const snapshot = await topupRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "FOD_WALLET_TOPUP_NOT_FOUND");
  const row = snapshot.data() || {};
  if (String(row.status || "pending") !== "pending") {
    throw new HttpsError("failed-precondition", "FOD_WALLET_TOPUP_ALREADY_REVIEWED");
  }
  const db = getFirestore();
  const dedupeRefs = topupDedupeRefs(db, {
    sha256: row.slipSha256 || row.slip?.sha256 || "",
    referenceId: row.slip2GoReferenceId || "",
    transRef: row.slip2GoTransRef || "",
  });
  const batch = db.batch();
  batch.delete(topupRef);
  dedupeRefs.forEach(documentRef => batch.delete(documentRef));
  await batch.commit();
  await deleteStoragePath(row.slip?.path || "");
  return { ok: true, topupId, wallet: await walletSummary(ref, 20, 50) };
});
