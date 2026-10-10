// A receipt tab must be opened synchronously during the Cashier click to avoid
// popup blockers. Paint its waiting state immediately, before awaiting Firebase.
const LOADING_DOCUMENT = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#159447">
  <title>PENGUIN • Receipt</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; min-height: 100%; }
    body { min-height: 100vh; min-height: 100dvh; background: #f6f9f7; color: #173b28; }
    .receipt-print-loading {
      display: grid; min-height: 100vh; min-height: 100dvh; padding: 24px;
      place-items: center; background: radial-gradient(circle at 22% 16%, #e0f2e5, transparent 42%), #f6f9f7;
    }
    .receipt-print-loading-panel { width: min(440px, 100%); text-align: center; }
    .receipt-print-loading-brand { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 24px; font-weight: 800; letter-spacing: .03em; }
    .receipt-print-loading-mark {
      display: inline-grid; width: 42px; height: 42px; place-items: center;
      background: #159447; color: white; border-radius: 12px; font-size: 15px;
    }
    .receipt-print-loading-spinner {
      display: block; width: 48px; height: 48px; margin: 0 auto 20px;
      border: 4px solid #d6eadd; border-top-color: #159447; border-right-color: #159447;
      border-radius: 50%; animation: receipt-print-spin .85s linear infinite;
    }
    h1 { font-size: clamp(19px, 5vw, 23px); line-height: 1.35; margin: 0 0 9px; font-weight: 700; }
    p { color: #60776a; margin: 0; line-height: 1.65; font-size: 14px; overflow-wrap: anywhere; }
    @keyframes receipt-print-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .receipt-print-loading-spinner { animation-duration: 2.5s; } }
  </style>
</head>
<body>
  <main class="receipt-print-loading" role="status" aria-live="polite" aria-busy="true">
    <section class="receipt-print-loading-panel" aria-labelledby="receiptPrintLoadingTitle">
      <div class="receipt-print-loading-brand"><span class="receipt-print-loading-mark" aria-hidden="true">PG</span><span>PENGUIN</span></div>
      <span class="receipt-print-loading-spinner" aria-hidden="true"></span>
      <h1 id="receiptPrintLoadingTitle">กำลังดำเนินการ...</h1>
      <p id="receiptPrintLoadingMessage">กรุณารอสักครู่</p>
    </section>
  </main>
</body>
</html>`;

export function updateReceiptPrintLoading(printWindow, { title = "", message = "", language = "" } = {}) {
  if (!printWindow || printWindow.closed) return;
  try {
    const doc = printWindow.document;
    if (language) doc.documentElement.lang = String(language);
    const titleElement = doc.getElementById("receiptPrintLoadingTitle");
    const messageElement = doc.getElementById("receiptPrintLoadingMessage");
    if (titleElement && title) titleElement.textContent = String(title);
    if (messageElement && message) messageElement.textContent = String(message);
  } catch {
    // Navigation may have started or the customer may have closed the tab.
  }
}

export function openReceiptPrintLoading({ title, message, language } = {}, hostWindow = window) {
  const printWindow = hostWindow.open("", "_blank");
  if (!printWindow) return null;
  // Receipt tabs never need access back to the Cashier window.
  printWindow.opener = null;
  try {
    const doc = printWindow.document;
    doc.open();
    doc.write(LOADING_DOCUMENT);
    doc.close();
    updateReceiptPrintLoading(printWindow, { title, message, language });
  } catch (error) {
    console.error("CASHIER_RECEIPT_LOADING_FAILED", error);
    try { printWindow.close(); } catch {}
    return null; // Existing same-tab fallback avoids a white orphan tab.
  }
  return printWindow;
}
