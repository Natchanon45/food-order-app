// A Lalamove quotation lasts only five minutes. A PromptPay customer may
// spend longer scanning and paying; before submission, try an authoritative
// server-side re-quote without changing the amount the customer already paid.
const QUOTE_REFRESH_BUFFER_MS = 90 * 1000;

export function lalamoveQuoteNeedsRefresh(quote, now = Date.now()) {
  const expiry = Date.parse(String(quote?.expiresAt || ""));
  return !quote?.quotationId || !Number.isFinite(expiry) || expiry <= now + QUOTE_REFRESH_BUFFER_MS;
}

export function lalamoveQuoteMatchesPayment(quote, originalFee, now = Date.now()) {
  const expiry = Date.parse(String(quote?.expiresAt || ""));
  const quotedFee = Number(quote?.fee);
  const lockedFee = Number(originalFee);
  return Boolean(
    quote?.quotationId
    && Number.isFinite(expiry) && expiry > now + 30 * 1000
    && Number.isFinite(quotedFee) && quotedFee >= 0
    && Number.isFinite(lockedFee) && lockedFee >= 0
    && Math.round(quotedFee * 100) === Math.round(lockedFee * 100)
    && String(quote?.currency || "THB").toUpperCase() === "THB"
  );
}

export async function refreshLalamoveCheckoutQuote({
  quote, lockedFee, requestQuote, request, now = Date.now(),
}) {
  if (!lalamoveQuoteNeedsRefresh(quote, now)) {
    return { quote, refreshed: false, reason: "still_valid" };
  }
  try {
    const response = await requestQuote(request);
    const newQuote = response?.data?.item || null;
    if (lalamoveQuoteMatchesPayment(newQuote, lockedFee, now)) {
      return { quote: newQuote, refreshed: true, reason: "refreshed" };
    }
    // Never silently change the QR amount once the customer has paid.
    // Keep the existing server-verifiable quote; if expired, the backend
    // safely sends this payment to cashier review rather than auto-approving.
    return { quote, refreshed: false, reason: "fee_changed_or_quote_invalid" };
  } catch {
    return { quote, refreshed: false, reason: "refresh_failed" };
  }
}
