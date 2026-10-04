import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/client";
import { listPosSales } from "@/data/retailPosData";
import { listRetailProducts } from "@/data/retailProductsData";
import { cachePosTheme, DEFAULT_POS_THEME, normalizePosTheme } from "@/config/posThemes";

export const POS_THEME_SETTINGS_ID = "pos-theme";

function requireTenantId(value) {
  const id = String(value || "").trim();
  if (!id) throw new Error("TENANT_REQUIRED");
  return id;
}

function themeRef(tenantId) {
  return doc(db, "tenants", requireTenantId(tenantId), "settings", POS_THEME_SETTINGS_ID);
}

export async function loadPosThemeSetting(tenantId) {
  const id = requireTenantId(tenantId);
  const snapshot = await getDoc(themeRef(id));
  const row = snapshot.exists() ? snapshot.data() : {};
  const theme = normalizePosTheme(row.theme || row.posTheme || DEFAULT_POS_THEME);
  cachePosTheme(id, theme);
  return { id: POS_THEME_SETTINGS_ID, ...row, theme };
}

export async function savePosThemeSetting(tenantId, theme) {
  const id = requireTenantId(tenantId);
  const normalized = normalizePosTheme(theme);
  const payload = {
    id: POS_THEME_SETTINGS_ID,
    type: POS_THEME_SETTINGS_ID,
    tenantId: id,
    shopId: id,
    theme: normalized,
    updatedBy: auth.currentUser?.uid || "",
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp(),
  };
  await setDoc(themeRef(id), payload, { merge: true });
  cachePosTheme(id, normalized);
  return payload;
}

function millis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameLocalDay(value, reference = new Date()) {
  const timestamp = millis(value);
  if (!timestamp) return false;
  const date = new Date(timestamp);
  return date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate();
}

function validSale(row = {}) {
  return !["cancelled", "canceled", "void"].includes(String(row.status || "").toLowerCase());
}

export async function loadPosThemeSummary(tenantId, { includeSales = true, includeProducts = true } = {}) {
  const id = requireTenantId(tenantId);
  const [sales, products] = await Promise.all([
    includeSales ? listPosSales(id) : Promise.resolve([]),
    includeProducts ? listRetailProducts(id) : Promise.resolve([]),
  ]);
  const now = new Date();
  const today = (sales || []).filter(sale => validSale(sale)
    && sameLocalDay(sale.createdAtServer || sale.createdAt || sale.updatedAt, now));
  const salesTotal = today.reduce((sum, sale) => {
    const gross = Number(sale.totalAmount ?? sale.total ?? 0);
    const refund = Number(sale.refundTotal || 0);
    return sum + Math.max(0, gross - refund);
  }, 0);
  const inStock = (products || []).filter(product => Number(product.stock ?? product.qty ?? 0) > 0).length;
  return { salesTotal, billCount: today.length, inStock };
}
