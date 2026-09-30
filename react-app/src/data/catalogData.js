import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/firebase/client";

const normalizeName = value => String(value || "").trim().replace(/\s+/g, " ");
const nameKey = value => normalizeName(value).toLocaleLowerCase("th");

function requireContext(tenantId) {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("TENANT_REQUIRED");
  if (!auth.currentUser?.uid) throw new Error("AUTH_REQUIRED");
  return id;
}

export async function listCatalogProducts(tenantId) {
  const id = requireContext(tenantId);
  const snapshot = await getDocs(collection(db, "tenants", id, "products"));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function listCatalogCategories(tenantId) {
  const id = requireContext(tenantId);
  const snapshot = await getDocs(collection(db, "tenants", id, "categories"));
  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999)
      || String(a.name || "").localeCompare(String(b.name || ""), "th"));
}

export async function ensureCatalogCategories(tenantId, names = []) {
  const id = requireContext(tenantId);
  const current = await listCatalogCategories(id);
  const byName = new Map(current.map(item => [nameKey(item.name), item]));
  const result = new Map();
  const batch = writeBatch(db);
  let changed = false;

  for (const rawName of names) {
    const name = normalizeName(rawName) || "ทั่วไป";
    const key = nameKey(name);
    let category = byName.get(key);
    if (!category) {
      const categoryId = `cat-${crypto.randomUUID()}`;
      category = {
        id: categoryId,
        tenantId: id,
        shopId: id,
        name,
        aliases: [],
        sortOrder: current.length * 10 + result.size * 10,
        active: true,
        createdBy: auth.currentUser.uid,
        updatedBy: auth.currentUser.uid,
        updatedAt: Date.now(),
      };
      batch.set(doc(db, "tenants", id, "categories", categoryId), {
        ...category,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      });
      byName.set(key, category);
      changed = true;
    }
    result.set(key, category);
  }
  if (changed) await batch.commit();
  return result;
}

function catalogProductNumber(masterProductId) {
  let hash = 2166136261;
  for (const char of String(masterProductId || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % 1000000000;
}

export function allocateCatalogProductIds(rows = [], existingProducts = []) {
  const reserved = new Set(existingProducts.map(item => String(item.id || "")).filter(Boolean));
  return new Map(rows.map(item => {
    let number = catalogProductNumber(item.masterProductId);
    let id = `P${String(number).padStart(9, "0")}`;
    while (reserved.has(id)) {
      number = (number + 1) % 1000000000;
      id = `P${String(number).padStart(9, "0")}`;
    }
    reserved.add(id);
    return [item.masterProductId, id];
  }));
}

export async function importCatalogProducts(tenantId, rows = [], catalogVersion = "") {
  const id = requireContext(tenantId);
  const existingProducts = await listCatalogProducts(id);
  const productIds = allocateCatalogProductIds(rows, existingProducts);
  const categories = await ensureCatalogCategories(id, rows.map(item => item.category || "ทั่วไป"));
  const products = rows.map(item => {
    const category = categories.get(nameKey(item.category || "ทั่วไป"));
    return {
      ...item,
      id: productIds.get(item.masterProductId),
      sku: item.masterProductId,
      tenantId: id,
      shopId: id,
      categoryId: category.id,
      category: category.name,
      stock: 0,
      showOnPos: false,
      activationStatus: "setup_required",
      importedFromCatalog: true,
      importedCatalogVersion: catalogVersion,
      createdBy: auth.currentUser.uid,
      updatedBy: auth.currentUser.uid,
      updatedAt: Date.now(),
    };
  });

  for (let offset = 0; offset < products.length; offset += 400) {
    const batch = writeBatch(db);
    products.slice(offset, offset + 400).forEach(product => {
      batch.set(doc(db, "tenants", id, "products", product.id), {
        ...product,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }
  return products;
}
