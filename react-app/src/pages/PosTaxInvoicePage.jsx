import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { useAuth } from "@/auth/AuthProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { getPosTaxInvoice } from "@/data/retailPosData";

const ITEMS_PER_PAGE = 20;
const dateValue = value => value?.toDate?.() || new Date(value || Date.now());

export function PosTaxInvoicePage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("pos_tax_invoice.meta_title"),
    bodyClass: "pos-tax-invoice-page",
    styles: ["retail-pos-font-local.css", "pos-tax-invoice-page.css"],
  });
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const invoiceId = String(params.get("invoiceId") || "");
  const autoPrint = params.get("auto") === "1";
  const [invoice, setInvoice] = useState(null);
  const [ready, setReady] = useState(false);
  const [printReady, setPrintReady] = useState(false);

  useEffect(() => {
    if (!tenant?.id || !invoiceId) {
      if (tenant?.id) setReady(true);
      return undefined;
    }
    let alive = true;
    getPosTaxInvoice(tenant.id, invoiceId)
      .then(row => { if (alive) setInvoice(row); })
      .catch(error => console.error("POS_TAX_INVOICE_LOAD_FAILED", error))
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [tenant?.id, invoiceId]);

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const waitForPrintReady = async () => {
    try { if (document.fonts?.ready) await document.fonts.ready; } catch {}
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const printInvoice = async () => {
    setPrintReady(false);
    await waitForPrintReady();
    setPrintReady(true);
    window.print();
  };
  useEffect(() => {
    if (!ready || !invoice) return undefined;
    let cancelled = false;
    waitForPrintReady().then(() => { if (!cancelled) setPrintReady(true); });
    return () => { cancelled = true; };
  }, [ready, invoice]);
  useEffect(() => {
    if (!ready || !invoice || !autoPrint) return undefined;
    const timer = window.setTimeout(printInvoice, 450);
    return () => window.clearTimeout(timer);
  }, [ready, invoice, autoPrint]);

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (tenant?.id && !ready)) {
    return <PageReadyOverlay context={t("pos_tax_invoice.title")} title={t("pos_tax_invoice.loading")} message={t("shared.state.please_wait")} />;
  }
  if (!profile) return <NavigAte to="/login?next=%2Fpos%2Ftax-invoice" replace />;
  if (!tenant) return <NavigAte to="/" replace />;

  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const chunks = [];
  for (let i = 0; i < Math.max(items.length, 1); i += ITEMS_PER_PAGE) chunks.push(items.slice(i, i + ITEMS_PER_PAGE));
  const seller = invoice?.seller || {};
  const buyer = invoice?.buyer || {};
  const sellerBranch = seller.sellerBranchType === "branch"
    ? t("pos_tax_invoice.branch", { code: seller.sellerBranchCode || "-" })
    : t("pos_tax_invoice.head_office");
  const sellerTaxLine = seller.sellerTaxId
    ? t("pos_tax_invoice.tax_id", { tax_id: seller.sellerTaxId, branch: " " + sellerBranch })
    : sellerBranch;
  const buyerBranch = String(buyer.buyerBranchName || "").trim() || t("pos_tax_invoice.head_office");
  const buyerTaxLine = buyer.buyerTaxId
    ? t("pos_tax_invoice.tax_id", { tax_id: buyer.buyerTaxId, branch: " " + buyerBranch })
    : "";
  const isVoid = invoice?.status === "void";

  return (
    <main className="page">
      <div className="toolbar">
        <strong>{t("pos_tax_invoice.title")}</strong>
        <div className="actions">
          <button id="printBtn" className="btn btn-primary" type="button" disabled={!invoice || !printReady} onClick={printInvoice}>
            <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v7H6z"></path></svg>
            <span>{t("pos_tax_invoice.print")}</span>
          </button>
          <button id="closeBtn" className="btn btn-light" type="button" onClick={() => window.close()}>
            <svg className="btn-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
            <span>{t("pos_tax_invoice.close")}</span>
          </button>
        </div>
      </div>

      {invoice ? <div id="taxInvoiceRoot" className="tax-stack">
        {chunks.map((chunk, pageIndex) => {
          const offset = pageIndex * ITEMS_PER_PAGE;
          const isLast = pageIndex === chunks.length - 1;
          return <article className="tax-paper" data-tax-page={pageIndex + 1} key={pageIndex}>
            {isVoid ? <div className="void-stamp">{t("pos_tax_invoice.void")}</div> : null}
            <div className="tax-page-number">{t("pos_tax_invoice.page", { current: pageIndex + 1, total: chunks.length })}</div>
            <section className="tax-title"><h1>{t("pos_tax_invoice.title")}</h1><div>Tax Invoice</div></section>
            <section className="tax-grid top-grid">
              <div>
                <h2>{seller.sellerName || t("pos_tax_invoice.default_seller")}</h2>
                {seller.sellerAddress ? <p>{seller.sellerAddress}</p> : null}
                {seller.sellerPhone ? <p>{t("pos_tax_invoice.phone", { phone: seller.sellerPhone })}</p> : null}
                {sellerTaxLine ? <p>{sellerTaxLine}</p> : null}
              </div>
              <div className="doc-box">
                <div><span>{t("pos_tax_invoice.number")}</span><strong>{invoice.invoiceNumber || invoice.id || "-"}</strong></div>
                <div><span>{t("pos_tax_invoice.date")}</span><strong>{dateValue(invoice.issuedAt).toLocaleString("th-TH")}</strong></div>
                {invoice.saleNumber ? <div><span>{t("pos_tax_invoice.sale_reference")}</span><strong>{invoice.saleNumber}</strong></div> : null}
                {isVoid ? <div><span>{t("pos_tax_invoice.status")}</span><strong>{t("pos_tax_invoice.void")}</strong></div> : null}
              </div>
            </section>
            {isVoid ? <section className="void-note"><strong>{t("pos_tax_invoice.void_note")}</strong>{invoice.voidReason ? <><br />{t("pos_tax_invoice.reason", { reason: invoice.voidReason })}</> : null}</section> : null}
            <section className="buyer-box">
              <h2>{t("pos_tax_invoice.buyer")}</h2>
              <p><strong>{buyer.buyerName || "-"}</strong></p>
              {buyerTaxLine ? <p>{buyerTaxLine}</p> : null}
              {buyer.buyerAddress ? <p>{buyer.buyerAddress}</p> : null}
            </section>
            <table className="items-table">
              <thead><tr><th>#</th><th>{t("pos_tax_invoice.item")}</th><th className="right">{t("pos_tax_invoice.quantity")}</th><th className="right">{t("pos_tax_invoice.price")}</th><th className="right">{t("pos_tax_invoice.total")}</th></tr></thead>
              <tbody>{chunk.map((item, index) => <tr key={item.productId || item.id || index}>
                <td>{offset + index + 1}</td><td>{item.name || item.productName || "-"}</td>
                <td className="right">{formatNumber(Number(item.qty || 0))}</td>
                <td className="right">{money(item.price)}</td>
                <td className="right">{money(item.lineTotal ?? Number(item.price || 0) * Number(item.qty || 0))}</td>
              </tr>)}</tbody>
            </table>
            {isLast ? <section className="tax-final-block">
              <section className="summary-box">
                <div><span>{t("pos_tax_invoice.subtotal")}</span><strong>{money(invoice.subtotal)}</strong></div>
                <div><span>{t("pos_tax_invoice.discount")}</span><strong>{money(invoice.discount)}</strong></div>
                {Number(invoice.pointDiscount || 0) ? <div><span>{t("pos_tax_invoice.point_discount")}</span><strong>{money(invoice.pointDiscount)}</strong></div> : null}
                <div><span>{t("pos_tax_invoice.before_vat")}</span><strong>{money(invoice.beforeVat)}</strong></div>
                <div><span>VAT {formatNumber(Number(invoice.vatRate || 7))}%</span><strong>{money(invoice.vatAmount)}</strong></div>
                <div><span>{t(invoice.vatMode === "exclude" ? "pos_tax_invoice.vat_excluded" : "pos_tax_invoice.vat_included")}</span><strong>{money(invoice.totalAmount)}</strong></div>
                <div className="grand"><span>{t("pos_tax_invoice.net_total")}</span><strong>{money(invoice.totalAmount)}</strong></div>
              </section>
              <section className="signature-grid">
                <div><span></span><p>{t("pos_tax_invoice.goods_receiver")}</p></div>
                <div><span></span><p>{t("pos_tax_invoice.payment_receiver")}</p></div>
              </section>
            </section> : null}
          </article>;
        })}
      </div> : <div id="taxInvoiceRoot" className="missing">{t("pos_tax_invoice.missing")}</div>}
    </main>
  );
}
