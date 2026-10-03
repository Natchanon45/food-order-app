import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { listPosSales, listPosTaxInvoices } from "@/data/retailPosData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const TAX_LOCAL_KEY = "retail_pos_tax_invoices_v1";
const SALES_LOCAL_KEY = "retail_pos_sales_v1";
const STALE_SYNC_MS = 24 * 60 * 60 * 1000;
const DBD_LOOKUP_URL_KEY = "retail_pos_dbd_lookup_url";
const DEFAULT_DBD_LOOKUP_URL = "/api/tax-buyer/lookup";
const DBD_DATAWAREHOUSE_URL = "https://datawarehouse.dbd.go.th/juristic";
let legacyTaxApiPromise = null;
const legacyTaxApi = () => {
  if (!legacyTaxApiPromise) legacyTaxApiPromise = import(/* @vite-ignore */ "/assets/js/retail-pos-full-tax-invoice.js?v=20260716-017");
  return legacyTaxApiPromise;
};
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const asDate = value => {
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(Number(value.seconds) * 1000);
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};const dateMs = value => asDate(value).getTime();
const normalizeTaxId = value => String(value || "").replace(/\D/g, "").slice(0, 13);
const normalizeText = value => String(value || "").replace(/\s+/g, " ").trim();
const keyOf = invoice => String(invoice?.id || invoice?._documentId || invoice?.invoiceNumber || "").trim();
const saleKey = sale => String(sale?.saleNumber || sale?.number || sale?.id || "").trim();
const sourceSaleKey = invoice => String(invoice?.saleId || invoice?.sourceSale?.id || invoice?.saleNumber || invoice?.sourceSale?.saleNumber || "").trim();
const mergeInvoices = (...groups) => {
  const map = new Map();
  groups.flat().forEach(row => { const key = keyOf(row); if (key) map.set(key, { ...(map.get(key) || {}), ...row }); });
  return [...map.values()].sort((a, b) => dateMs(b.issuedAt || b.updatedAt || b.createdAt) - dateMs(a.issuedAt || a.updatedAt || a.createdAt));
};
const mergeSales = (...groups) => {
  const map = new Map();
  groups.flat().forEach(row => { const key = String(row?.id || row?.saleNumber || row?.number || "").trim(); if (key) map.set(key, { ...(map.get(key) || {}), ...row }); });
  return [...map.values()].sort((a, b) => dateMs(b.createdAt || b.updatedAt) - dateMs(a.createdAt || a.updatedAt));
};
const canRetrySync = invoice => Boolean(invoice?.syncError || ["pending_create", "pending_void", "local_only", "local_void"].includes(String(invoice?.syncStatus || "")));
const canEditPendingBuyer = invoice => invoice?.status !== "void" && ["pending_create", "local_only"].includes(String(invoice?.syncStatus || ""));
const isPendingSync = invoice => Boolean(["pending_create", "pending_void", "local_only", "local_void"].includes(String(invoice?.syncStatus || "")) || invoice?.runningNumberStatus === "local_only");
const shouldEscalateSync = invoice => Boolean(invoice?.syncError && Number(invoice?.syncAttemptCount || 0) >= 3);
const syncReferenceTime = invoice => Number(invoice?.syncAttemptedAt || invoice?.syncErrorAt || invoice?.updatedAt || invoice?.issuedAt || 0);
const shouldShowStaleSync = invoice => Boolean(canRetrySync(invoice) && syncReferenceTime(invoice) && Date.now() - syncReferenceTime(invoice) >= STALE_SYNC_MS);
const staleSyncHours = invoice => syncReferenceTime(invoice) ? Math.floor((Date.now() - syncReferenceTime(invoice)) / 3600000) : 0;
const qualityWarnings = invoice => {
  if (!canRetrySync(invoice)) return [];
  const buyer = invoice?.buyer || {}; const rows = [];
  if (canEditPendingBuyer(invoice) && !String(buyer.buyerName || "").trim()) rows.push("missing_buyer_name");
  if (canEditPendingBuyer(invoice) && !normalizeTaxId(buyer.buyerTaxId)) rows.push("missing_buyer_tax_id");
  if (!sourceSaleKey(invoice)) rows.push("missing_source_receipt");
  return rows;
};const needsQualityReview = invoice => qualityWarnings(invoice).length > 0;
const syncFilterForInvoice = invoice => shouldEscalateSync(invoice) ? "support" : invoice?.syncError ? "error" : shouldShowStaleSync(invoice) ? "stale" : needsQualityReview(invoice) ? "review" : isPendingSync(invoice) ? "pending" : "all";
const invoiceMatchesSyncFilter = (invoice, filter) => {
  if (filter === "error") return Boolean(invoice?.syncError);
  if (filter === "pending") return isPendingSync(invoice);
  if (filter === "support") return shouldEscalateSync(invoice);
  if (filter === "stale") return shouldShowStaleSync(invoice);
  if (filter === "review") return needsQualityReview(invoice);
  return true;
};
const sourceFilterForInvoice = invoice => invoice?._syncSourceLocal && invoice?._syncSourceRemote ? "both" : invoice?._syncSourceRemote ? "remote" : invoice?._syncSourceLocal ? "local" : "all";
const copyText = async value => {
  if (navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(value); return; } catch {} }
  const area = document.createElement("textarea"); area.value = value; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
  document.body.appendChild(area); area.select(); const ok = document.execCommand("copy"); area.remove(); if (!ok) throw new Error("COPY_FAILED");
};
const normalizeDbdProfile = (data = {}, fallbackTaxId = "", headOffice = "สำนักงานใหญ่") => {
  const source = data.data || data.result || data.profile || data;
  return {
    buyerName: normalizeText(source.buyerName || source.juristicNameTH || source.juristicName || source.nameTh || source.name || source.companyName || ""),
    buyerTaxId: normalizeTaxId(source.buyerTaxId || source.juristicId || source.registrationNo || source.taxId || source.id || fallbackTaxId),
    buyerAddress: normalizeText(source.buyerAddress || source.addressTh || source.address || source.location || ""),
    buyerBranchName: normalizeText(source.buyerBranchName || source.branchName || source.branch || headOffice) || headOffice,
  };
};
const sourceReceiptUrl = invoice => {
  const id = String(invoice?.saleId || invoice?.sourceSale?.id || "").trim();
  return id ? "/pos/receipt/?saleId=" + encodeURIComponent(id) + "&auto=0" : "";
};
const taxInvoiceUrl = invoice => "/pos/tax-invoice/?invoiceId=" + encodeURIComponent(keyOf(invoice)) + "&auto=0";

export function PosTaxInvoicesPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber, formatDate } = useI18n();
  const tr = useCallback((key, replacements = {}) => t("pos_tax_invoices.dynamic." + key, replacements), [t]);  const stylesReady = useParityPage({
    title: t("pos_tax_invoices.meta_title"),
    attributes: { "data-module": "retail-pos-tax-invoices" },
    bodyClass: "tax-invoices-page",
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: ["app-version-badge-runtime.css", "pos-locale-switcher-placement.css", "retail-pos.css", "retail-pos-navigation.css", "pos-tax-invoices-page.css"],
  });
  const lateDialogRef = useRef(null), profileDialogRef = useRef(null), voidDialogRef = useRef(null), editDialogRef = useRef(null);
  const [invoices, setInvoices] = useState([]), [sales, setSales] = useState([]), [profiles, setProfiles] = useState([]);
  const [initialDataReady, setInitialDataReady] = useState(false), [refreshBusy, setRefreshBusy] = useState(false), [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get("q") || "");
  const [syncFilter, setSyncFilter] = useState(() => ["all","error","pending","support","stale","review"].includes(new URLSearchParams(location.search).get("sync")) ? new URLSearchParams(location.search).get("sync") : "all");
  const [sourceFilter, setSourceFilter] = useState(() => ["all","remote","local","both"].includes(new URLSearchParams(location.search).get("source")) ? new URLSearchParams(location.search).get("source") : "all");
  const [syncHealth, setSyncHealth] = useState({ checkedAt: 0, pendingTaxError: "", profileError: "", remoteListError: "" });
  const [sourceQuery, setSourceQuery] = useState(""), [sourceResult, setSourceResult] = useState(null), [sourceBusy, setSourceBusy] = useState(false), [currentSourceSale, setCurrentSourceSale] = useState(null);
  const blankBuyer = useMemo(() => ({ buyerTaxId: "", buyerName: "", buyerBranchName: tr("head_office"), buyerAddress: "" }), [tr]);
  const [lateBuyer, setLateBuyer] = useState(blankBuyer), [lateBusy, setLateBusy] = useState(false), [lateDbdBusy, setLateDbdBusy] = useState(false), [lateError, setLateError] = useState(""), [lateManualUrl, setLateManualUrl] = useState("");
  const [profileForm, setProfileForm] = useState({ id: "", buyerTaxId: "", buyerName: "", buyerBranchName: "", buyerAddress: "" }), [profileError, setProfileError] = useState(""), [profileBusy, setProfileBusy] = useState(false);
  const [voidInvoice, setVoidInvoice] = useState(null), [voidReason, setVoidReason] = useState(""), [voidError, setVoidError] = useState(""), [voidBusy, setVoidBusy] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null), [editBuyer, setEditBuyer] = useState(blankBuyer), [editError, setEditError] = useState(""), [editBusy, setEditBusy] = useState(false), [editDbdBusy, setEditDbdBusy] = useState(false), [editManualUrl, setEditManualUrl] = useState("");
  const [retryingId, setRetryingId] = useState(""), [copiedId, setCopiedId] = useState(""), [viewCopied, setViewCopied] = useState(false);
  const posSession = useMemo(() => getRetailPosSession(), [authUser?.uid, profile?.id, profile?.uid, profile?.tenantId, profile?.role, profile?.roleId]);
  const posAccessProfile = useMemo(() => ({ ...(profile || {}), ...(posSession || {}), role: posSession?.role || profile?.role || profile?.roleId || "", roleId: posSession?.roleId || posSession?.role || profile?.roleId || profile?.role || "" }), [profile, posSession]);
  const posPermissions = useMemo(() => getPosPermissions(posAccessProfile), [posAccessProfile]);
  const hasAccess = posPermissions.has("pos.tax_invoices");  const posRedirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!hasAccess) {
      const firstAllowed = firstAllowedPosPage(posAccessProfile);
      return firstAllowed === "/pos/forbidden" ? "/pos/forbidden/?permission=pos.tax_invoices&next=" + encodeURIComponent(requested) : firstAllowed + "?from=permission";
    }
    return "";
  }, [authState.status, tenantState.status, tenant?.id, profile, posAccessProfile, hasAccess, stylesReady]);
  useEffect(() => { if (posRedirectTarget) location.replace(posRedirectTarget); }, [posRedirectTarget]);

  const refresh = useCallback(async ({ sync = true } = {}) => {
    if (!tenant?.id || !profile || !canUseRetailPos(posAccessProfile) || !hasAccess) return;
    setRefreshBusy(true); setLoadError("");
    const health = { checkedAt: Date.now(), pendingTaxError: "", profileError: "", remoteListError: "" };
    try {
      const api = await legacyTaxApi();
      if (sync) { try { await api.syncPendingTaxInvoices(); } catch (error) { health.pendingTaxError = tr("invoice_load_error", { error: String(error?.message || error || "").slice(0, 90) }); } }
      try { await api.syncTaxBuyerProfiles(); } catch (error) { health.profileError = tr("profile_load_error", { error: String(error?.message || error || "").slice(0, 90) }); }
      let remoteInvoices = [];
      try { remoteInvoices = await listPosTaxInvoices(tenant.id); } catch (error) { health.remoteListError = tr("remote_load_error", { error: String(error?.message || error || "").slice(0, 90) }); }
      const remoteSales = await listPosSales(tenant.id).catch(() => []);
      const localInvoices = (readJson(TAX_LOCAL_KEY, []) || []).map(row => ({ ...row, _syncSourceLocal: true }));
      const markedRemote = remoteInvoices.map(row => ({ ...row, _syncSourceRemote: true }));
      setInvoices(mergeInvoices(localInvoices, markedRemote));
      setSales(mergeSales(readJson(SALES_LOCAL_KEY, []), remoteSales));
      try { setProfiles(api.listTaxBuyerProfiles()); } catch { setProfiles([]); }
      setSyncHealth(health);
    } catch (error) {
      console.error("POS_TAX_INVOICES_LOAD_FAILED", error);
      setLoadError(String(error?.message || "POS_TAX_INVOICES_LOAD_FAILED"));
    } finally { setInitialDataReady(true); setRefreshBusy(false); }
  }, [tenant?.id, profile, posAccessProfile, hasAccess, tr]);  useEffect(() => {
    if (!posRedirectTarget && tenant?.id && profile && hasAccess) refresh({ sync: true });
  }, [tenant?.id, profile, hasAccess, posRedirectTarget, refresh]);
  useEffect(() => {
    const storage = event => { if (!event.key || event.key === TAX_LOCAL_KEY) refresh({ sync: false }); };
    const online = () => refresh({ sync: true });
    window.addEventListener("storage", storage); window.addEventListener("online", online);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener("online", online); };
  }, [refresh]);
  useEffect(() => {
    if (!initialDataReady) return;
    const url = new URL(location.href);
    if (search.trim()) url.searchParams.set("q", search.trim()); else url.searchParams.delete("q");
    if (syncFilter !== "all") url.searchParams.set("sync", syncFilter); else url.searchParams.delete("sync");
    if (sourceFilter !== "all") url.searchParams.set("source", sourceFilter); else url.searchParams.delete("source");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [search, syncFilter, sourceFilter, initialDataReady]);

  const money = value => formatNumber(Number(value || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateText = value => formatDate(asDate(value), { dateStyle: "medium", timeStyle: "short" });
  const invoiceSourceText = invoice => invoice?._syncSourceLocal && invoice?._syncSourceRemote ? tr("source_both") : invoice?._syncSourceRemote ? tr("source_remote") : invoice?._syncSourceLocal ? tr("source_local") : tr("source_unknown");
  const recoveryRecommendation = invoice => {
    if (!canRetrySync(invoice)) return "";
    if (shouldEscalateSync(invoice)) return tr("recommend_support");
    const warnings = qualityWarnings(invoice);
    if (warnings.some(key => ["missing_buyer_name","missing_buyer_tax_id"].includes(key))) return tr("recommend_edit_buyer");
    if (warnings.includes("missing_source_receipt")) return tr("recommend_source_receipt");
    if (shouldShowStaleSync(invoice)) return tr("recommend_stale");
    if (invoice.syncError) return tr("recommend_retry_or_copy");
    return tr("recommend_retry");
  };
  const syncDiagnosticText = invoice => {
    const parts = invoice.syncError ? [tr("diagnostic_error", { error: invoice.syncError })] : [];
    const job = [invoice.syncAction, invoice.syncPhase].filter(Boolean).join(" / "); if (job) parts.push(tr("diagnostic_job", { job }));
    if (Number(invoice.syncAttemptCount || 0) > 0) parts.push(tr("diagnostic_attempts", { count: Number(invoice.syncAttemptCount || 0) }));
    if (syncReferenceTime(invoice)) parts.push(tr("diagnostic_latest", { date: dateText(syncReferenceTime(invoice)) }));
    if (shouldShowStaleSync(invoice)) parts.push(tr("diagnostic_stale_hours", { count: staleSyncHours(invoice) }));
    if (needsQualityReview(invoice)) parts.push(tr("diagnostic_review", { warnings: qualityWarnings(invoice).map(tr).join(", ") }));
    if (shouldEscalateSync(invoice)) parts.push(tr("diagnostic_escalate"));
    const recommendation = recoveryRecommendation(invoice); if (recommendation) parts.push(recommendation);
    return parts.join(" • ");
  };  const invoiceSearchText = invoice => {
    const buyer = invoice.buyer || {}, seller = invoice.seller || {};
    return [invoice.invoiceNumber, invoice.saleNumber, invoice.saleId, buyer.buyerName, buyer.buyerTaxId, buyer.buyerAddress, seller.sellerName, invoice.status, invoice.syncStatus, invoice.syncAction, invoice.syncPhase, invoice.syncTargetId, invoice.syncError, invoiceSourceText(invoice), recoveryRecommendation(invoice), ...qualityWarnings(invoice).map(tr)].join(" ").toLowerCase();
  };
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter(invoice => {
      const syncOk = invoiceMatchesSyncFilter(invoice, syncFilter);
      const sourceKey = sourceFilterForInvoice(invoice);
      const sourceOk = sourceFilter === "all" || sourceKey === sourceFilter;
      return syncOk && sourceOk && (!q || invoiceSearchText(invoice).includes(q));
    });
  }, [invoices, search, syncFilter, sourceFilter, t]);
  const counts = useMemo(() => ({
    all: invoices.length, error: invoices.filter(i => i.syncError).length, pending: invoices.filter(isPendingSync).length,
    support: invoices.filter(shouldEscalateSync).length, stale: invoices.filter(shouldShowStaleSync).length, review: invoices.filter(needsQualityReview).length,
    remote: invoices.filter(i => i._syncSourceRemote && !i._syncSourceLocal).length, local: invoices.filter(i => i._syncSourceLocal && !i._syncSourceRemote).length,
    both: invoices.filter(i => i._syncSourceLocal && i._syncSourceRemote).length,
  }), [invoices]);
  const syncFilterLabel = syncFilter === "error" ? tr("sync_failed") : syncFilter === "pending" ? tr("pending_sync") : syncFilter === "support" ? tr("send_support") : syncFilter === "stale" ? tr("sync_stale") : syncFilter === "review" ? tr("review_data") : tr("all");
  const sourceFilterLabel = sourceFilter === "remote" ? tr("remote_only") : sourceFilter === "local" ? tr("local_only") : sourceFilter === "both" ? tr("both") : tr("all_sources");
  const resetFilters = () => { setSearch(""); setSyncFilter("all"); setSourceFilter("all"); };
  const openInvoice = invoice => window.open(taxInvoiceUrl(invoice), "_blank", "noopener,noreferrer");
  const findSale = query => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return null;
    return sales.find(s => [s.id,s.saleNumber,s.number].some(v => String(v || "").trim().toLowerCase() === q)) || sales.find(s => [s.id,s.saleNumber,s.number,s.customerName,s.customerPhone,s.customerCode].join(" ").toLowerCase().includes(q)) || null;
  };
  const existingInvoiceForSale = sale => {
    const id = String(sale?.id || ""), number = String(sale?.saleNumber || sale?.number || "");
    return invoices.find(row => (id && String(row.saleId || row.sourceSale?.id || "") === id) || (number && String(row.saleNumber || row.sourceSale?.saleNumber || "") === number)) || null;
  };  const showLateDialog = async sale => {
    const api = await legacyTaxApi(); const defaults = api.defaultBuyerFromSale(sale) || {};
    setCurrentSourceSale(sale); setLateBuyer({ buyerTaxId: defaults.buyerTaxId || "", buyerName: defaults.buyerName || "", buyerBranchName: defaults.buyerBranchName || tr("head_office"), buyerAddress: defaults.buyerAddress || "" });
    setLateError(""); setLateManualUrl(""); lateDialogRef.current?.showModal?.();
  };
  const findSourceSale = async () => {
    if (!sourceQuery.trim()) { setSourceResult({ error: tr("source_required") }); return; }
    setSourceBusy(true); setSourceResult({ message: tr("searching_receipt") });
    try {
      const remoteSales = tenant?.id ? await listPosSales(tenant.id).catch(() => []) : [];
      const nextSales = mergeSales(readJson(SALES_LOCAL_KEY, []), remoteSales);
      setSales(nextSales);
      const q = sourceQuery.trim().toLowerCase();
      const sale = nextSales.find(row => [row.id,row.saleNumber,row.number].some(value => String(value || "").trim().toLowerCase() === q))
        || nextSales.find(row => [row.id,row.saleNumber,row.number,row.customerName,row.customerPhone,row.customerCode].join(" ").toLowerCase().includes(q))
        || null;
      if (!sale) { setSourceResult({ error: tr("source_not_found") }); return; }
      const existing = existingInvoiceForSale(sale);
      if (existing) { setSourceResult({ sale, existing }); openInvoice(existing); return; }
      setSourceResult({ sale }); await showLateDialog(sale);
    } finally { setSourceBusy(false); }
  };
  const lookupDbd = async (buyer, setBuyer, setError, setManual, setBusy, successKey) => {
    const taxId = normalizeTaxId(buyer.buyerTaxId);
    setBuyer(current => ({ ...current, buyerTaxId: taxId })); setError(""); setManual("");
    if (taxId.length < 13) { setError(tr("tax_id_required")); return; }
    setBusy(true);
    try {
      const endpoint = window.RETAIL_POS_DBD_LOOKUP_URL || localStorage.getItem(DBD_LOOKUP_URL_KEY) || DEFAULT_DBD_LOOKUP_URL;
      const url = new URL(endpoint, location.origin); url.searchParams.set("taxId", taxId);
      const response = await fetch(url.toString(), { headers: { accept: "application/json" } }); if (!response.ok) throw new Error("DBD_" + response.status);
      const row = normalizeDbdProfile(await response.json(), taxId, tr("head_office")); if (!row.buyerName && !row.buyerAddress) throw new Error("DBD_NOT_FOUND");
      setBuyer(row); setError(tr(successKey));
    } catch { setError(tr("dbd_auto_failed")); setManual(DBD_DATAWAREHOUSE_URL + "?keyword=" + encodeURIComponent(taxId)); }
    finally { setBusy(false); }
  };
  const submitLate = async event => {
    event.preventDefault(); if (!currentSourceSale) return; setLateBusy(true); setLateError("");
    try { const api = await legacyTaxApi(); const invoice = await api.createFullTaxInvoiceFromSale(currentSourceSale, lateBuyer); lateDialogRef.current?.close?.(); openInvoice(invoice); setSourceResult({ sale: currentSourceSale, issued: invoice }); await refresh({ sync: false }); }
    catch (error) { setLateError(String(error?.message || tr("issue_failed"))); }
    finally { setLateBusy(false); }
  };  const applyProfile = profileRow => setProfileForm({ id: profileRow?.id || profileRow?.customerKey || "", buyerTaxId: profileRow?.buyerTaxId || "", buyerName: profileRow?.buyerName || "", buyerBranchName: profileRow?.buyerBranchName || tr("head_office"), buyerAddress: profileRow?.buyerAddress || "" });
  const openProfiles = async () => {
    const api = await legacyTaxApi();
    let rows = api.listTaxBuyerProfiles();
    setProfiles(rows); applyProfile(rows[0] || {}); setProfileError(""); profileDialogRef.current?.showModal?.();
    try {
      await api.syncTaxBuyerProfiles();
      rows = api.listTaxBuyerProfiles();
      setProfiles(rows);
      applyProfile(rows.find(row => String(row.id || row.customerKey || "") === String(profileForm.id || "")) || rows[0] || {});
    } catch (error) {
      console.warn("POS_TAX_BUYER_PROFILE_SYNC_FAILED", error);
    }
  };
  const saveProfile = async event => {
    event.preventDefault(); setProfileBusy(true); setProfileError("");
    try { const api = await legacyTaxApi(); const saved = api.saveTaxBuyerProfile({ ...profileForm, customerKey: profileForm.id || normalizeTaxId(profileForm.buyerTaxId) || profileForm.buyerName }); try { await api.syncTaxBuyerProfiles(); } catch {} const rows = api.listTaxBuyerProfiles(); setProfiles(rows); applyProfile(rows.find(row => String(row.id || row.customerKey) === String(saved.id || saved.customerKey)) || saved); }
    catch (error) { setProfileError(String(error?.message || tr("profile_save_failed"))); } finally { setProfileBusy(false); }
  };
  const deleteProfile = async () => {
    if (!profileForm.id || !window.confirm(tr("profile_delete_confirm"))) return; setProfileBusy(true);
    try { const api = await legacyTaxApi(); api.deleteTaxBuyerProfile(profileForm.id); try { await api.syncTaxBuyerProfiles(); } catch {} const rows = api.listTaxBuyerProfiles(); setProfiles(rows); applyProfile(rows[0] || {}); }
    finally { setProfileBusy(false); }
  };
  const showVoid = invoice => { setVoidInvoice(invoice); setVoidReason(""); setVoidError(""); voidDialogRef.current?.showModal?.(); };
  const submitVoid = async event => {
    event.preventDefault(); if (!voidInvoice) return; setVoidBusy(true); setVoidError("");
    try { const api = await legacyTaxApi(); await api.voidFullTaxInvoice(voidInvoice, voidReason); voidDialogRef.current?.close?.(); setVoidInvoice(null); await refresh({ sync: false }); }
    catch (error) { setVoidError(String(error?.message || tr("void_failed"))); } finally { setVoidBusy(false); }
  };
  const showEdit = invoice => { const buyer = invoice.buyer || {}; setEditInvoice(invoice); setEditBuyer({ buyerTaxId: buyer.buyerTaxId || "", buyerName: buyer.buyerName || "", buyerBranchName: buyer.buyerBranchName || tr("head_office"), buyerAddress: buyer.buyerAddress || "" }); setEditError(""); setEditManualUrl(""); editDialogRef.current?.showModal?.(); };
  const submitEdit = async event => {
    event.preventDefault(); if (!editInvoice) return; setEditBusy(true); setEditError("");
    try { const api = await legacyTaxApi(); api.updateLocalTaxInvoiceBuyer(editInvoice, editBuyer); editDialogRef.current?.close?.(); setEditInvoice(null); await refresh({ sync: false }); }
    catch (error) { setEditError(String(error?.message || tr("buyer_save_failed"))); } finally { setEditBusy(false); }
  };
  const retrySync = async invoice => { const id = keyOf(invoice); setRetryingId(id); try { const api = await legacyTaxApi(); await api.retryTaxInvoiceSync(invoice); await refresh({ sync: false }); } finally { setRetryingId(""); } };  const recoveryText = invoice => [
    tr("recovery_title"), "Invoice ID: " + (keyOf(invoice) || "-"), "Invoice No: " + (invoice.invoiceNumber || "-"),
    "Sale: " + (invoice.saleNumber || invoice.saleId || invoice.sourceSale?.saleNumber || invoice.sourceSale?.id || "-"),
    "Source Receipt: " + (sourceReceiptUrl(invoice) || "-"), "Buyer: " + (invoice.buyer?.buyerName || "-"), "Status: " + (invoice.status || "-"),
    tr("recovery_sync_status") + ": " + (invoice.syncStatus || "-"), tr("recovery_action") + ": " + (invoice.syncAction || "-"),
    tr("recovery_phase") + ": " + (invoice.syncPhase || "-"), tr("recovery_target") + ": " + (invoice.syncTargetId || "-"),
    tr("recovery_error") + ": " + (invoice.syncError || "-"), tr("recovery_attempts") + ": " + Number(invoice.syncAttemptCount || 0),
    "Recommended Action: " + (recoveryRecommendation(invoice) || "-"), "Data Source: " + invoiceSourceText(invoice),
  ].join("\n");
  const copyDiagnostics = async invoice => { const id = keyOf(invoice); try { await copyText(recoveryText(invoice)); setCopiedId(id); setTimeout(() => setCopiedId(current => current === id ? "" : current), 1200); } catch {} };
  const syncBadges = invoice => {
    const badges = [];
    const status = String(invoice?.syncStatus || "");
    if (invoice?.syncError) {
      badges.push(["error", "is-error", tr("sync_failed")]);
      if (shouldEscalateSync(invoice)) badges.push(["support", "is-pending", tr("send_support")]);
    } else if (["pending_create", "pending_void"].includes(status)) {
      badges.push(["pending", "is-pending", tr("pending_sync")]);
    } else if (["local_only", "local_void"].includes(status)) {
      badges.push(["local", "is-local", tr("local_document")]);
    } else if (invoice?.runningNumberStatus === "local_only") {
      badges.push(["temporary", "is-local", tr("temporary_number")]);
    }
    if (shouldShowStaleSync(invoice)) badges.push(["stale", "is-pending", tr("sync_stale")]);
    if (needsQualityReview(invoice)) badges.push(["review", "is-pending", tr("review_data")]);
    return badges.map(([key, className, label]) => <span key={key} className={"sync-badge " + className}>{label}</span>);
  };
  const copyViewLink = async () => { try { await copyText(location.href); setViewCopied(true); setTimeout(() => setViewCopied(false), 1200); } catch {} };
  const copyManual = async (url, setError) => { try { await copyText(url); setError(tr("dbd_link_copied")); } catch { setError(tr("copy_link_manually", { url })); } };
  const needsReadyOverlay = authState.status === "loading" || tenantState.status === "loading" || !stylesReady || Boolean(posRedirectTarget) || (tenant?.id && profile && hasAccess && !initialDataReady);
  if (needsReadyOverlay) return <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  if (loadError) return <PageReadyOverlay error title={t("pos_tax_invoices.meta_title")} message={loadError} onRetry={() => location.reload()} />;

  const hasActiveFilters = Boolean(search.trim() || syncFilter !== "all" || sourceFilter !== "all");
  const healthErrors = [syncHealth.pendingTaxError, syncHealth.profileError, syncHealth.remoteListError].filter(Boolean);
  const healthHasErrors = counts.error > 0 || healthErrors.length > 0;
  const healthHasWarnings = counts.pending > 0 || counts.stale > 0 || counts.review > 0 || counts.support > 0;
  const healthTitle = healthHasErrors ? tr("health_error") : healthHasWarnings ? tr("health_warning") : tr("health_ok");
  const healthClass = healthHasErrors ? " is-error" : healthHasWarnings ? " is-warning" : "";
  const filterButtons = [
    ["all","all","x-circle","rose"],
    ["error","sync_failed","cursor","green"],
    ["pending","pending_sync","cursor","green"],
    ["support","send_support","cursor","green"],
    ["stale","sync_stale","cursor","green"],
    ["review","review_data","cursor","green"],
  ];
  const sourceButtons = [
    ["all","all_sources","cursor","green"],
    ["remote","remote_only","sliders","slate"],
    ["local","local_only","cursor","green"],
    ["both","both","cursor","green"],
  ];
  const healthIcon = (name, tone = "green") => <i className={"bi bi-" + name + " pos-context-icon"} data-icon-tone={tone} aria-hidden="true"></i>;
  return <>
    <header className="pos-header no-print" data-pos-supporting-header><div className="app-title"><div><strong>{t("pos_tax_invoices.title")}</strong><small>{t("pos_tax_invoices.subtitle")}</small></div></div>
      <div className="header-actions">
        <button id="refreshBtn" className="btn btn-primary" type="button" disabled={refreshBusy} onClick={() => refresh({ sync: true })}><i className={"bi " + (refreshBusy ? "bi-hourglass-split" : "bi-arrow-clockwise")} aria-hidden="true"></i><span>{refreshBusy ? tr("loading") : t("pos_tax_invoices.refresh")}</span></button>
        <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} /><PosNavigation profile={posAccessProfile} currentKey="pos.tax_invoices" /></div></header>
    <main className="shell" data-pos-supporting="tax-invoices">
      <section className="panel issue-panel"><h2><i className="bi bi-receipt pos-context-icon" data-icon-tone="green" aria-hidden="true"></i><span>{t("pos_tax_invoices.issue_title")}</span></h2><p>{t("pos_tax_invoices.issue_description")}</p>
        <div className="issue-row"><label>{t("pos_tax_invoices.source_receipt")}<input id="sourceSaleSearch" value={sourceQuery} onChange={e => setSourceQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); findSourceSale(); } }} autoComplete="off" placeholder={t("pos_tax_invoices.source_placeholder")} /></label>
          <button id="findSourceSaleBtn" className="btn btn-primary" type="button" disabled={sourceBusy} onClick={findSourceSale}><i className={"bi " + (sourceBusy ? "bi-hourglass-split" : "bi-search")} aria-hidden="true"></i><span>{sourceBusy ? tr("searching") : t("pos_tax_invoices.find_receipt")}</span></button></div>
        <div id="sourceSaleResult" className={"issue-result" + (sourceResult?.error ? " is-error" : "")}>{sourceResult?.error || sourceResult?.message || null}
          {sourceResult?.sale ? <div className="issue-sale-card"><div><strong>{saleKey(sourceResult.sale)}</strong><div>{dateText(sourceResult.sale.createdAt)} • {tr("net_total", { amount: money(sourceResult.sale.totalAmount ?? sourceResult.sale.total) })}</div></div>
            {sourceResult.existing ? <button className="btn btn-secondary" type="button" onClick={() => openInvoice(sourceResult.existing)}>{tr("open_existing")}</button> : sourceResult.issued ? <a className="btn btn-primary" href={taxInvoiceUrl(sourceResult.issued)} target="_blank" rel="noopener">{tr("open_print")}</a> : <button className="btn btn-primary" type="button" onClick={() => showLateDialog(sourceResult.sale)}>{tr("issue_invoice")}</button>}</div> : null}</div></section>
      <section className="panel"><div className="filter-row"><input id="taxInvoiceSearch" className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("pos_tax_invoices.search_placeholder")} />
        <button id="taxProfileBtn" className="btn btn-secondary" type="button" onClick={openProfiles}><i className="bi bi-people" aria-hidden="true"></i><span>{t("pos_tax_invoices.profiles")}</span></button>
        <a className="btn btn-secondary" href="/pos/tax-invoice/" target="_blank" rel="noopener"><i className="bi bi-file-earmark-text" aria-hidden="true"></i><span>{t("pos_tax_invoices.blank_print")}</span></a></div>
        <div className="tax-sync-filters" aria-label={t("pos_tax_invoices.sync_filter_label")}>{filterButtons.map(([key,label,icon,tone]) => <button key={key} className={"tax-sync-filter" + (syncFilter === key ? " is-active" : "")} data-tax-sync-filter={key} type="button" onClick={() => setSyncFilter(key)}><i className={"bi bi-" + icon + " pos-context-icon"} data-icon-tone={tone} aria-hidden="true"></i>{key === "all" ? t("pos_tax_invoices.all") : tr(label)} <span data-tax-sync-count>{counts[key] || 0}</span></button>)}</div>
        <div className="tax-sync-filters" aria-label={t("pos_tax_invoices.source_filter_label")}>{sourceButtons.map(([key,label,icon,tone]) => <button key={key} className={"tax-sync-filter" + (sourceFilter === key ? " is-active" : "")} data-tax-source-filter={key} type="button" onClick={() => setSourceFilter(key)}><i className={"bi bi-" + icon + " pos-context-icon"} data-icon-tone={tone} aria-hidden="true"></i>{key === "all" ? t("pos_tax_invoices.all_sources") : tr(label)} <span data-tax-source-count>{counts[key] || 0}</span></button>)}<button id="copyTaxViewLinkBtn" className="btn btn-secondary" type="button" onClick={copyViewLink}><i className={"bi " + (viewCopied ? "bi-check-lg" : "bi-link-45deg")} aria-hidden="true"></i><span>{viewCopied ? tr("copied") : t("pos_tax_invoices.copy_view_link")}</span></button></div>        <div id="taxSyncHealth" className={"tax-sync-health" + healthClass} aria-live="polite"><div className="tax-sync-health-main"><p className="tax-sync-health-title">{healthTitle}</p><p className="tax-sync-health-state">{tr("last_checked")} <strong>{syncHealth.checkedAt ? dateText(syncHealth.checkedAt) : tr("not_checked")}</strong>{healthErrors.length ? " • " + healthErrors.join(" • ") : ""}</p></div>
          <div className="tax-sync-health-grid"><button className="tax-sync-health-chip" type="button" onClick={resetFilters}>{healthIcon("x-circle","rose")}{tr("all")} <strong>{counts.all}</strong></button><button className={"tax-sync-health-chip" + (counts.error ? " is-error" : "")} type="button" onClick={() => setSyncFilter("error")}>{healthIcon("cursor")}{tr("sync_failed")} <strong>{counts.error}</strong></button><button className={"tax-sync-health-chip" + (counts.pending ? " is-warning" : "")} type="button" onClick={() => setSyncFilter("pending")}>{healthIcon("cursor")}{tr("pending_sync")} <strong>{counts.pending}</strong></button><button className={"tax-sync-health-chip" + (counts.stale ? " is-warning" : "")} type="button" onClick={() => setSyncFilter("stale")}>{healthIcon("cursor")}{tr("sync_stale")} <strong>{counts.stale}</strong></button><button className={"tax-sync-health-chip" + (counts.review ? " is-warning" : "")} type="button" onClick={() => setSyncFilter("review")}>{healthIcon("cursor")}{tr("review_data")} <strong>{counts.review}</strong></button><button className="tax-sync-health-chip" type="button" onClick={() => setSourceFilter("remote")}>{healthIcon("sliders","slate")}{tr("source_remote")} <strong>{counts.remote}</strong></button><button className={"tax-sync-health-chip" + (counts.local ? " is-muted" : "")} type="button" onClick={() => setSourceFilter("local")}>{healthIcon("cursor")}{tr("source_local")} <strong>{counts.local}</strong></button><button className="tax-sync-health-chip" type="button" onClick={() => setSourceFilter("both")}>{healthIcon("cursor")}{tr("both")} <strong>{counts.both}</strong></button></div></div>
        <div id="summaryText" className="summary">{tr("summary", { total: counts.all, status: syncFilterLabel, source: sourceFilterLabel, shown: filtered.length })}</div>
        <div id="taxInvoiceList" className="list">{filtered.map(invoice => { const buyer = invoice.buyer || {}, seller = invoice.seller || {}, id = keyOf(invoice), diag = syncDiagnosticText(invoice), receiptUrl = sourceReceiptUrl(invoice); return <article className="tax-card" key={id}><div className="tax-card-main"><div className="tax-card-badges"><div className="tax-doc-no">{invoice.invoiceNumber || id || "-"}</div>{syncBadges(invoice)}</div><h2><i className="bi bi-bookmark-star pos-context-icon" data-icon-tone="green" aria-hidden="true"></i><span>{buyer.buyerName || "-"}</span></h2><div className="tax-meta"><span>{tr("data_source")}: {invoiceSourceText(invoice)}</span><span>{tr("tax_id")}: {buyer.buyerTaxId || "-"}</span><span>{tr("receipt")}: {invoice.saleNumber || invoice.saleId || "-"}</span><span>{dateText(invoice.issuedAt || invoice.createdAt)}</span></div><p>{buyer.buyerAddress || ""}</p><small>{tr("seller")}: {seller.sellerName || "-"} • {invoice.status === "void" ? tr("voided") : tr("issued")}{invoice.voidReason ? " • " + tr("reason") + ": " + invoice.voidReason : ""}{diag ? " • " + diag : ""}</small></div><div className="tax-card-side"><strong>{money(invoice.totalAmount)}</strong><span>VAT {money(invoice.vatAmount)}</span><div className="tax-actions"><a className="btn btn-primary" href={taxInvoiceUrl(invoice)} target="_blank" rel="noopener"><i className="bi bi-printer"></i><span>{tr("open_print")}</span></a>{receiptUrl ? <a className="btn btn-secondary" href={receiptUrl} target="_blank" rel="noopener"><i className="bi bi-receipt"></i><span>{tr("view_source_receipt")}</span></a> : null}{canEditPendingBuyer(invoice) ? <button className="btn btn-secondary" type="button" onClick={() => showEdit(invoice)}><i className="bi bi-pencil-square"></i><span>{tr("edit_buyer")}</span></button> : null}{canRetrySync(invoice) ? <button className="btn btn-secondary" type="button" onClick={() => copyDiagnostics(invoice)}><i className={"bi " + (copiedId === id ? "bi-check-lg" : "bi-clipboard")}></i><span>{copiedId === id ? tr("copied") : tr("copy_diagnostics")}</span></button> : null}{canRetrySync(invoice) ? <button className="btn btn-secondary" type="button" disabled={retryingId === id} onClick={() => retrySync(invoice)}><i className={"bi " + (retryingId === id ? "bi-hourglass-split" : "bi-arrow-repeat")}></i><span>{retryingId === id ? tr("syncing") : tr("retry_sync")}</span></button> : null}{invoice.status === "void" ? null : <button className="btn btn-danger" type="button" onClick={() => showVoid(invoice)}><i className="bi bi-x-circle"></i><span>{tr("void")}</span></button>}</div></div></article>; })}</div>
        <div id="emptyState" className="empty" hidden={filtered.length > 0}>{hasActiveFilters ? <>{tr("filtered_empty")} <button className="btn btn-secondary" type="button" onClick={resetFilters}>{tr("clear_filters")}</button></> : t("pos_tax_invoices.empty")}</div>
      </section></main>    <dialog id="lateTaxInvoiceDialog" ref={lateDialogRef} className="tax-dialog"><form id="lateTaxInvoiceForm" className="tax-form" method="dialog" onSubmit={submitLate}><div><h2>{t("pos_tax_invoices.buyer_dialog_title")}</h2><p id="lateTaxInvoiceSaleText">{currentSourceSale ? tr("sale_summary", { receipt: saleKey(currentSourceSale), date: dateText(currentSourceSale.createdAt), amount: money(currentSourceSale.totalAmount ?? currentSourceSale.total) }) : "-"}</p></div>
      <label>{t("pos_tax_invoices.tax_id")}<div className="tax-id-control"><input id="lateBuyerTaxIdInput" value={lateBuyer.buyerTaxId} onChange={e => setLateBuyer({ ...lateBuyer, buyerTaxId: e.target.value })} autoComplete="off" inputMode="numeric" maxLength={13}/><button id="lateDbdLookupBtn" className="dbd-btn" type="button" disabled={lateBusy || lateDbdBusy} onClick={() => lookupDbd(lateBuyer,setLateBuyer,setLateError,setLateManualUrl,setLateDbdBusy, "dbd_issue_success")}><i className={"bi " + (lateDbdBusy ? "bi-hourglass-split" : "bi-search")}></i><span>{lateDbdBusy ? tr("searching") : "DBD"}</span></button></div></label>
      <label>{t("pos_tax_invoices.buyer_name")}<input id="lateBuyerNameInput" value={lateBuyer.buyerName} onChange={e => setLateBuyer({ ...lateBuyer, buyerName: e.target.value })}/></label><label>{t("pos_tax_invoices.branch")}<input id="lateBuyerBranchInput" value={lateBuyer.buyerBranchName} onChange={e => setLateBuyer({ ...lateBuyer, buyerBranchName: e.target.value })}/></label><label>{t("pos_tax_invoices.buyer_address")}<textarea id="lateBuyerAddressInput" value={lateBuyer.buyerAddress} onChange={e => setLateBuyer({ ...lateBuyer, buyerAddress: e.target.value })}></textarea></label>
      <div id="lateTaxInvoiceError" className="tax-error">{lateError}{lateManualUrl ? <><br/><button id="copyLateDbdLinkBtn" className="dbd-btn" type="button" onClick={() => copyManual(lateManualUrl,setLateError)}><i className="bi bi-clipboard"></i><span>{tr("copy_dbd_link")}</span></button></> : null}</div><div className="tax-dialog-actions"><button id="lateTaxInvoiceCancelBtn" className="btn btn-secondary" type="button" disabled={lateBusy} onClick={() => lateDialogRef.current?.close?.()}><i className="bi bi-x-lg"></i><span>{t("pos_tax_invoices.cancel")}</span></button><button id="lateTaxInvoiceSubmitBtn" className="btn btn-primary" type="submit" disabled={lateBusy}><i className={"bi " + (lateBusy ? "bi-hourglass-split" : "bi-send")}></i><span>{lateBusy ? tr("issuing") : t("pos_tax_invoices.issue_invoice")}</span></button></div></form></dialog>
    <dialog id="taxProfileDialog" ref={profileDialogRef} className="tax-dialog tax-profile-dialog"><form id="taxProfileForm" className="tax-form" method="dialog" onSubmit={saveProfile}><div><h2>{t("pos_tax_invoices.profile_title")}</h2><p>{t("pos_tax_invoices.profile_description")}</p></div><div className="profile-grid"><aside className="profile-list-shell"><p className="profile-list-title">{t("pos_tax_invoices.saved_profiles")}</p><div id="taxProfileList" className="profile-list">{profiles.length ? profiles.map(row => { const id = row.id || row.customerKey || ""; const pending = row.syncStatus === "pending_sync"; const synced = row.syncStatus === "synced" || Boolean(row.firebaseSyncedAt); const syncClass = pending ? "is-pending" : synced ? "is-synced" : "is-local"; const syncLabel = pending ? tr("pending_sync") : synced ? tr("synced") : tr("source_local"); return <button key={id} className={"profile-row" + (String(profileForm.id) === String(id) ? " is-active" : "")} type="button" onClick={() => applyProfile(row)}><strong>{row.buyerName || "-"} <span className={"profile-sync-badge " + syncClass}>{syncLabel}</span></strong><span>{row.buyerTaxId || "-"} • {row.buyerBranchName || tr("head_office")}</span></button>; }) : <div className="profile-empty">{tr("no_profiles")}</div>}</div></aside>
      <div className="profile-fields"><div className="profile-field-row"><label>{t("pos_tax_invoices.profile_id")}<input id="taxProfileIdInput" value={profileForm.id} readOnly={Boolean(profiles.find(row => String(row.id || row.customerKey) === String(profileForm.id)))} onChange={e => setProfileForm({ ...profileForm, id:e.target.value })} placeholder={t("pos_tax_invoices.profile_id_placeholder")}/></label><label>{t("pos_tax_invoices.tax_id")}<input id="taxProfileTaxIdInput" value={profileForm.buyerTaxId} onChange={e => setProfileForm({ ...profileForm, buyerTaxId:e.target.value })} inputMode="numeric" maxLength={13}/></label></div><label>{t("pos_tax_invoices.buyer_name")}<input id="taxProfileNameInput" value={profileForm.buyerName} onChange={e => setProfileForm({ ...profileForm, buyerName:e.target.value })}/></label><label>{t("pos_tax_invoices.branch")}<input id="taxProfileBranchInput" value={profileForm.buyerBranchName} onChange={e => setProfileForm({ ...profileForm, buyerBranchName:e.target.value })}/></label><label>{t("pos_tax_invoices.buyer_address")}<textarea id="taxProfileAddressInput" value={profileForm.buyerAddress} onChange={e => setProfileForm({ ...profileForm, buyerAddress:e.target.value })}></textarea></label></div></div>
      <div id="taxProfileError" className="tax-error">{profileError}</div><div className="tax-dialog-actions"><button id="taxProfileDeleteBtn" className="btn btn-danger" type="button" hidden={!profileForm.id} disabled={profileBusy} onClick={deleteProfile}><i className="bi bi-trash"></i><span>{t("pos_tax_invoices.delete")}</span></button><button id="taxProfileNewBtn" className="btn btn-secondary" type="button" disabled={profileBusy} onClick={() => applyProfile({})}><i className="bi bi-plus-lg"></i><span>{t("pos_tax_invoices.new")}</span></button><button id="taxProfileCloseBtn" className="btn btn-secondary" type="button" disabled={profileBusy} onClick={() => profileDialogRef.current?.close?.()}><i className="bi bi-x-lg"></i><span>{t("pos_tax_invoices.close")}</span></button><button className="btn btn-primary" type="submit" disabled={profileBusy}><i className="bi bi-floppy"></i><span>{t("pos_tax_invoices.save")}</span></button></div></form></dialog>    <dialog id="voidTaxInvoiceDialog" ref={voidDialogRef} className="tax-dialog"><form id="voidTaxInvoiceForm" className="tax-form" method="dialog" onSubmit={submitVoid}><div><h2>{t("pos_tax_invoices.void_title")}</h2><p id="voidTaxInvoiceText">{voidInvoice ? tr("invoice_receipt_summary", { invoice:voidInvoice.invoiceNumber || keyOf(voidInvoice), receipt:voidInvoice.saleNumber || voidInvoice.saleId || "-" }) : "-"}</p></div><label>{t("pos_tax_invoices.void_reason")}<textarea id="voidTaxInvoiceReasonInput" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder={t("pos_tax_invoices.void_reason_placeholder")}></textarea></label><div id="voidTaxInvoiceError" className="tax-error">{voidError}</div><div className="tax-dialog-actions"><button id="voidTaxInvoiceCancelBtn" className="btn btn-secondary" type="button" disabled={voidBusy} onClick={() => voidDialogRef.current?.close?.()}><i className="bi bi-arrow-left"></i><span>{t("pos_tax_invoices.keep_invoice")}</span></button><button id="voidTaxInvoiceSubmitBtn" className="btn btn-danger" type="submit" disabled={voidBusy}><i className={"bi " + (voidBusy ? "bi-hourglass-split" : "bi-x-circle")}></i><span>{voidBusy ? tr("voiding") : t("pos_tax_invoices.confirm_void")}</span></button></div></form></dialog>
    <dialog id="editTaxBuyerDialog" ref={editDialogRef} className="tax-dialog"><form id="editTaxBuyerForm" className="tax-form" method="dialog" onSubmit={submitEdit}><div><h2>{t("pos_tax_invoices.edit_buyer_title")}</h2><p id="editTaxBuyerText">{editInvoice ? tr("invoice_receipt_summary", { invoice:editInvoice.invoiceNumber || keyOf(editInvoice), receipt:editInvoice.saleNumber || editInvoice.saleId || "-" }) : "-"}</p><p>{t("pos_tax_invoices.edit_buyer_description")}</p></div>
      <label>{t("pos_tax_invoices.tax_id")}<div className="tax-id-control"><input id="editBuyerTaxIdInput" value={editBuyer.buyerTaxId} onChange={e => setEditBuyer({ ...editBuyer, buyerTaxId:e.target.value })} inputMode="numeric" maxLength={13}/><button id="editDbdLookupBtn" className="dbd-btn" type="button" disabled={editBusy || editDbdBusy} onClick={() => lookupDbd(editBuyer,setEditBuyer,setEditError,setEditManualUrl,setEditDbdBusy, "dbd_save_success")}><i className={"bi " + (editDbdBusy ? "bi-hourglass-split" : "bi-search")}></i><span>{editDbdBusy ? tr("searching") : "DBD"}</span></button></div></label><label>{t("pos_tax_invoices.buyer_name")}<input id="editBuyerNameInput" required value={editBuyer.buyerName} onChange={e => setEditBuyer({ ...editBuyer, buyerName:e.target.value })}/></label><label>{t("pos_tax_invoices.branch")}<input id="editBuyerBranchInput" value={editBuyer.buyerBranchName} onChange={e => setEditBuyer({ ...editBuyer, buyerBranchName:e.target.value })}/></label><label>{t("pos_tax_invoices.buyer_address")}<textarea id="editBuyerAddressInput" value={editBuyer.buyerAddress} onChange={e => setEditBuyer({ ...editBuyer, buyerAddress:e.target.value })}></textarea></label>
      <div id="editTaxBuyerError" className="tax-error">{editError}{editManualUrl ? <><br/><button id="copyEditDbdLinkBtn" className="dbd-btn" type="button" onClick={() => copyManual(editManualUrl,setEditError)}><i className="bi bi-clipboard"></i><span>{tr("copy_dbd_link")}</span></button></> : null}</div><div className="tax-dialog-actions"><button id="editTaxBuyerCancelBtn" className="btn btn-secondary" type="button" disabled={editBusy} onClick={() => editDialogRef.current?.close?.()}><i className="bi bi-x-lg"></i><span>{t("pos_tax_invoices.cancel")}</span></button><button id="editTaxBuyerSubmitBtn" className="btn btn-primary" type="submit" disabled={editBusy}><i className={"bi " + (editBusy ? "bi-hourglass-split" : "bi-floppy")}></i><span>{editBusy ? tr("saving") : t("pos_tax_invoices.save_buyer")}</span></button></div></form></dialog>
    <AppDeveloperPanel />
  </>;
}
