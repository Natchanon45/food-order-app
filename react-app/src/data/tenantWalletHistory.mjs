// Canonical Firebase Lalamove Wallet history is never the separate Stripe TEST ledger.
// A successful Callable reply alone is NOT independent evidence of a posted credit.
export function validateWalletHistory(item) {
  if (!item || item.storageReady !== true ||
      item.topupHistoryOrigin !== "firebase_real_wallet_only" ||
      !Array.isArray(item.topupHistory) || !Array.isArray(item.topups) ||
      !Array.isArray(item.transactions) || !Number.isFinite(Number(item.balance))) {
    throw Error("WALLET_HISTORY_CANONICAL_READ_INVALID");
  }
  const byId = new Map(item.topups.map(row => [String(row.id), row]));
  if (byId.size !== item.topups.length ||
      item.topupHistory.length !== item.topups.length) {
    throw Error("WALLET_HISTORY_CANONICAL_INCOMPLETE");
  }
  const seen = new Set();
  for (const history of item.topupHistory) {
    const id = String(history?.id || "");
    const raw = byId.get(id);
    if (!id || !raw || seen.has(id) || history.referenceId !== id ||
        !Number.isSafeInteger(history.amountSatang) ||
        history.amountSatang < 0 ||
        history.amountSatang !== Math.round(Number(raw.amount) * 100) ||
        !["slip_transfer","bank_transfer","unknown"].includes(history.provider) ||
        !["pending","approved","rejected","under_review"].includes(history.status) ||
        typeof history.reviewable !== "boolean" ||
        typeof history.rejectable !== "boolean" ||
        history.postedToRealWallet !== true && history.status === "approved" ||
        history.reviewable && (history.status !== "pending" || history.bankEvidenceRequired) ||
        history.rejectable && history.status !== "pending") {
      throw Error("WALLET_HISTORY_CANONICAL_ROW_INVALID");
    }
    seen.add(id);
  }
  return item;
}

export function verifyWalletReviewReadback(item, topupId, action) {
  const canonical = validateWalletHistory(item);
  const row = canonical.topupHistory.find(entry => entry.id === topupId);
  const raw = canonical.topups.find(entry => entry.id === topupId);
  if (!row || !raw) throw Error("WALLET_REVIEW_WRITE_UNCONFIRMED");
  if (action === "approve") {
    const ledger = canonical.transactions.find(tx =>
      tx.id === raw.walletTransactionId &&
      tx.reference === "TOPUP:" + topupId &&
      tx.type === "topup" && tx.direction === "credit" &&
      Math.round(Number(tx.amount) * 100) === row.amountSatang);
    if (row.status !== "approved" || row.postedToRealWallet !== true ||
        raw.status !== "approved" || !raw.walletTransactionId || !ledger)
      throw Error("WALLET_REVIEW_WRITE_UNCONFIRMED");
  } else if (action === "reject") {
    if (row.status !== "rejected" || raw.status !== "rejected" ||
        raw.walletTransactionId)
      throw Error("WALLET_REVIEW_WRITE_UNCONFIRMED");
  } else throw Error("WALLET_REVIEW_ACTION_INVALID");
  return canonical;
}
