import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { sweetConfirm } from "@/components/sweetDialog";
import {
  listPosCustomers, listPosProducts, listPosSales,
  loadPosLoyaltySettings, loadPosReceiptSettings, watchPosSales,
} from "@/data/retailPosData";
import {
  createPosReturnParity, listPosReturnsParity, watchPosReturnsParity,
} from "@/data/retailPosReturns";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const asDate = value => {
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(Number(value.seconds) * 1000);
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};
const today = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};
const saleNumberOf = sale => String(sale?.saleNumber || sale?.number || sale?.id || "");
const itemIdOf = item => String(item?.id || item?.productId || "");
const saleReturns = (history, saleId) => history.filter(row => String(row.saleId || "") === String(saleId || ""));
const returnedQty = (history, saleId, itemId) => saleReturns(history, saleId)
  .flatMap(row => row.items || [])
  .filter(row => String(row.productId || row.id || "") === String(itemId || ""))
  .reduce((sum, row) => sum + Number(row.qty || 0), 0);
const remainingQty = (history, sale, item) =>
  Math.max(0, Number(item?.qty || 0) - returnedQty(history, sale?.id, itemIdOf(item)));

function loyaltyPreview(sale, history, refundTotal, settings) {
  if (!sale?.customerId || !sale?.loyalty || refundTotal <= 0) return null;
  const originalEarned = Math.max(0, Math.floor(Number(sale.loyalty.pointsEarned || 0)));
  const originalUsed = Math.max(0, Math.floor(Number(sale.loyalty.pointsUsed || 0)));
  const saleTotal = Math.max(0, Number(sale.totalAmount ?? sale.total ?? 0));
  const prior = saleReturns(history, sale.id);
  const previousRefund = prior.reduce((sum, row) => sum + Number(row.refundTotal || 0), 0);
  const cumulativeRefund = Math.min(saleTotal, previousRefund + Number(refundTotal || 0));
  const remainingNet = Math.max(0, saleTotal - cumulativeRefund);
  const spendPerPoint = Math.max(0.01, Number(settings?.spendPerPoint || 10));
  const targetEarned = Math.min(
    originalEarned,
    Math.max(0, originalEarned - Math.floor(remainingNet / spendPerPoint)),
  );
  const deducted = prior.reduce((sum, row) => sum + Number(row?.loyaltyAdjustment?.pointsEarnedDeducted || 0), 0);
  const targetRestore = saleTotal <= 0 ? 0
    : cumulativeRefund >= saleTotal ? originalUsed
      : Math.floor(originalUsed * cumulativeRefund / saleTotal);
  const restored = prior.reduce((sum, row) => sum + Number(row?.loyaltyAdjustment?.pointsUsedRestored || 0), 0);
  return {
    pointsEarnedToDeduct: Math.max(0, targetEarned - deducted),
    pointsUsedToRestore: Math.max(0, targetRestore - restored),
  };
}
const loadZxing = () => {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-zxing="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.ZXing), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.zxing = "1";
    script.src = "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";
    script.onload = () => window.ZXing ? resolve(window.ZXing) : reject(new Error("ZXING_NOT_AVAILABLE"));
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

export function PosReturnsPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const tr = useCallback((key, replacements = {}) => t(`pos_returns.runtime.${key}`, replacements), [t]);
  const stylesReady = useParityPage({
    title: t("pos_returns.meta.title"),
    bodyClass: "pos-returns-page",
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css", "retail-pos-font-local.css", "sweet-dialog.css", "pos-locale-switcher-placement.css", "retail-pos.css",
      "retail-returns.css", "retail-returns-mobile.css", "retail-return-receipt.css",
      "retail-barcode-scan-tools.css", "retail-pos-navigation.css",
    ],
  });

  const editorRef = useRef(null);
  const receiptDialogRef = useRef(null);
  const scanDialogRef = useRef(null);
  const scanVideoRef = useRef(null);
  const scanStreamRef = useRef(null);
  const scanRafRef = useRef(0);
  const zxingReaderRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const [sales, setSales] = useState([]);
  const [history, setHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loyaltySettings, setLoyaltySettings] = useState({ enabled: true, spendPerPoint: 10, pointValue: 1 });
  const [receiptSettings, setReceiptSettings] = useState({});
  const [initialDataReady, setInitialDataReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchMode, setSearchMode] = useState("receipt");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [qtys, setQtys] = useState({});
  const [returnDate, setReturnDate] = useState(today);
  const [refundMethod, setRefundMethod] = useState("original");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [receiptRecord, setReceiptRecord] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [scanStatus, setScanStatus] = useState("");

  const posSession = useMemo(() => getRetailPosSession(), [
    profile?.uid, profile?.id, profile?.tenantId, profile?.role, profile?.roleId,
  ]);
  const posAccessProfile = useMemo(() => ({
    ...(profile || {}), ...(posSession || {}),
    role: posSession?.role || profile?.role || profile?.roleId || "",
    roleId: posSession?.roleId || posSession?.role || profile?.roleId || profile?.role || "",
  }), [profile, posSession]);
  const permissions = useMemo(() => getPosPermissions(posAccessProfile), [posAccessProfile]);
  const hasAccess = permissions.has("pos.returns");
  const redirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!hasAccess) {
      const first = firstAllowedPosPage(posAccessProfile);
      return first === "/pos/forbidden"
        ? "/pos/forbidden/?permission=pos.returns&next=" + encodeURIComponent(requested)
        : first + "?from=permission";
    }
    return "";
  }, [authState.status, tenantState.status, tenant, profile, posAccessProfile, hasAccess, stylesReady]);
  useEffect(() => { if (redirectTarget) location.replace(redirectTarget); }, [redirectTarget]);
  const showToast = useCallback(message => {
    setToastMessage(message);
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => setToastMessage(""), 2200);
  }, []);

  const refresh = useCallback(async () => {
    if (!tenant?.id || !profile || !hasAccess) return;
    setLoadError("");
    try {
      const [nextSales, nextReturns, nextProducts, nextCustomers, nextLoyalty, nextReceipt] = await Promise.all([
        listPosSales(tenant.id),
        listPosReturnsParity(tenant.id),
        listPosProducts(tenant.id),
        listPosCustomers(tenant.id),
        loadPosLoyaltySettings(tenant.id),
        loadPosReceiptSettings(tenant.id),
      ]);
      setSales(nextSales);
      setHistory(nextReturns);
      setProducts(nextProducts);
      setCustomers(nextCustomers);
      setLoyaltySettings(nextLoyalty);
      setReceiptSettings(nextReceipt);
    } catch (loadFailure) {
      console.error("POS_RETURNS_LOAD_FAILED", loadFailure);
      setLoadError(String(loadFailure?.message || "POS_RETURNS_LOAD_FAILED"));
    } finally {
      setInitialDataReady(true);
    }
  }, [tenant?.id, profile, hasAccess]);

  useEffect(() => {
    if (!redirectTarget && tenant?.id && profile && hasAccess) refresh();
  }, [redirectTarget, tenant?.id, profile, hasAccess, refresh]);

  useEffect(() => {
    if (!tenant?.id || !profile || !hasAccess || redirectTarget) return undefined;
    const stopSales = watchPosSales(tenant.id, rows => setSales(rows));
    const stopReturns = watchPosReturnsParity(tenant.id, rows => setHistory(rows));
    return () => { stopSales(); stopReturns(); };
  }, [tenant?.id, profile, hasAccess, redirectTarget]);

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const qtyNumber = value => formatNumber(Number(value || 0), { maximumFractionDigits: 3 });
  const dateTime = value => formatDate(asDate(value), { dateStyle: "medium", timeStyle: "short" });
  const selectedSale = useMemo(
    () => sales.find(row => String(row.id) === String(selectedSaleId)) || null,
    [sales, selectedSaleId],
  );
  const resultRows = useMemo(() => {
    if (!searchPerformed) return [];
    const queryText = appliedSearch.trim().toLowerCase();
    if (!queryText) return [];
    const returnable = sales.filter(sale =>
      (sale.items || []).some(item => remainingQty(history, sale, item) > 0));
    if (searchMode === "receipt") {
      const exact = returnable.filter(sale =>
        saleNumberOf(sale).toLowerCase() === queryText
        || String(sale.id || "").toLowerCase() === queryText);
      const partial = returnable.filter(sale =>
        saleNumberOf(sale).toLowerCase().includes(queryText)
        || String(sale.id || "").toLowerCase().includes(queryText));
      return [...exact, ...partial.filter(sale => !exact.includes(sale))].slice(0, 30);
    }
    if (searchMode === "product") {
      return returnable.filter(sale => (sale.items || []).some(item =>
        `${item.name || ""} ${item.productName || ""}`.trim().toLowerCase().includes(queryText))).slice(0, 30);
    }
    return returnable.filter(sale => (sale.items || []).some(item =>
      String(item.barcode || "").trim().toLowerCase().includes(queryText))).slice(0, 30);
  }, [sales, history, searchPerformed, appliedSearch, searchMode]);

  const rows = useMemo(() => (selectedSale?.items || []).map(item => {
    const id = itemIdOf(item);
    const sold = Number(item.qty || 0);
    const was = returnedQty(history, selectedSale.id, id);
    const remain = Math.max(0, sold - was);
    const qty = Math.max(0, Math.min(Number(qtys[id] || 0), remain));
    return {
      ...item, id, sold, was, remain, qty,
      refund: qty * Number(item.price || 0),
      productName: item.name || item.productName || id,
    };
  }), [selectedSale, history, qtys]);
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.refund, 0), [rows]);
  const plannedLoyalty = useMemo(
    () => loyaltyPreview(selectedSale, history, total, loyaltySettings),
    [selectedSale, history, total, loyaltySettings],
  );
  const currentReturnType = useMemo(() => {
    if (!selectedSale) return "return";
    const sold = (selectedSale.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const previous = saleReturns(history, selectedSale.id).flatMap(row => row.items || [])
      .reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const returning = rows.reduce((sum, row) => sum + Number(row.qty || 0), 0);
    return previous + returning >= sold ? "void" : "return";
  }, [selectedSale, history, rows]);

  const runSearch = useCallback((value = searchQuery) => {
    setAppliedSearch(String(value || ""));
    setSearchPerformed(true);
  }, [searchQuery]);
  const changeSearchMode = value => {
    setSearchMode(value);
    setSearchQuery("");
    setAppliedSearch("");
    setSearchPerformed(false);
    requestAnimationFrame(() => document.querySelector("#returnSaleSearch")?.focus());
  };
  const chooseSale = sale => {
    setSelectedSaleId(sale.id);
    setQtys({});
    setReturnDate(today());
    setRefundMethod("original");
    setReason("");
    setNote("");
    setError("");
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const clearSelected = () => {
    setSelectedSaleId("");
    setQtys({});
    setError("");
  };
  const selectAllRemainingForVoid = () => {
    if (!selectedSale) return;
    setQtys(Object.fromEntries(rows.map(row => [row.id, row.remain])));
    setRefundMethod("original");
    setReason(tr("void_reason"));
  };
  const setQty = (row, value) => {
    const qty = Math.max(0, Math.min(Number(value || 0), row.remain));
    setQtys(current => ({ ...current, [row.id]: qty }));
  };
  const focusNextQty = (event, row) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const inputs = [...document.querySelectorAll("#returnItemsBody .return-qty:not(:disabled)")];
    const current = inputs.findIndex(input => input.dataset.productId === row.id);
    const next = inputs[current + 1];
    if (next) {
      next.focus();
      next.select();
      next.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const errorMessage = useCallback(returnError => {
    const message = String(returnError?.message || returnError || "");
    if (message.startsWith("RETURN_QTY_EXCEEDED:")) {
      return tr("qty_product_exceeded", { product: message.split(":").slice(1).join(":") });
    }
    if (message.startsWith("PRODUCT_NOT_FOUND:")) {
      return tr("product_not_found", { product: message.split(":").slice(1).join(":") });
    }
    if (message === "SALE_NOT_FOUND") return tr("sale_not_found");
    if (message === "RETURN_DUPLICATE") return tr("duplicate");
    if (message === "RETURN_ITEMS_REQUIRED") return tr("items_required_error");
    return tr("save_failed");
  }, [tr]);
  const submitReturn = async () => {
    if (busy) return;
    setError("");
    if (!selectedSale) { setError(tr("select_sale_error")); return; }
    const items = rows.filter(row => row.qty > 0).map(row => ({
      productId: row.id, productName: row.productName, qty: row.qty,
    }));
    if (!items.length) { setError(tr("items_required_error")); return; }
    if (items.some(item => item.qty > rows.find(row => row.id === item.productId)?.remain)) {
      setError(tr("qty_exceeded_error")); return;
    }
    if (!returnDate || !reason.trim()) { setError(tr("date_reason_required_error")); return; }

    const pointParts = [];
    if (plannedLoyalty?.pointsEarnedToDeduct > 0) {
      pointParts.push(tr("points_deduct", { count: qtyNumber(plannedLoyalty.pointsEarnedToDeduct) }));
    }
    if (plannedLoyalty?.pointsUsedToRestore > 0) {
      pointParts.push(tr("points_restore", { count: qtyNumber(plannedLoyalty.pointsUsedToRestore) }));
    }
    const points = pointParts.length ? tr("points_line", { detail: pointParts.join(" / ") }) : "";
    const confirmKey = currentReturnType === "void" ? "confirm_void" : "confirm_return";
    const approved = await sweetConfirm(tr(confirmKey, {
      count: qtyNumber(items.reduce((sum, item) => sum + item.qty, 0)),
      amount: money(total),
      points,
    }), {
      title: t("shared.dialog.confirm_title"),
      type: "warning",
      confirmText: t("shared.actions.confirm"),
      cancelText: t("shared.actions.cancel"),
    });
    if (!approved) return;

    setBusy(true);
    try {
      const record = await createPosReturnParity({
        tenantId: tenant.id, saleId: selectedSale.id, saleDocumentId: selectedSale._documentId || selectedSale.id,
        items, products, customers, mode: currentReturnType, refundMethod, reason, note, returnDate,
      });
      const savedKey = record.returnType === "void" ? "saved_void" : "saved_return";
      const balance = record.loyaltyAdjustment
        ? " • " + tr("points_balance", { count: qtyNumber(record.loyaltyAdjustment.pointsAfter) }) : "";
      showToast(tr(savedKey, { id: record.id }) + balance);
      await refresh();
      clearSelected();
      runSearch(appliedSearch);
    } catch (saveError) {
      console.error("POS_RETURN_SAVE_FAILED", saveError);
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };
  const filteredHistory = useMemo(() => {
    const queryText = historySearch.trim().toLowerCase();
    return history.filter(record => {
      if (!queryText) return true;
      const itemText = (record.items || []).map(item => `${item.productName || item.name || ""} ${item.productId || ""}`).join(" ");
      return [record.id, record.returnNumber, record.saleNumber, record.saleId, record.reason, record.note, itemText]
        .some(value => String(value || "").toLowerCase().includes(queryText));
    });
  }, [history, historySearch]);

  const refundName = value => {
    const key = { cash: "refund_cash", transfer: "refund_transfer", original: "refund_original", credit: "refund_credit" }[value];
    return key ? tr(key) : String(value || "");
  };
  const openReceipt = record => {
    setReceiptRecord(record);
    requestAnimationFrame(() => receiptDialogRef.current?.showModal?.());
  };
  const closeReceipt = () => receiptDialogRef.current?.close?.();
  const printReceipt = async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    setTimeout(() => window.print(), 80);
  };

  const stopScanner = useCallback(() => {
    cancelAnimationFrame(scanRafRef.current);
    scanRafRef.current = 0;
    try { zxingControlsRef.current?.stop?.(); } catch {}
    try { zxingReaderRef.current?.reset?.(); } catch {}
    zxingControlsRef.current = null;
    zxingReaderRef.current = null;
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(track => track.stop());
      scanStreamRef.current = null;
    }
    if (scanVideoRef.current) scanVideoRef.current.srcObject = null;
    if (scanDialogRef.current?.open) scanDialogRef.current.close();
  }, []);
  const signalScan = () => {
    try { navigator.vibrate?.(80); } catch {}
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      const context = new Context();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.04, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 0.12);
      oscillator.addEventListener("ended", () => context.close());
    } catch {}
  };
  const acceptScan = useCallback(code => {
    const value = String(code || "").trim();
    if (!value) return false;
    setSearchMode("barcode");
    setSearchQuery(value);
    setAppliedSearch(value);
    setSearchPerformed(true);
    signalScan();
    showToast("สแกนบาร์โค้ดสำเร็จ");
    stopScanner();
    return true;
  }, [showToast, stopScanner]);

  const startScanner = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("อุปกรณ์นี้ไม่สามารถเปิดกล้องได้");
      return;
    }
    setScanStatus("กำลังเตรียมกล้อง...");
    if (!scanDialogRef.current?.open) scanDialogRef.current?.showModal?.();
    const video = scanVideoRef.current;
    try {
      if ("BarcodeDetector" in window) {
        const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        scanStreamRef.current = stream; video.srcObject = stream; await video.play();
        setScanStatus("กำลังสแกน...");
        const loop = async () => {
          if (!scanStreamRef.current) return;
          try {
            const codes = await detector.detect(video);
            if (codes.length && acceptScan(codes[0].rawValue)) return;
          } catch {}
          scanRafRef.current = requestAnimationFrame(loop);
        };
        loop();
        return;
      }
      setScanStatus("กำลังโหลดตัวอ่านบาร์โค้ด...");
      const ZXing = await loadZxing();
      const reader = new ZXing.BrowserMultiFormatReader();
      zxingReaderRef.current = reader;
      setScanStatus("กำลังสแกน...");
      zxingControlsRef.current = await reader.decodeFromVideoDevice(null, video, result => {
        if (result) acceptScan(String(result.getText?.() || result.text || ""));
      });
    } catch (scanError) {
      console.warn("POS_RETURN_SCAN_FAILED", scanError);
      stopScanner();
      showToast("เปิดกล้องไม่สำเร็จ กรุณาอนุญาตการใช้งานกล้อง");
    }
  };
  useEffect(() => () => stopScanner(), [stopScanner]);

  const needsReady = authState.status === "loading" || tenantState.status === "loading" || !stylesReady
    || Boolean(redirectTarget) || (tenant?.id && profile && hasAccess && !initialDataReady);
  if (needsReady) {
    return <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (loadError) {
    return <PageReadyOverlay error title={t("pos_returns.meta.title")} message={loadError} onRetry={refresh} />;
  }

  const searchCopy = {
    receipt: {
      placeholder: t("pos_returns.search.receipt_placeholder"),
      prompt: t("pos_returns.search.receipt_prompt"),
      none: t("pos_returns.search.receipt_none"),
    },
    product: {
      placeholder: t("pos_returns.search.product_placeholder"),
      prompt: t("pos_returns.search.product_prompt"),
      none: t("pos_returns.search.product_none"),
    },
    barcode: {
      placeholder: t("pos_returns.search.barcode_placeholder"),
      prompt: t("pos_returns.search.barcode_prompt"),
      none: t("pos_returns.search.barcode_none"),
    },
  }[searchMode];
  const searchDescription = t("pos_returns.search.description");
  const searchPlaceholder = searchCopy.placeholder;
  const resultEmpty = appliedSearch.trim() ? searchCopy.none : searchCopy.prompt;
  const loyaltyParts = [];
  if (plannedLoyalty?.pointsEarnedToDeduct > 0) {
    loyaltyParts.push(tr("loyalty_deduct_preview", { count: qtyNumber(plannedLoyalty.pointsEarnedToDeduct) }));
  }
  if (plannedLoyalty?.pointsUsedToRestore > 0) {
    loyaltyParts.push(tr("loyalty_restore_preview", { count: qtyNumber(plannedLoyalty.pointsUsedToRestore) }));
  }
  return <>
    <header className="pos-header" data-pos-management-header>
      <div className="app-title"><div>
        <strong>{t("pos_returns.header.title")}</strong>
        <small>{t("pos_returns.header.subtitle")}</small>
      </div></div>
      <div className="header-actions">
        <LocaleSwitcher />
        <PosNavigation profile={posAccessProfile} currentKey="pos.returns" />
      </div>
    </header>

    <main className="return-container" data-pos-management>
      <section className="panel return-search-panel">
        <div className="section-heading"><div>
          <h2><i className="bi bi-receipt pos-context-icon" data-icon-tone="green" aria-hidden="true"></i><span>{t("pos_returns.search.title")}</span></h2>
          <p>{searchDescription}</p>
        </div></div>
        <div className="return-search-mode-row">
          <select id="returnSearchMode" aria-label={t("pos_returns.search.mode_label")} value={searchMode}
            onChange={event => changeSearchMode(event.target.value)}>
            <option value="receipt">{t("pos_returns.search.mode_receipt")}</option>
            <option value="product">{t("pos_returns.search.mode_product")}</option>
            <option value="barcode">{t("pos_returns.search.mode_barcode")}</option>
          </select>
        </div>
        <div className="return-search-row">
          <div className="barcode-input-group">
            <input id="returnSaleSearch" autoComplete="off" value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); runSearch(); } }}
              placeholder={searchPlaceholder} />
            <button id="scanReturnSearchBtn" className="scan-barcode-btn" type="button"
              aria-label="สแกนบาร์โค้ด" title="สแกนบาร์โค้ด" onClick={startScanner}>
              <i className="bi bi-upc-scan scan-barcode-icon" aria-hidden="true"></i><span>สแกนบาร์โค้ด</span>
            </button>
          </div>
          <button id="returnSearchBtn" className="btn btn-pay" type="button" data-pos-icon="search" onClick={() => runSearch()}>
            <i className="bi bi-search pos-context-icon" data-icon-tone="emerald" aria-hidden="true"></i>
            <span>{t("pos_returns.search.button")}</span>
          </button>
        </div>
        <div id="returnSaleResults" className="return-sale-results">
          {resultRows.map(sale => {
            const available = (sale.items || []).reduce((sum, item) => sum + remainingQty(history, sale, item), 0);
            return <article className="return-sale-card" key={sale.id}>
              <div><strong>{saleNumberOf(sale)}</strong><span>{dateTime(sale.createdAt)} • {tr("available", { count: qtyNumber(available) })}</span></div>
              <div className="return-sale-total"><strong>{money(sale.totalAmount ?? sale.total)} บาท</strong><span>{tr("item_count", { count: formatNumber((sale.items || []).length) })}</span></div>
              <button type="button" data-sale-id={sale.id} onClick={() => chooseSale(sale)}>{tr("select_bill")}</button>
            </article>;
          })}
        </div>
        <div id="returnSaleEmpty" className="empty-state" hidden={resultRows.length > 0}>
          {searchPerformed ? resultEmpty : searchCopy.prompt}
        </div>
      </section>
      <section id="returnEditorPanel" ref={editorRef} className="panel return-editor-panel" hidden={!selectedSale}>
        {selectedSale ? <>
          <div className="return-editor-head section-heading">
            <div><h1 id="returnSaleId">{saleNumberOf(selectedSale)}</h1><p id="returnSaleMeta">
              {dateTime(selectedSale.createdAt)} • {(selectedSale.paymentMethod || selectedSale.payment?.method) === "cash" ? tr("cash") : tr("transfer")}
              {selectedSale.customerName ? " • " + tr("member", { code: selectedSale.customerCode || "", name: selectedSale.customerName }) : ""}
            </p></div>
            <button id="clearSelectedSale" className="btn btn-secondary" type="button" onClick={clearSelected}>
              {t("pos_returns.editor.new_bill")}
            </button>
          </div>
          <div className="table-wrap"><table className="return-table">
            <thead><tr>
              <th>{t("pos_returns.table.product")}</th><th className="number">{t("pos_returns.table.sold")}</th>
              <th className="number">{t("pos_returns.table.returned")}</th><th className="number">{t("pos_returns.table.return_now")}</th>
              <th className="number">{t("pos_returns.table.unit_price")}</th><th className="number">{t("pos_returns.table.refund")}</th>
            </tr></thead>
            <tbody id="returnItemsBody">
              {rows.map(row => <tr key={row.id} data-product-id={row.id}>
                <td className="return-product"><strong>{row.productName}</strong><span>{row.id} • {row.barcode || ""}</span></td>
                <td className="number">{qtyNumber(row.sold)}</td><td className="number">{qtyNumber(row.was)}</td>
                <td className="number"><input className="return-qty" data-product-id={row.id} type="number" min="0"
                  max={row.remain} step="0.001" value={qtys[row.id] ?? 0} disabled={row.remain <= 0}
                  onChange={event => setQty(row, event.target.value)}
                  onFocus={event => event.target.select()}
                  onMouseUp={event => { event.preventDefault(); event.currentTarget.select(); }}
                  onKeyDown={event => focusNextQty(event, row)} /></td>
                <td className="number">{money(row.price)}</td><td className="number return-line-total">{money(row.refund)}</td>
              </tr>)}
            </tbody>
          </table></div>
          <div className="return-form-grid">
            <label>{t("pos_returns.form.date")}<input id="returnDate" type="date" required value={returnDate} onChange={event => setReturnDate(event.target.value)} /></label>
            <label>{t("pos_returns.form.refund_method")}<select id="refundMethod" value={refundMethod} onChange={event => setRefundMethod(event.target.value)}>
              <option value="cash">{t("pos_returns.form.cash")}</option><option value="transfer">{t("pos_returns.form.transfer")}</option>
              <option value="original">{t("pos_returns.form.original")}</option><option value="credit">{t("pos_returns.form.credit")}</option>
            </select></label>
            <label className="full">{t("pos_returns.form.reason")}<input id="returnReason" maxLength={200} required
              value={reason} onChange={event => setReason(event.target.value)} placeholder={t("pos_returns.form.reason_placeholder")} /></label>
            <label className="full">{t("pos_returns.form.note")}<input id="returnNote" maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></label>
          </div>
          <div className="return-summary"><span>{t("pos_returns.summary.total")}</span><strong id="returnTotal">{money(total)} บาท</strong></div>
          <div id="returnLoyaltyPreview" className="return-loyalty-preview" hidden={!loyaltyParts.length}>
            <strong>{tr("loyalty_title")}</strong><span id="returnLoyaltyText">{loyaltyParts.join(" • ")}</span>
          </div>
          <p id="returnError" className="error-text">{error}</p>
          <div className="return-actions">
            <button id="voidSaleBtn" className="btn btn-secondary" type="button" disabled={busy} onClick={selectAllRemainingForVoid}>{t("pos_returns.actions.void")}</button>
            <button id="confirmReturnBtn" className="btn btn-pay" type="button" disabled={busy || total <= 0} onClick={submitReturn}>
              {busy ? tr("saving") : t("pos_returns.actions.confirm")}
            </button>
          </div>
        </> : null}
      </section>
      <section className="panel return-history-panel">
        <div className="section-heading"><div><h2><i className="bi bi-arrow-counterclockwise pos-context-icon" data-icon-tone="rose" aria-hidden="true"></i><span>{t("pos_returns.history.title")}</span></h2><p>{t("pos_returns.history.description")}</p></div></div>
        <label className="return-history-search">{t("pos_returns.history.search_label")}
          <input id="returnHistorySearch" value={historySearch} onChange={event => setHistorySearch(event.target.value)}
            placeholder={t("pos_returns.history.search_placeholder")} />
        </label>
        <div id="returnHistory" className="return-history">
          {filteredHistory.map(record => {
            const adjustment = record.loyaltyAdjustment;
            const typeText = (record.returnType || record.mode) === "void" ? tr("type_void") : tr("type_return");
            return <article className="return-history-item" key={record.id}>
              <div className="return-history-head"><div>
                <strong>{record.id}</strong>
                <span>{typeText} • {tr("reference", { number: record.saleNumber || record.saleId || "-" })} • {formatDate(asDate((record.returnDate || "").includes("-") ? record.returnDate + "T00:00:00" : record.createdAt), { dateStyle: "medium" })}</span>
              </div><div className="return-history-total"><strong>{money(record.refundTotal)} บาท</strong><span>{refundName(record.refundMethod)}</span></div></div>
              <div className="return-history-meta">{record.reason || "-"}{record.note ? " • " + record.note : ""}</div>
              {adjustment ? <div className="return-history-loyalty">
                {adjustment.pointsEarnedDeducted > 0 ? tr("history_deduct", { count: qtyNumber(adjustment.pointsEarnedDeducted) }) : ""}
                {adjustment.pointsEarnedDeducted > 0 && adjustment.pointsUsedRestored > 0 ? " • " : ""}
                {adjustment.pointsUsedRestored > 0 ? tr("history_restore", { count: qtyNumber(adjustment.pointsUsedRestored) }) : ""}
                {" • " + tr("history_balance", { count: qtyNumber(adjustment.pointsAfter) })}
              </div> : null}
              <div className="return-history-lines">{(record.items || []).map((item, index) =>
                <div className="return-history-line" key={item.productId || index}>
                  <span>{item.productName || item.name || item.productId} × {qtyNumber(item.qty)}</span><strong>{money(item.lineTotal)}</strong>
                </div>)}</div>
              <div className="return-history-actions"><button type="button" data-return-receipt={record.id} onClick={() => openReceipt(record)}>
                {t("pos_returns.receipt.history_action")}
              </button></div>
            </article>;
          })}
        </div>
        <div id="returnHistoryEmpty" className="empty-state" hidden={filteredHistory.length > 0}>{t("pos_returns.history.empty")}</div>
      </section>
    </main>
    <dialog ref={receiptDialogRef} className="return-receipt-dialog" onClose={() => setReceiptRecord(null)}>
      <div className="return-receipt-content">
        <div className="dialog-head no-print"><h2>{t("pos_returns.receipt.dialog_title")}</h2>
          <button id="closeReturnReceipt" className="icon-btn" type="button" onClick={closeReceipt}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
        <section className="return-receipt">
          <div className="return-receipt-head"><h1 id="rrShopName">{receiptSettings.shopName || t("pos_returns.receipt.default_shop")}</h1>
            <p>{t("pos_returns.receipt.document_title")}</p><div className="return-receipt-shop">
              <span id="rrShopAddress">{receiptSettings.shopAddress || ""}</span>
              <span id="rrShopPhone">{receiptSettings.shopPhone ? t("pos_returns.receipt.phone", { phone: receiptSettings.shopPhone }) : ""}</span>
              <span id="rrTaxId">{receiptSettings.taxId ? t("pos_returns.receipt.tax_id", { tax: receiptSettings.taxId }) : ""}</span>
            </div></div>
          <div className="return-receipt-meta">
            <div><span>{t("pos_returns.receipt.return_number")}</span><strong id="rrReturnId">{receiptRecord?.id || "-"}</strong></div>
            <div><span>{t("pos_returns.receipt.sale_reference")}</span><strong id="rrSaleId">{receiptRecord?.saleNumber || receiptRecord?.saleId || "-"}</strong></div>
            <div><span>{t("pos_returns.receipt.return_date")}</span><strong id="rrDate">{receiptRecord?.returnDate ? formatDate(asDate(receiptRecord.returnDate + "T00:00:00"), { dateStyle: "medium" }) : "-"}</strong></div>
            <div><span>{t("pos_returns.receipt.refund_by")}</span><strong id="rrMethod">{refundName(receiptRecord?.refundMethod)}</strong></div>
          </div>
          <table className="return-receipt-table"><thead><tr><th>{t("pos_returns.receipt.item")}</th><th className="number">{t("pos_returns.receipt.qty")}</th><th className="number">{t("pos_returns.receipt.price")}</th><th className="number">{t("pos_returns.receipt.total")}</th></tr></thead>
            <tbody id="rrItems">{(receiptRecord?.items || []).map((item, index) => <tr key={item.productId || index}>
              <td>{item.productName || item.name || item.productId}<div>{item.productId || ""}</div></td><td className="number">{qtyNumber(item.qty)}</td>
              <td className="number">{money(item.price)}</td><td className="number">{money(item.lineTotal)}</td>
            </tr>)}</tbody>
          </table>
          <div className="return-receipt-summary"><div className="grand"><span>{t("pos_returns.receipt.total_refund")}</span><strong id="rrTotal">{money(receiptRecord?.refundTotal)}</strong></div></div>
          <div className="return-receipt-reason"><div><strong>{t("pos_returns.receipt.reason")}</strong> <span id="rrReason">{receiptRecord?.reason || "-"}</span></div>
            <div id="rrNoteRow" hidden={!receiptRecord?.note}><strong>{t("pos_returns.receipt.note")}</strong> <span id="rrNote">{receiptRecord?.note || "-"}</span></div></div>
          <p className="return-receipt-footer">{t("pos_returns.receipt.footer")}</p>
        </section>
        <div className="return-receipt-actions no-print"><button id="closeReturnReceiptBtn" className="btn btn-secondary" type="button" onClick={closeReceipt}>{t("pos_returns.receipt.close")}</button>
          <button id="printReturnReceipt" className="btn btn-pay" type="button" onClick={printReceipt}>{t("pos_returns.receipt.print")}</button></div>
      </div>
    </dialog>
    <dialog id="posScanDialog" ref={scanDialogRef} className="pos-scan-dialog">
      <div className="pos-scan-sheet">
        <div className="pos-scan-head"><div><h2>สแกนบาร์โค้ด</h2><p>วางบาร์โค้ดให้อยู่ในกรอบสีเขียว</p></div>
          <button className="pos-scan-close" type="button" aria-label="ปิดกล้อง" onClick={stopScanner}><i className="bi bi-x-lg" aria-hidden="true"></i></button></div>
        <div className="pos-scan-view"><video ref={scanVideoRef} id="posScanVideo" playsInline muted></video><div className="pos-scan-guide"></div><div className="pos-scan-line"></div></div>
        <p id="posScanStatus" className="pos-scan-status">{scanStatus}</p>
      </div>
    </dialog>
    <div id="toast" className={`toast${toastMessage ? " show" : ""}`} role="status">{toastMessage}</div>
    <AppDeveloperPanel />
  </>;
}
