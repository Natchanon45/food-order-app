import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import {
  importCatalogProducts,
  listCatalogProducts,
} from "@/data/catalogData";
import {
  buildRetailMasterCatalogThailand,
  validateRetailMasterCatalogThailand,
} from "@/data/rmct";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const CATEGORY_ICONS = ["droplet","cup-straw","cup-hot","cup","lightning-charge","box-seam","grid-3x3-gap","basket","bag","archive","box2","bookshelf"];
const CATALOG = buildRetailMasterCatalogThailand();
const VALIDATION = validateRetailMasterCatalogThailand(CATALOG);

export function PosCatalogPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, locale, intlLocale, formatNumber } = useI18n();
  const stylesReady = useParityPage({
    title: t("pos_catalog.title"),
    styles: ["retail-pos.css", "retail-catalog-import.css", "sweet-dialog.css"],
  });
  const importDialogRef = useRef(null);
  const [existingProducts, setExistingProducts] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(() => new Set(CATALOG.products.map(item => item.categoryId)));
  const [skipExisting, setSkipExisting] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState({ message: "", tone: "" });
  const [pendingRows, setPendingRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialReady, setInitialReady] = useState(false);
  const [excelRows, setExcelRows] = useState([]);
  const [excelResult, setExcelResult] = useState({ message: "", tone: "" });
  const [excelImporting, setExcelImporting] = useState(false);

  const tr = (key, replacements = {}) => t(`pos_catalog.${key}`, replacements);
  const number = value => new Intl.NumberFormat(intlLocale).format(Number(value || 0));
  const money = value => new Intl.NumberFormat(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
  const displayName = item => locale === "th" ? (item.nameTh || item.name) : (item.nameEn || item.name || item.nameTh);
  const displayBrand = item => locale === "th" ? (item.brandTh || item.brand) : (item.brand || item.brandTh);
  const displayCategory = item => {
    const key = `pos_catalog.category_labels.${item.categoryId}`;
    const translated = t(key);
    return translated === key ? (item.category || "-") : translated;
  };

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      setExistingProducts(await listCatalogProducts(tenant.id));
    } catch (error) {
      console.error("POS_CATALOG_LOAD_FAILED", error);
      setImportResult({ message: tr("dynamic.import_failed", { error: error?.message || tr("dynamic.try_again") }), tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role !== "owner" || !tenant?.id) return undefined;
    let alive = true;
    setInitialReady(false);
    load().finally(() => { if (alive) setInitialReady(true); });
    return () => { alive = false; };
  }, [profile?.role, tenant?.id]);

  const categorySummaries = useMemo(() => {
    const map = new Map();
    CATALOG.products.forEach(item => {
      const current = map.get(item.categoryId) || { id: item.categoryId, name: displayCategory(item), count: 0, published: 0, brands: new Set() };
      current.count += 1;
      if (item.catalogStatus === "published") current.published += 1;
      if (item.brandTh || item.brand) current.brands.add(item.brandTh || item.brand);
      map.set(item.categoryId, current);
    });
    return [...map.values()];
  }, [locale, t]);

  const existingKeys = useMemo(() => ({
    masterIds: new Set(existingProducts.map(item => String(item.masterProductId || "")).filter(Boolean)),
    barcodes: new Set(existingProducts.map(item => String(item.barcode || "")).filter(Boolean)),
  }), [existingProducts]);
  const isExisting = item => existingKeys.masterIds.has(String(item.masterProductId || ""))
    || Boolean(item.barcode && existingKeys.barcodes.has(String(item.barcode)));

  const selectedProducts = useMemo(() => CATALOG.products
    .filter(item => selectedCategoryIds.has(item.categoryId))
    .sort((left, right) => {
      const statusOrder = Number(right.catalogStatus === "published") - Number(left.catalogStatus === "published");
      return statusOrder || String(left.categoryId).localeCompare(String(right.categoryId))
        || String(left.name || "").localeCompare(String(right.name || ""), "th");
    }), [selectedCategoryIds]);

  const breakdown = useMemo(() => {
    const ready = selectedProducts.filter(item => item.catalogStatus === "published");
    const existingReady = ready.filter(isExisting);
    const importable = skipExisting ? ready.filter(item => !isExisting(item)) : ready;
    return {
      selected: selectedProducts.length,
      ready: ready.length,
      importable: importable.length,
      skippedExisting: skipExisting ? existingReady.length : 0,
      draft: selectedProducts.length - ready.length,
      rows: importable,
    };
  }, [selectedProducts, skipExisting, existingKeys]);

  const previewCounts = useMemo(() => {
    const counts = { all: selectedProducts.length, importable: 0, ready: 0, existing: 0, draft: 0 };
    selectedProducts.forEach(item => {
      const ready = item.catalogStatus === "published";
      if (!ready) { counts.draft += 1; return; }
      counts.ready += 1;
      const exists = isExisting(item);
      if (exists) counts.existing += 1;
      if (!skipExisting || !exists) counts.importable += 1;
    });
    return counts;
  }, [selectedProducts, skipExisting, existingKeys]);

  const filteredPreview = useMemo(() => {
    const query = search.trim().toLowerCase();
    return selectedProducts.filter(item => {
      const exists = isExisting(item);
      const ready = item.catalogStatus === "published";
      const statusMatch = statusFilter === "all"
        || (statusFilter === "ready" && ready)
        || (statusFilter === "importable" && ready && (!skipExisting || !exists))
        || (statusFilter === "existing" && ready && exists)
        || (statusFilter === "draft" && !ready);
      if (!statusMatch) return false;
      if (!query) return true;
      return [
        item.masterProductId, item.sku, item.barcode, item.name, item.nameTh,
        item.brand, item.brandTh, item.category, item.categoryId,
        ...(item.keywords || []),
      ].join(" ").toLowerCase().includes(query);
    });
  }, [selectedProducts, search, statusFilter, skipExisting, existingKeys]);

  const selectCategories = mode => {
    if (mode === "all") setSelectedCategoryIds(new Set(categorySummaries.map(item => item.id)));
    if (mode === "ready") setSelectedCategoryIds(new Set(categorySummaries.filter(item => item.published > 0).map(item => item.id)));
    if (mode === "clear") setSelectedCategoryIds(new Set());
  };

  const toggleCategory = (id, checked) => {
    setSelectedCategoryIds(current => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const requestImport = () => {
    if (!VALIDATION.valid || !breakdown.rows.length || importing) return;
    setPendingRows(breakdown.rows);
    importDialogRef.current?.showModal?.();
  };

  const confirmImport = async () => {
    if (!tenant?.id || !pendingRows.length || importing) return;
    importDialogRef.current?.close?.();
    const rows = [...pendingRows];
    setPendingRows([]);
    setImporting(true);
    setImportResult({ message: tr("dynamic.saving"), tone: "" });
    try {
      await importCatalogProducts(tenant.id, rows, CATALOG.version);
      setImportResult({
        message: tr("dynamic.success_title", { count: number(rows.length) }),
        tone: "success",
      });
      await load();
    } catch (error) {
      console.error("POS_CATALOG_IMPORT_FAILED", error);
      const denied = String(error?.code || error?.message || "").includes("permission-denied");
      setImportResult({
        message: denied ? tr("dynamic.permission_denied") : tr("dynamic.import_failed", { error: error?.message || tr("dynamic.try_again") }),
        tone: "error",
      });
    } finally {
      setImporting(false);
    }
  };

  const exportCsv = async () => {
    const rows = await listCatalogProducts(tenant.id);
    const headers = ["product_code","name","category","price","cost","stock","unit","barcode","show_on_pos","image_url"];
    const csv = [
      headers.join(","),
      ...rows.map(item => [
        item.id, item.name, item.category, item.price, item.cost, item.stock, item.unit,
        item.barcode, item.showOnPos === false ? "no" : "yes", item.imageUrl,
      ].map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")),
    ].join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pos-products-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const emptyReason = !VALIDATION.valid
    ? tr("dynamic.validation_failed", { error: VALIDATION.errors[0] })
    : breakdown.importable ? tr("dynamic.ready_reason")
      : breakdown.ready && breakdown.skippedExisting ? tr("dynamic.all_existing", { count: number(breakdown.ready) })
        : breakdown.ready ? tr("dynamic.no_importable") : tr("dynamic.only_drafts");

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || (profile?.role === "owner" && tenant?.id && !initialReady)) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fpos%2Fcatalog" replace />;
  if (profile.role !== "owner" || tenantState.status === "error" || !tenant) return <Navigate to="/" replace />;

  return (
    <>
      <header className="pos-header" data-pos-supporting-header>
        <div className="app-title"><div><strong>{tr("title")}</strong><small>{tr("subtitle")}</small></div></div>
        <div className="header-actions"><a className="btn btn-secondary" href="/pos/products">{tr("back_products")}</a><LocaleSwitcher /></div>
      </header>

      <main className="catalog-shell" data-pos-supporting="catalog">
        <section className="catalog-hero"><div className="catalog-hero-content"><div className="catalog-hero-head"><h1>{tr("hero_title")}</h1><div className="catalog-actions"><button id="importButton" className="btn primary" type="button" data-pos-icon="box-arrow-in-down" disabled={importing || !VALIDATION.valid || !breakdown.importable} onClick={requestImport}><i className={`bi bi-${importing ? "hourglass-split" : "box-arrow-in-down"}`} aria-hidden="true"></i><span>{importing ? tr("dynamic.importing") : tr("import_all")}</span></button><a className="btn secondary" href="/pos/products">{tr("view_products")}</a></div></div><p>{tr("hero_description")}</p></div></section>

        <div className="catalog-note"><strong>{tr("safe_title")}</strong><span>{tr("safe_description")}</span></div>
        <section className="catalog-stats">
          <article className="catalog-stat"><span>{tr("stats.total")}</span><strong id="totalProducts">{number(CATALOG.productCount)}</strong></article>
          <article className="catalog-stat ready"><span>{tr("stats.ready")}</span><strong id="readyProducts">{number(CATALOG.publishedCount)}</strong></article>
          <article className="catalog-stat"><span>{tr("stats.current")}</span><strong id="currentProducts">{number(existingProducts.length)}</strong></article>
          <article className="catalog-stat warning"><span>{tr("stats.review")}</span><strong id="reviewPending">{number(CATALOG.draftCount)}</strong></article>
        </section>

        <section className="catalog-panel">
          <div className="panel-head"><div><h2>{tr("categories.title")}</h2><p className="preview-muted">{tr("categories.description")}</p></div><div className="import-options"><button id="selectAllCategories" className="btn chip-action" type="button" onClick={() => selectCategories("all")}>{tr("categories.select_all")}</button><button id="selectReadyCategories" className="btn chip-action" type="button" onClick={() => selectCategories("ready")}>{tr("categories.select_ready")}</button><button id="clearCategories" className="btn chip-action" type="button" onClick={() => selectCategories("clear")}>{tr("categories.clear")}</button><label><input type="checkbox" id="skipExisting" checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)} /> {tr("categories.skip_existing")}</label></div></div>
          <div id="categoryGrid" className="catalog-grid">
            {categorySummaries.map((item, index) => <label className={`category-card ${item.published ? "has-ready" : ""}`} key={item.id}><input type="checkbox" data-category-id={item.id} checked={selectedCategoryIds.has(item.id)} onChange={e => toggleCategory(item.id, e.target.checked)} /><span className="category-icon" aria-hidden="true"><i className={`bi bi-${CATEGORY_ICONS[index % CATEGORY_ICONS.length]}`}></i></span><span><strong>{item.name}</strong><small>{tr("categories.summary", { count: number(item.count), ready: number(item.published) })}</small></span></label>)}
          </div>
          <div id="catalogImportSummary" className="catalog-import-summary" aria-live="polite"><div className="summary-copy"><strong>{emptyReason}</strong><span>{tr("dynamic.summary_help")}</span></div><div className="summary-metrics"><span><small>{tr("dynamic.selected")}</small><strong>{number(breakdown.selected)}</strong></span><span className="ready"><small>{tr("preview.ready")}</small><strong>{number(breakdown.ready)}</strong></span><span className={breakdown.importable ? "ready" : "muted"}><small>{tr("preview.importable")}</small><strong>{number(breakdown.importable)}</strong></span><span className={breakdown.skippedExisting ? "warning" : "muted"}><small>{tr("dynamic.skipped_existing")}</small><strong>{number(breakdown.skippedExisting)}</strong></span><span className={breakdown.draft ? "warning" : "muted"}><small>{tr("preview.draft")}</small><strong>{number(breakdown.draft)}</strong></span></div></div>
          <div id="importResult" className="result-box" data-tone={importResult.tone}>{importResult.message}</div>
        </section>

        <section className="catalog-panel excel-import-panel">
          <div className="panel-head"><div><h2>{tr("excel.title")}</h2><p className="preview-muted">{tr("excel.description")}</p></div><div className="catalog-actions"><button id="csvExportButton" className="btn secondary" type="button" onClick={exportCsv}><i className="bi bi-filetype-csv" aria-hidden="true"></i> {tr("excel.export_csv")}</button><a className="btn excel-download" href="/assets/templates/pos-product-import-template.xlsx" download><i className="bi bi-file-earmark-arrow-down" aria-hidden="true"></i> {tr("excel.download_template")}</a></div></div>
          <label className="excel-dropzone" id="excelDropzone"><input id="excelFile" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" /><i className="bi bi-file-earmark-excel" aria-hidden="true"></i><strong>{tr("excel.drop_title")}</strong><span>{tr("excel.drop_help")}</span></label>
          <div id="excelImportResult" className="result-box" data-tone={excelResult.tone}>{excelResult.message}</div>
          <div id="excelPreview" hidden={!excelRows.length}><div className="excel-preview-head"><strong id="excelPreviewSummary">{excelRows.length ? tr("excel_runtime.preview_summary", { total: number(excelRows.length), valid: number(excelRows.filter(row => !row.errors?.length).length), invalid: number(excelRows.filter(row => row.errors?.length).length) }) : "-"}</strong><button id="excelImportButton" className="btn excel-import-button" type="button" disabled={excelImporting || !excelRows.length}>{tr("excel.import")}</button></div><div className="table-wrap"><table className="catalog-table excel-preview-table"><thead><tr><th>{tr("excel.row")}</th><th>{tr("excel.product_code")}</th><th>{tr("excel.product")}</th><th>{tr("excel.category")}</th><th className="number">{tr("excel.price")}</th><th>{tr("excel.status")}</th></tr></thead><tbody id="excelPreviewRows"></tbody></table></div></div>
        </section>

        <section className="catalog-panel">
          <div className="panel-head"><div><h2>{tr("preview.title")}</h2><p id="previewSummary" className="preview-muted">{tr("dynamic.preview_summary", { selected: number(selectedProducts.length), shown: number(filteredPreview.length), ready: number(breakdown.ready), importable: number(breakdown.importable) })}</p></div><span className="pill">{tr("preview.limit")}</span></div>
          <div className="catalog-filterbar" aria-label={tr("preview.filter_aria")}><label className="catalog-search"><i className="bi bi-search" aria-hidden="true"></i><input id="catalogSearch" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={tr("preview.search_placeholder")} /></label><select id="catalogStatusFilter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label={tr("preview.status_aria")}><option value="all">{tr("preview.all")} ({number(previewCounts.all)})</option><option value="importable">{tr("preview.importable")} ({number(previewCounts.importable)})</option><option value="ready">{tr("preview.ready")} ({number(previewCounts.ready)})</option><option value="existing">{tr("preview.existing")} ({number(previewCounts.existing)})</option><option value="draft">{tr("preview.draft")} ({number(previewCounts.draft)})</option></select><button id="clearCatalogFilters" className="btn filter-clear" type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }}>{tr("preview.clear")}</button></div>
          <div className="table-wrap"><table className="catalog-table"><thead><tr><th>{tr("preview.master_id")}</th><th>{tr("preview.product")}</th><th>{tr("preview.category")}</th><th>{tr("preview.brand")}</th><th className="number">{tr("preview.recommended_price")}</th><th>{tr("preview.barcode")}</th><th>{tr("preview.status")}</th><th>{tr("preview.source")}</th></tr></thead><tbody id="previewRows">{filteredPreview.length ? filteredPreview.slice(0, 50).map(item => {
            const ready = item.catalogStatus === "published"; const exists = isExisting(item); const sources = item.verificationSources || [];
            return <tr key={item.masterProductId}><td>{item.masterProductId}</td><td><strong>{displayName(item)}</strong></td><td>{displayCategory(item)}</td><td>{displayBrand(item)}</td><td className="number">{money(item.price)}</td><td>{item.barcode ? <span className="pill">{item.barcode}</span> : <span className="pill muted">{tr("dynamic.awaiting_review")}</span>}</td><td><span className="status-stack"><span className={`pill ${!ready ? "muted" : exists ? "warning" : ""}`}>{!ready ? tr("dynamic.awaiting_review") : exists ? tr("dynamic.duplicate") : tr("dynamic.ready")}</span><small>{!ready ? tr("dynamic.quality_review") : exists ? tr("dynamic.duplicate_reason") : tr("dynamic.verified_reason")}</small></span></td><td>{sources.length ? <a className="source-link" href={sources[0].url} target="_blank" rel="noopener noreferrer">{sources[0].name}{sources.length > 1 ? ` +${sources.length - 1}` : ""}</a> : <span className="source-empty">—</span>}</td></tr>;
          }) : <tr><td colSpan="8" className="empty-preview">{tr("dynamic.empty")}</td></tr>}</tbody></table></div>
        </section>
      </main>

      <dialog id="importDialog" ref={importDialogRef} className="catalog-dialog" data-pos-supporting-dialog>
        <div className="catalog-dialog-body"><div className="catalog-dialog-icon" aria-hidden="true"><i className="bi bi-check-circle"></i></div><h2>{tr("dialog.title")}</h2><p>{tr("dialog.message", { count: number(pendingRows.length) })}</p><div id="importDialogSummary" className="dialog-summary"><span><small>{tr("dynamic.new_import")}</small><strong id="importDialogCount">{number(pendingRows.length)}</strong></span><span><small>{tr("dynamic.skipped_existing")}</small><strong>{number(breakdown.skippedExisting)}</strong></span><span><small>{tr("preview.draft")}</small><strong>{number(breakdown.draft)}</strong></span></div><p className="preview-muted">{tr("dialog.help")}</p><div className="catalog-dialog-actions"><button id="cancelImport" className="btn secondary" type="button" onClick={() => importDialogRef.current?.close?.()}>{tr("dialog.cancel")}</button><button id="confirmImport" className="btn primary" type="button" onClick={confirmImport}>{tr("dialog.confirm")}</button></div></div>
      </dialog>
    </>
  );
}
