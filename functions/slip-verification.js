const { getFirestore } = require("firebase-admin/firestore");

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function baseResult(provider, expectedAmount) {
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

const MONEY_PATTERN = /(?:฿\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/g;
const AMOUNT_HINT = /(?:จำนวน|ยอด(?:เงิน|โอน|ชำระ|สุทธิ)?|amount|transfer(?:red)?\s*amount|total\s*amount)/i;
const FEE_HINT = /(?:ค่าธรรมเนียม|fee|fees|service\s*charge)/i;
const DATE_HINT = /(?:วันที่|date|เวลา|time|พ\.?ศ\.?|ค\.?ศ\.?|a\.?m\.?|p\.?m\.?|น\.)/i;
const REFERENCE_HINT = /(?:เลขที่รายการ|เลขอ้างอิง|reference|ref\.?|transaction|บัญชี|account)/i;

function moneyValues(line = "") {
  const values = [];
  MONEY_PATTERN.lastIndex = 0;
  for (const match of String(line || "").matchAll(MONEY_PATTERN)) {
    const raw = (String(match[1] || "") + (match[2] ? "." + match[2] : "")).replace(/,/g, "");
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0 && value <= 10000000) values.push(money(value));
  }
  return values;
}

function detectAmount(text = "") {
  const lines = String(text || "").normalize("NFC").replace(/\u0e4d\u0e32/g, "\u0e33")
    .split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const ranked = [];
  lines.forEach((line, index) => {
    const values = moneyValues(line);
    if (!values.length) return;
    let score = 0;
    if (AMOUNT_HINT.test(line)) score += 120;
    if (/บาท|thb|฿/i.test(line)) score += 35;
    if (/\b\d{1,3}(?:,\d{3})+\.\d{2}\b/.test(line)) score += 75;
    else if (/^\s*(?:฿\s*)?\d+\.\d{2}\s*(?:บาท|thb)?\s*$/i.test(line)) score += 45;
    if (FEE_HINT.test(line)) score -= 180;
    if (DATE_HINT.test(line)) score -= 100;
    if (REFERENCE_HINT.test(line)) score -= 90;
    if (/\d{1,2}[:.]\d{2}/.test(line) && !/,\d{3}\.\d{2}/.test(line)) score -= 60;
    values.forEach(value => ranked.push({ value, score, line: line.slice(0, 250), index }));
  });
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!AMOUNT_HINT.test(lines[index]) || FEE_HINT.test(lines[index])) continue;
    for (const value of moneyValues(lines[index + 1])) {
      ranked.push({ value, score: 115, line: (lines[index] + " " + lines[index + 1]).slice(0, 250), index });
    }
  }
  ranked.sort((a, b) => b.score - a.score || b.value - a.value || a.index - b.index);
  const best = ranked.find(candidate => candidate.score > 0) || null;
  return { amount: best?.value ?? null, ranked: ranked.slice(0, 20) };
}

async function inspectGoogleVision(buffer, mime, expectedAmount) {
  const base = {
    provider: "google_vision",
    expectedAmount: money(expectedAmount),
    checkedAt: new Date().toISOString(),
    parserVersion: 4,
  };
  const snapshot = await getFirestore().collection("platformPrivateSettings").doc("googleApis").get();
  const apiKey = String(snapshot.data()?.visionApiKey || "").trim();
  if (!apiKey) {
    return { ...base, status: "config_required", reason: "google_api_key_required", detectedAmount: null, textExcerpt: "" };
  }
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
    if (!text) {
      return { ...base, status: "unreadable", reason: "no_text_detected", detectedAmount: null, textExcerpt: "" };
    }
    const detection = detectAmount(text);
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
    console.warn("SLIP_VERIFICATION_VISION_FAILED", error?.message || error);
    return { ...base, status: "manual_review", reason: "vision_error", detectedAmount: null, textExcerpt: "" };
  }
}

function fallbackResult(primary, fallback, expectedAmount) {
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

async function inspectSlip(buffer, mime, filename, expectedAmount, options = {}) {
  const snapshot = await getFirestore().collection("platformPrivateSettings").doc("slipVerification").get();
  const settings = snapshot.data() || {};
  const provider = options.providerOverride || (["google_vision", "slip2go", "slip2go_fallback_vision"].includes(settings.provider)
    ? settings.provider : "google_vision");
  if (provider === "google_vision") return inspectGoogleVision(buffer, mime, expectedAmount);

  const apiUrl = String(settings.slip2GoApiUrl || "").replace(/\/$/, "");
  const secret = String(settings.slip2GoSecret || "");
  const receiver = options.receiverOverride || {
    accountType: String(settings.receiverAccountType || ""),
    accountNameTH: String(settings.receiverNameTh || ""),
    accountNameEN: String(settings.receiverNameEn || ""),
    accountNumber: String(settings.receiverAccountNumber || ""),
  };
  const receiverReady = Boolean(receiver.accountNumber || receiver.accountNameTH || receiver.accountNameEN);
  const base = baseResult("slip2go", expectedAmount);

  if (!apiUrl || !secret || !receiverReady) {
    const result = { ...base, status: "config_required", reason: "slip2go_config_required", fallbackAllowed: true };
    return provider === "slip2go_fallback_vision"
      ? fallbackResult(result, await inspectGoogleVision(buffer, mime, expectedAmount), expectedAmount)
      : result;
  }
  if (!String(mime || "").startsWith("image/")) {
    const result = { ...base, status: "manual_review", reason: "slip2go_image_required", fallbackAllowed: true };
    return provider === "slip2go_fallback_vision"
      ? fallbackResult(result, await inspectGoogleVision(buffer, mime, expectedAmount), expectedAmount)
      : result;
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
      return fallbackResult(result, await inspectGoogleVision(buffer, mime, expectedAmount), expectedAmount);
    }
    return result;
  } catch (error) {
    console.warn("SLIP2GO_VERIFY_FAILED", error?.message || error);
    const result = { ...base, status: "manual_review", reason: "slip2go_unavailable", fallbackAllowed: true };
    return provider === "slip2go_fallback_vision"
      ? fallbackResult(result, await inspectGoogleVision(buffer, mime, expectedAmount), expectedAmount)
      : result;
  }
}

module.exports = { inspectSlip };
