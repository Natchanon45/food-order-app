import {
  getTenantLalamoveWallet,
  listPlatformRevenueSharePayments,
  listTenants,
} from "@/data/platformTenantService";

const CACHE_MS = 30_000;
const WALLET_CONCURRENCY = 4;
let cachedAt = 0;
let cachedSummary = null;

export const EMPTY_PLATFORM_ADMIN_NOTIFICATIONS = Object.freeze({
  total: 0,
  wallet: Object.freeze({ total: 0, pending: 0, autoApprovedToday: 0 }),
  revenueShare: Object.freeze({ total: 0, pending: 0, autoApprovedToday: 0 }),
  byTenant: Object.freeze({}),
  todayKey: "",
  checkedAt: "",
  partial: false,
});

function bangkokDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = type => parts.find(part => part.type === type)?.value || "";
  const year = pick("year"), month = pick("month"), day = pick("day");
  return year && month && day ? `${year}-${month}-${day}` : "";
}

function autoApprovedBySlip2Go(item = {}) {
  return String(item.status || "").toLowerCase() === "approved"
    && String(item.verificationProvider || "").toLowerCase().includes("slip2go")
    && String(item.verificationStatus || "").toLowerCase() === "matched";
}

function submittedToday(item = {}, todayKey = "") {
  return Boolean(todayKey) && bangkokDateKey(item.submittedAt) === todayKey;
}

function tenantNoticeRecord(tenant = {}) {
  return {
    tenantId: String(tenant.id || ""),
    tenantName: String(tenant.name || tenant.slug || tenant.id || ""),
    wallet: 0,
    revenueShare: 0,
    total: 0,
  };
}

function addTenantNotice(byTenant, tenantId, tenantName, key) {
  const id = String(tenantId || "").trim();
  if (!id) return;
  const current = byTenant[id] || tenantNoticeRecord({ id, name: tenantName });
  current[key] = Number(current[key] || 0) + 1;
  current.total = Number(current.wallet || 0) + Number(current.revenueShare || 0);
  byTenant[id] = current;
}

async function mapWithConcurrency(items, limit, mapper) {
  const source = Array.from(items || []);
  const results = new Array(source.length);
  let cursor = 0;
  async function worker() {
    while (cursor < source.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(source[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), source.length || 1) }, worker));
  return results;
}

export function clearPlatformAdminNotificationCache() {
  cachedAt = 0;
  cachedSummary = null;
}

export async function loadPlatformAdminNotificationSummary({ force = false, tenants: suppliedTenants = null } = {}) {
  const now = Date.now();
  if (!force && cachedSummary && now - cachedAt < CACHE_MS) return cachedSummary;

  const todayKey = bangkokDateKey(new Date());
  const [tenants, revenueData] = await Promise.all([
    Array.isArray(suppliedTenants) ? Promise.resolve(suppliedTenants) : listTenants(),
    listPlatformRevenueSharePayments({ status: "all" }),
  ]);

  const byTenant = {};
  (tenants || []).forEach(tenant => {
    if (tenant?.id) byTenant[tenant.id] = tenantNoticeRecord(tenant);
  });

  const revenueItems = Array.isArray(revenueData?.items) ? revenueData.items : [];
  const revenuePending = Math.max(0, Number(revenueData?.counts?.pending || 0));
  let revenueAutoApprovedToday = 0;

  revenueItems.forEach(item => {
    const pending = String(item?.status || "").toLowerCase() === "pending";
    const autoApprovedToday = autoApprovedBySlip2Go(item) && submittedToday(item, todayKey);
    if (autoApprovedToday) revenueAutoApprovedToday += 1;
    if (!pending && !autoApprovedToday) return;
    addTenantNotice(
      byTenant,
      item?.tenant?.id,
      item?.tenant?.name || item?.tenant?.slug,
      "revenueShare",
    );
  });

  const walletTenants = (tenants || []).filter(tenant =>
    String(tenant?.lalamove?.accountMode || "").toLowerCase() === "fod_central"
  );
  let walletPending = 0;
  let walletAutoApprovedToday = 0;
  let walletLoadFailures = 0;

  const walletResults = await mapWithConcurrency(walletTenants, WALLET_CONCURRENCY, async tenant => {
    try {
      const data = await getTenantLalamoveWallet({ tenantId: tenant.id });
      return { tenant, items: Array.isArray(data?.item?.topups) ? data.item.topups : [] };
    } catch (error) {
      console.warn("PLATFORM_ADMIN_NOTIFICATION_WALLET_LOAD_FAILED", tenant.id, error?.code || error?.message || error);
      walletLoadFailures += 1;
      return { tenant, items: [] };
    }
  });

  walletResults.forEach(({ tenant, items }) => {
    items.forEach(item => {
      const pending = String(item?.status || "").toLowerCase() === "pending";
      const autoApprovedToday = autoApprovedBySlip2Go(item) && submittedToday(item, todayKey);
      if (pending) walletPending += 1;
      if (autoApprovedToday) walletAutoApprovedToday += 1;
      if (!pending && !autoApprovedToday) return;
      addTenantNotice(byTenant, tenant.id, tenant.name || tenant.slug, "wallet");
    });
  });

  const revenueShare = {
    pending: revenuePending,
    autoApprovedToday: revenueAutoApprovedToday,
    total: revenuePending + revenueAutoApprovedToday,
  };
  const wallet = {
    pending: walletPending,
    autoApprovedToday: walletAutoApprovedToday,
    total: walletPending + walletAutoApprovedToday,
  };

  const summary = {
    total: revenueShare.total + wallet.total,
    revenueShare,
    wallet,
    byTenant,
    todayKey,
    checkedAt: new Date().toISOString(),
    partial: walletLoadFailures > 0,
  };

  cachedAt = now;
  cachedSummary = summary;
  return summary;
}
