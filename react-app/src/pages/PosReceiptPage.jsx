import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { useAuth } from "@/auth/AuthProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import {
  createPosTaxInvoice,
  getPosSale,
  getPosTaxInvoiceForSale,
  loadPosReceiptSettings,
} from "@/data/retailPosData";

const DBD_URL = "https://datawarehouse.dbd.go.th/juristic";
const maskPart = value => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 1) return "*";
  if (text.length === 2) return text[0] + "*";
  return text[0] + "*".repeat(Math.min(text.length - 2, 4)) + text.slice(-1);
};
const maskName = value => String(value || "").trim().split(/\s+/).filter(Boolean).map(maskPart).join(" ");
const maskPhone = value => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return digits.slice(0, 1) + "***";
  if (digits.length < 10) return digits.slice(0, 2) + "xxx" + digits.slice(-2);
  return digits.slice(0, 3) + "-xxx-xx" + digits.slice(-2);
};
const dateValue = value => value?.toDate?.() || new Date(value || Date.now());
const cleanTaxId = value => String(value || "").replace(/\D/g, "").slice(0, 13);
const cleanText = value => String(value || "").replace(/\s+/g, " ").trim();

function PrintIcon() {
  return <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v7H6z"></path></svg>;
}
function CloseIcon() {
  return <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>;
}
function SaveIcon() {
  return <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"></path><path d="M8 4v6h8V4"></path><path d="M8 16h8"></path></svg>;
}
function SearchIcon() {
  return <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>;
}

export function PosReceiptPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber } = useI18n();
  const taxDialogRef = useRef(null);
  const stylesReady = useParityPage({
    title: t("pos.receipt.meta_title"),
    bodyClass: "pos-receipt-page",
    styles: ["retail-pos-font-local.css", "pos-receipt-page.css"],
  });
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const saleId = String(params.get("saleId") || "");
  const requestedPaper = String(params.get("paper") || "");
  const autoPrint = params.get("auto") === "1";
  const [sale, setSale] = useState(null);
  const [settings, setSettings] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [printReady, setPrintReady] = useState(false);
  const [taxBusy, setTaxBusy] = useState(false);
  const [dbdBusy, setDbdBusy] = useState(false);
  const [taxError, setTaxError] = useState("");
  const [buyer, setBuyer] = useState({ buyerTaxId: "", buyerName: "", buyerBranchName: "สำนักงานใหญ่", buyerAddress: "" });

  useEffect(() => {
    if (!tenant?.id || !saleId) {
      if (tenant?.id) setReady(true);
      return undefined;
    }
    let alive = true;
    Promise.all([getPosSale(tenant.id, saleId), loadPosReceiptSettings(tenant.id)])
      .then(([nextSale, nextSettings]) => {
        if (!alive) return;
        setSale(nextSale);
        setSettings(nextSettings);
        if (!nextSale) setError("ไม่พบบิลที่ต้องการพิมพ์");
      })
      .catch(loadError => {
        console.error("POS_RECEIPT_LOAD_FAILED", loadError);
        if (alive) setError(t("pos.catalog.load_failed"));
      })
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [tenant?.id, saleId, t]);

  const paperSize = ["58", "80", "a4"].includes(requestedPaper) ? requestedPaper : settings?.paperSize || "80";
  const receiptWidth = paperSize === "58" ? "58mm" : paperSize === "a4" ? "210mm" : "80mm";
  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const taxTitle = sale && (Number(sale.vatAmount || 0) > 0 || sale.vatRegistered) ? t("pos.receipt.abbreviated_tax_title") : t("pos.receipt.title");
  const customerName = maskName(sale?.customerName);
  const customerPhone = maskPhone(sale?.customerPhone);
  const paymentLabel = sale?.paymentMethod === "cash" || sale?.payment?.method === "cash" ? t("pos.payment.cash") : t("pos.payment.promptpay");
  const loyalty = sale?.loyalty || null;
  const branchText = settings?.taxBranchType === "branch"
    ? t("pos.receipt.branch", { value: settings?.taxBranchCode || "-" })
    : (settings?.taxBranch || t("pos.receipt.head_office"));

  const waitForPrintReady = async () => {
    try { if (document.fonts?.ready) await document.fonts.ready; } catch {}
    const images = [...document.querySelectorAll("#receiptRoot img")];
    await Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    })));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const printReceipt = async () => {
    setPrintReady(false);
    await waitForPrintReady();
    setPrintReady(true);
    window.print();
  };
  useEffect(() => {
    if (!ready || !sale) return undefined;
    let cancelled = false;
    waitForPrintReady().then(() => { if (!cancelled) setPrintReady(true); });
    return () => { cancelled = true; };
  }, [ready, sale, settings?.logoUrl]);
  useEffect(() => {
    if (!ready || !sale || !autoPrint) return undefined;
    const timer = window.setTimeout(printReceipt, 350);
    return () => window.clearTimeout(timer);
  }, [ready, sale, autoPrint]);

  const openTaxInvoiceWindow = invoice => {
    if (!invoice?.id) return;
    const width = 920, height = 760;
    const left = Math.max(0, Math.round((screen.width - width) / 2));
    const top = Math.max(0, Math.round((screen.height - height) / 2));
    const url = "/pos/tax-invoice?invoiceId=" + encodeURIComponent(invoice.id) + "&auto=0";
    window.open(url, "pos_tax_invoice_" + String(invoice.id).replace(/[^a-zA-Z0-9]/g, "_"),
      "popup=yes,width=" + width + ",height=" + height + ",left=" + left + ",top=" + top + ",noopener,noreferrer");
  };
  const buyerDraftKey = "retail_pos_tax_buyer_draft_" + (sale?.id || saleId || "latest");
  const saveBuyer = next => {
    setBuyer(next);
    try { localStorage.setItem(buyerDraftKey, JSON.stringify(next)); } catch {}
  };
  const openTaxInvoice = async () => {
    if (!sale || !tenant?.id || taxBusy) return;
    setTaxBusy(true);
    setTaxError("");
    try {
      const existing = await getPosTaxInvoiceForSale(tenant.id, sale);
      if (existing) {
        openTaxInvoiceWindow(existing);
        return;
      }
      let draft = null;
      try { draft = JSON.parse(localStorage.getItem(buyerDraftKey) || "null"); } catch {}
      saveBuyer(draft || {
        buyerTaxId: cleanTaxId(sale.customerTaxId || ""),
        buyerName: cleanText(sale.customerName || sale.customerDisplayName || ""),
        buyerBranchName: cleanText(sale.customerBranchName || "สำนักงานใหญ่") || "สำนักงานใหญ่",
        buyerAddress: cleanText(sale.customerAddress || ""),
      });
      taxDialogRef.current?.showModal?.();
      window.setTimeout(() => document.querySelector("#buyerTaxIdInput")?.focus?.(), 50);
    } catch (nextError) {
      console.error("POS_TAX_INVOICE_OPEN_FAILED", nextError);
      setTaxError(t("pos_tax_invoices.dynamic.issue_failed"));
      taxDialogRef.current?.showModal?.();
    } finally {
      setTaxBusy(false);
    }
  };
  const lookupDbd = async () => {
    const taxId = cleanTaxId(buyer.buyerTaxId);
    saveBuyer({ ...buyer, buyerTaxId: taxId });
    setTaxError("");
    if (taxId.length !== 13) {
      setTaxError(t("pos_tax_invoices.dynamic.tax_id_required"));
      return;
    }
    setDbdBusy(true);
    try {
      const response = await fetch("/api/tax-buyer/lookup?taxId=" + encodeURIComponent(taxId), { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error("DBD_" + response.status);
      const row = (await response.json())?.data || {};
      saveBuyer({
        buyerTaxId: cleanTaxId(row.buyerTaxId || taxId),
        buyerName: cleanText(row.buyerName || buyer.buyerName),
        buyerBranchName: cleanText(row.buyerBranchName || buyer.buyerBranchName || "สำนักงานใหญ่") || "สำนักงานใหญ่",
        buyerAddress: cleanText(row.buyerAddress || buyer.buyerAddress),
      });
      setTaxError(t("pos_tax_invoices.dynamic.dbd_issue_success"));
    } catch (lookupError) {
      console.warn("POS_TAX_BUYER_LOOKUP_FAILED", lookupError);
      setTaxError(t("pos_tax_invoices.dynamic.dbd_auto_failed") + " • " + DBD_URL + "?keyword=" + encodeURIComponent(taxId));
    } finally {
      setDbdBusy(false);
    }
  };
  const issueTaxInvoice = async event => {
    event.preventDefault();
    if (!sale || !tenant?.id || taxBusy) return;
    if (!cleanText(buyer.buyerName)) {
      setTaxError(t("pos_tax_invoices.dynamic.missing_buyer_name"));
      return;
    }
    setTaxBusy(true);
    setTaxError("");
    try {
      const invoice = await createPosTaxInvoice({ tenantId: tenant.id, sale, buyer, settings: settings || {} });
      try { localStorage.removeItem(buyerDraftKey); } catch {}
      taxDialogRef.current?.close?.();
      openTaxInvoiceWindow(invoice);
    } catch (nextError) {
      console.error("POS_TAX_INVOICE_CREATE_FAILED", nextError);
      setTaxError(t("pos_tax_invoices.dynamic.issue_failed"));
    } finally {
      setTaxBusy(false);
    }
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (tenant?.id && !ready)) {
    return <PageReadyOverlay context={t("pos.receipt.header_title")} title={t("pos.receipt.loading")} message={t("shared.state.please_wait")} progress={88} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Freact%2Fpos%2Freceipt" replace />;
  if (!tenant) return <Navigate to="/" replace />;

  const printCss = "#receiptRoot{width:" + receiptWidth + "} @media print{" +
    "body>#root{display:block!important}body>#root>.page{display:block!important}" +
    "@page{size:" + (paperSize === "a4" ? "A4" : receiptWidth + " auto") + ";margin:" + (paperSize === "a4" ? "12mm" : "0") + "}}";

  return (
    <main className="page">
      <style>{printCss}</style>
      <div className="toolbar">
        <strong>{t("pos.receipt.header_title")}</strong>
        <div className="actions">
          <button id="taxInvoiceBtn" className="btn btn-tax" type="button" disabled={!sale || taxBusy} onClick={openTaxInvoice}><PrintIcon /><span>{t("pos.receipt.tax_invoice")}</span></button>
          <button id="printBtn" className="btn btn-primary" type="button" disabled={!sale || !printReady} onClick={printReceipt}><PrintIcon /><span>{t("pos.receipt.print")}</span></button>
          <button id="closeBtn" className="btn btn-light" type="button" onClick={() => window.close()}><CloseIcon /><span>{t("pos.common.close")}</span></button>
        </div>
      </div>

      {sale ? <section id="receiptRoot" className="receipt">
        <div className="center">
          {settings?.logoUrl ? <img className="logo" src={settings.logoUrl} alt="" onError={event => { event.currentTarget.hidden = true; }} /> : null}
          <div className="shop">{settings?.shopName || tenant?.name || t("pos.header.title")}</div>
          {settings?.shopAddress ? <div className="muted">{settings.shopAddress}</div> : null}
          {settings?.shopPhone ? <div className="muted">{t("pos.receipt.phone_value", { value: settings.shopPhone })}</div> : null}
          {settings?.taxId ? <div className="muted">{t("pos.receipt.tax_id_value", { value: settings.taxId })}</div> : null}
          {settings?.taxId ? <div className="muted">{branchText}</div> : null}
          <div className="receipt-title">{taxTitle}</div>
        </div>
        <hr className="rule" />
        <div className="row"><span>{t("pos.receipt.bill_number")}</span><strong>{sale.saleNumber || sale.id || "-"}</strong></div>
        <div className="row"><span>{t("pos.receipt.date")}</span><span>{dateValue(sale.createdAt).toLocaleString("th-TH")}</span></div>
        <div className="row"><span>{t("pos.receipt.payment")}</span><span>{paymentLabel}</span></div>
        {customerName || customerPhone || sale.customerCode ? <>
          <hr className="rule" />
          {customerName ? <div className="row"><span>{t("pos.customer.label")}</span><strong>{customerName}</strong></div> : null}
          {sale.customerCode ? <div className="row"><span>{t("pos.customer.member")}</span><span>{sale.customerCode}</span></div> : null}
          {customerPhone ? <div className="row"><span>{t("pos.receipt.phone")}</span><span>{customerPhone}</span></div> : null}
        </> : null}
        <hr className="rule" />
        <table className="receipt-items"><thead><tr><th>{t("pos.receipt.item")}</th><th>{t("pos.receipt.price")}</th><th>{t("pos.receipt.total")}</th></tr></thead>
          <tbody>{(sale.items || []).map((item, index) => {
            const qty = Number(item.qty || 0);
            return <tr key={item.productId || item.id || index}><td><strong>{item.name || item.productName || "-"} x {formatNumber(qty)}</strong></td><td>{money(item.price)}</td><td>{money(item.lineTotal || Number(item.price || 0) * qty)}</td></tr>;
          })}</tbody>
        </table>
        <hr className="rule" />
        <div className="row"><span>{t("pos.receipt.subtotal")}</span><span>{money(sale.subtotal)}</span></div>
        <div className="row"><span>{t("pos.receipt.discount")}</span><span>{money(sale.discount)}</span></div>
        {Number(sale.pointDiscount || 0) ? <div className="row"><span>{t("pos.loyalty.discount")}</span><span>{money(sale.pointDiscount)}</span></div> : null}
        {Number(sale.vatAmount || 0) > 0 || sale.vatRegistered ? <>
          <div className="row"><span>{t("pos_customer_display.total.before_vat")}</span><span>{money(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase)}</span></div>
          <div className="row"><span>VAT {formatNumber(Number(sale.vatRate || 7))}%</span><span>{money(sale.vatAmount)}</span></div>
          <div className="row"><span>{t("pos_customer_display.total.vat_mode")}</span><span>{sale.vatMode === "exclude" ? t("pos_customer_display.total.exclude_vat") : t("pos_customer_display.total.include_vat")}</span></div>
        </> : null}
        <div className="row total"><span>{t("pos.cart.net_total")}</span><span>{money(sale.totalAmount || sale.total)}</span></div>
        <div className="row"><span>{t("pos.receipt.received")}</span><span>{money(sale.receivedAmount || sale.payment?.received || sale.totalAmount || sale.total)}</span></div>
        <div className="row"><span>{t("pos.receipt.change")}</span><span>{money(sale.changeAmount || sale.payment?.change)}</span></div>
        {loyalty ? <>
          <hr className="rule" />
          <div className="row"><span>แต้มก่อนซื้อ</span><span>{formatNumber(Number(loyalty.pointsBefore || 0))}</span></div>
          <div className="row"><span>ใช้แต้ม</span><span>{formatNumber(Number(loyalty.pointsUsed || 0))}</span></div>
          <div className="row"><span>แต้มที่ได้รับ</span><span>{formatNumber(Number(loyalty.pointsEarned || 0))}</span></div>
          <div className="row"><span>แต้มคงเหลือ</span><strong>{formatNumber(Number(loyalty.pointsAfter || 0))}</strong></div>
        </> : null}
        {sale.syncStatus === "pending" ? <><hr className="rule" /><div className="center muted">{t("pos.receipt.offline_pending")}</div></> : null}
        <hr className="rule" />
        <div className="center muted footer">{settings?.receiptThanks || "ขอบคุณที่ใช้บริการ"}{settings?.receiptFooter ? <><br />{settings.receiptFooter}</> : null}</div>
      </section> : <div id="receiptRoot" className={error ? "missing" : "loading"}>{error || t("pos.receipt.loading")}</div>}

      <dialog id="taxInvoiceDialog" ref={taxDialogRef} className="tax-dialog" onCancel={event => { event.preventDefault(); if (!taxBusy) taxDialogRef.current?.close?.(); }}>
        <form id="taxInvoiceForm" className="tax-form" method="dialog" onSubmit={issueTaxInvoice}>
          <div><h2>{t("pos_tax_invoices.buyer_dialog_title")}</h2><p>ระบบจะจำข้อมูลนี้ไว้กับลูกค้า/บิล เพื่อใช้ซ้ำครั้งถัดไป</p></div>
          <div className="tax-grid">
            <label>{t("pos_tax_invoices.tax_id")}<div className="tax-id-control">
              <input id="buyerTaxIdInput" inputMode="numeric" maxLength="13" autoComplete="off" value={buyer.buyerTaxId} onChange={event => saveBuyer({ ...buyer, buyerTaxId: event.target.value })} />
              <button id="dbdLookupBtn" className="dbd-btn" type="button" disabled={dbdBusy || taxBusy} onClick={lookupDbd}><SearchIcon /><span>{dbdBusy ? t("pos_tax_invoices.dynamic.searching") : "DBD"}</span></button>
            </div><small className="tax-hint">กด DBD เพื่อค้นหาข้อมูลนิติบุคคลจาก DBD DataWarehouse+</small></label>
            <label>{t("pos_tax_invoices.buyer_name")}<input id="buyerNameInput" autoComplete="organization" required value={buyer.buyerName} onChange={event => saveBuyer({ ...buyer, buyerName: event.target.value })} /></label>
            <label>{t("pos_tax_invoices.branch")}<input id="buyerBranchInput" value={buyer.buyerBranchName} onChange={event => saveBuyer({ ...buyer, buyerBranchName: event.target.value })} /></label>
            <label>{t("pos_tax_invoices.buyer_address")}<textarea id="buyerAddressInput" autoComplete="street-address" value={buyer.buyerAddress} onChange={event => saveBuyer({ ...buyer, buyerAddress: event.target.value })}></textarea></label>
          </div>
          <div id="taxInvoiceError" className="tax-error">{taxError}</div>
          <div className="tax-dialog-actions">
            <button id="taxInvoiceCancelBtn" className="btn btn-light" type="button" disabled={taxBusy} onClick={() => taxDialogRef.current?.close?.()}><CloseIcon /><span>{t("pos_tax_invoices.cancel")}</span></button>
            <button className="btn btn-tax" type="submit" disabled={taxBusy}><SaveIcon /><span>{taxBusy ? t("pos_tax_invoices.dynamic.issuing") : t("pos_tax_invoices.issue_invoice")}</span></button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
