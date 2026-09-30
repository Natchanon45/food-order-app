import {
  collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, functions, storage } from "@/firebase/client";

const DEFAULT_FOOD_IMAGE = "/assets/images/default-food.svg";

function requireTenantId(value) {
  const id = String(value || "").trim();
  if (!id) throw new Error("TENANT_REQUIRED");
  return id;
}

function tenantDoc(tenantId, collectionName, id) {
  return doc(db, "tenants", requireTenantId(tenantId), collectionName, String(id));
}

function tenantCollection(tenantId, collectionName) {
  return collection(db, "tenants", requireTenantId(tenantId), collectionName);
}

function rows(snapshot) {
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

function canonicalMenuName(value = "") {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function clampImagePosition(value) {
  const number = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(number) ? number : 50));
}

function categoryOrderKey(value = "") {
  return String(value).normalize("NFKC").replace(/\s+/g, "").replace(/^อาหาร/, "").replace(/^ประเภท/, "");
}

function sortMenus(items, categoryOrder = []) {
  const rank = new Map((categoryOrder || []).map((name, index) => [categoryOrderKey(name), index]));
  return [...items].map(item => ({
    ...item,
    image: item.image || DEFAULT_FOOD_IMAGE,
    imagePositionX: 50,
    imagePositionY: clampImagePosition(item.imagePositionY),
    sortOrder: Number(item.sortOrder ?? 9999),
  })).sort((a, b) => {
    const ac = String(a.category || "อื่น ๆ"), bc = String(b.category || "อื่น ๆ");
    const ar = rank.get(categoryOrderKey(ac)) ?? 9999;
    const br = rank.get(categoryOrderKey(bc)) ?? 9999;
    if (ar !== br) return ar - br;
    if (ac !== bc) return ac.localeCompare(bc, "th");
    const as = Number(a.sortOrder ?? 9999), bs = Number(b.sortOrder ?? 9999);
    return as !== bs ? as - bs : String(a.name || "").localeCompare(String(b.name || ""), "th");
  });
}

export async function loadAdminSnapshot(tenantId) {
  const id = requireTenantId(tenantId);
  const [settingsSnap, menuSnap, tableSnap, lalamoveSnap, walletSnap, lalamoveRemote, walletRemoteResult] = await Promise.all([
    getDoc(tenantDoc(id, "settings", "store")),
    getDocs(tenantCollection(id, "menus")),
    getDocs(tenantCollection(id, "tables")),
    getDoc(tenantDoc(id, "settings", "lalamove")),
    getDoc(tenantDoc(id, "settings", "lalamoveWallet")),
    loadTenantLalamoveSettings().catch(error => {
      console.warn("TENANT_LALAMOVE_SETTINGS_FALLBACK", error?.code || error?.message || error);
      return null;
    }),
    loadOwnTenantLalamoveWallet()
      .then(item => ({ item, loadError: false }))
      .catch(error => {
        console.warn("TENANT_LALAMOVE_WALLET_FALLBACK", error?.code || error?.message || error);
        return { item: null, loadError: true };
      }),
  ]);
  const settings = settingsSnap.exists() ? { id: settingsSnap.id, ...settingsSnap.data() } : {};
  const walletFallback = walletSnap.exists() ? { id: walletSnap.id, ...walletSnap.data() } : {};
  const wallet = walletRemoteResult.item || walletFallback;
  return {
    settings,
    menus: sortMenus(rows(menuSnap), settings.categoryOrder || []),
    tables: rows(tableSnap),
    lalamove: lalamoveRemote || (lalamoveSnap.exists() ? { id: lalamoveSnap.id, ...lalamoveSnap.data() } : {}),
    wallet: walletRemoteResult.loadError ? { ...wallet, loadError: true } : wallet,
  };
}

export async function saveAdminStoreSettings(tenantId, settings = {}) {
  const id = requireTenantId(tenantId);
  const ref = tenantDoc(id, "settings", "store");
  const payload = {
    ...settings,
    tenantId: id,
    updatedAt: serverTimestamp(),
  };
  delete payload.id;
  await setDoc(ref, payload, { merge: true });
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : payload;
}

export async function uploadAdminMenuImage(menuId, blob) {
  if (!storage) throw new Error("STORAGE_NOT_READY");
  const id = String(menuId || "").trim();
  if (!id || !blob) throw new Error("IMAGE_UPLOAD_REQUIRED");
  const path = `menu-images/${id}/${Date.now()}.webp`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob, { contentType: "image/webp" });
  return { url: await getDownloadURL(ref), path };
}

export async function saveAdminMenu(tenantId, menu = {}) {
  const id = String(menu.id || crypto.randomUUID()).trim();
  const name = String(menu.name || "").trim();
  const canonical = canonicalMenuName(name);
  if (!canonical) throw new Error("MENU_NAME_REQUIRED");
  const all = rows(await getDocs(tenantCollection(tenantId, "menus")));
  if (all.some(item => item.id !== id && canonicalMenuName(item.name) === canonical)) {
    throw new Error("DUPLICATE_MENU_NAME");
  }
  const payload = {
    ...menu,
    name,
    tenantId: requireTenantId(tenantId),
    shopId: requireTenantId(tenantId),
    imagePositionX: 50,
    imagePositionY: clampImagePosition(menu.imagePositionY),
    updatedAt: serverTimestamp(),
  };
  delete payload.id;
  await setDoc(tenantDoc(tenantId, "menus", id), payload, { merge: true });
  return { id, ...payload };
}

export function deleteAdminMenu(tenantId, menuId) {
  return deleteDoc(tenantDoc(tenantId, "menus", menuId));
}

export async function saveAdminTable(tenantId, table = {}) {
  const code = String(table.code || "").trim().toUpperCase();
  const id = String(table.id || code).trim();
  if (!id || !code) throw new Error("TABLE_CODE_REQUIRED");
  const payload = {
    ...table,
    code,
    tenantId: requireTenantId(tenantId),
    shopId: requireTenantId(tenantId),
    status: table.status || "available",
    orderToken: table.orderToken || "",
    currentRound: Number(table.currentRound || 0),
    orderIds: Array.isArray(table.orderIds) ? table.orderIds : [],
    updatedAt: serverTimestamp(),
  };
  delete payload.id;
  await setDoc(tenantDoc(tenantId, "tables", id), payload, { merge: true });
  return { id, ...payload };
}

export function deleteAdminTable(tenantId, tableId) {
  return deleteDoc(tenantDoc(tenantId, "tables", tableId));
}

export async function saveAdminCategoryOrder(tenantId, categoryOrder = []) {
  return saveAdminStoreSettings(tenantId, { categoryOrder: [...categoryOrder] });
}

export async function saveAdminMenuOrder(tenantId, category, orderedMenuIds = []) {
  const batch = writeBatch(db);
  orderedMenuIds.forEach((menuId, index) => {
    batch.set(
      tenantDoc(tenantId, "menus", menuId),
      { sortOrder: index + 1, category: String(category || ""), updatedAt: serverTimestamp() },
      { merge: true },
    );
  });
  await batch.commit();
}

export async function getAdminGoogleMapsBrowserKey(slug) {
  const value = String(slug || "").trim().toLowerCase();
  if (!value) throw new Error("TENANT_SLUG_REQUIRED");
  const response = await httpsCallable(functions, "getDeliveryGoogleMapsConfig")({ slug: value });
  const apiKey = String(response?.data?.apiKey || "").trim();
  if (!apiKey) throw new Error("GOOGLE_MAPS_BROWSER_KEY_MISSING");
  return apiKey;
}


async function callAdminFunction(name, payload = {}) {
  const response = await httpsCallable(functions, name)(payload);
  return response?.data || {};
}

export async function loadTenantLalamoveSettings() {
  const data = await callAdminFunction("getTenantLalamoveSettings");
  return data.item || {};
}

export async function updateTenantLalamoveSettings(payload = {}) {
  const data = await callAdminFunction("updateTenantLalamoveSettings", payload);
  return data.item || {};
}

export async function testTenantLalamoveConnection() {
  const data = await callAdminFunction("testTenantLalamoveConnection");
  return { ...data, item: data.item || {} };
}

export async function loadOwnTenantLalamoveWallet() {
  const data = await callAdminFunction("getOwnTenantLalamoveWallet");
  return data.item || {};
}

function safeTopupFileName(file) {
  const raw = String(file?.name || "slip").trim();
  const extension = raw.includes(".") ? "." + raw.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const stem = raw.replace(/.[^.]*$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "slip";
  return stem + extension;
}

export async function submitTenantLalamoveWalletTopup(tenantId, amount, file) {
  const id = requireTenantId(tenantId);
  if (!file) throw new Error("FOD_WALLET_TOPUP_SLIP_REQUIRED");
  const topupId = crypto.randomUUID();
  const fileName = safeTopupFileName(file);
  const path = `tenants/${id}/lalamove-wallet-topups/${topupId}/${fileName}`;
  const target = storageRef(storage, path);
  await uploadBytes(target, file, { contentType: file.type || "application/octet-stream" });
  const data = await callAdminFunction("submitTenantLalamoveWalletTopup", {
    topupId,
    amount: Number(amount),
    storagePath: path,
    slipName: file.name || fileName,
    slipMime: file.type || "",
    slipSize: Number(file.size || 0),
  });
  return data;
}

export async function deleteTenantLalamoveWalletTopup(topupId) {
  return callAdminFunction("deleteTenantLalamoveWalletTopup", { topupId: String(topupId || "") });
}
