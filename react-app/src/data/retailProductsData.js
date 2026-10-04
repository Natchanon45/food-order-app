import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, runTransaction,
  serverTimestamp, setDoc, writeBatch,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/firebase/client";

const PRODUCT_CODE_PATTERN = /^P\d{9}$/;
const tenantCollection = (tenantId, name) => collection(db, "tenants", tenantId, name);
const tenantDoc = (tenantId, name, id) => doc(db, "tenants", tenantId, name, String(id));
const cleanName = value => String(value || "").trim().replace(/\s+/g, " ");
const nameKey = value => cleanName(value).toLocaleLowerCase("th");
const nowIso = () => new Date().toISOString();

function requireContext(tenantId) {
  const id = String(tenantId || "").trim();
  if (!id) throw new Error("TENANT_REQUIRED");
  if (!auth.currentUser?.uid) throw new Error("AUTH_REQUIRED");
  return id;
}
const row = snapshot => ({ id: snapshot.id, ...snapshot.data() });
const timeValue = value => {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number(value || 0);
};
const normalizeProduct = source => ({
  minStock: 5,
  showOnPos: true,
  ...source,
  id: String(source?.id || source?._documentId || ""),
  barcode: String(source?.barcode || ""),
  name: String(source?.name || ""),
  price: Number(source?.price || 0),
  cost: Number.isFinite(Number(source?.cost)) ? Number(source.cost) : null,
  stock: Number(source?.stock ?? source?.qty ?? 0),
  minStock: Number(source?.minStock ?? 5),
  unit: String(source?.unit || "ชิ้น"),
  category: cleanName(source?.category || "ทั่วไป") || "ทั่วไป",
  sortOrder: Number(source?.sortOrder ?? 999),
  showOnPos: source?.showOnPos !== false,
});

function normalizeProductDocuments(documents = []) {
  const byId = new Map();
  documents.forEach(document => {
    const product = normalizeProduct({ _documentId: document.id, ...document.data() });
    const productId = String(product.id || document.id);
    if (!productId) return;
    const current = byId.get(productId);
    const documentIds = [...new Set([...(current?._documentIds || []), document.id])];
    const canonical = document.id === productId;
    const currentCanonical = current?._documentId === productId;
    const preferProduct = !current
      || (canonical && !currentCanonical)
      || (canonical === currentCanonical && timeValue(product.updatedAt) > timeValue(current?.updatedAt));
    byId.set(productId, {
      ...(preferProduct ? product : current),
      id: productId,
      _documentId: preferProduct ? document.id : current?._documentId,
      _documentIds: documentIds,
    });
  });
  return [...byId.values()];
}

function normalizeCategoryDocuments(documents = []) {
  return documents.map(row).map(item => ({
    ...item,
    id: String(item.id || ""),
    name: cleanName(item.name),
    aliases: Array.isArray(item.aliases) ? item.aliases.map(cleanName).filter(Boolean) : [],
    sortOrder: Number(item.sortOrder ?? 0),
    active: item.active !== false,
  })).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "th"));
}

function normalizeMovementDocuments(documents = []) {
  return documents.map(row)
    .sort((a, b) => timeValue(b.createdAtServer || b.createdAt || b.updatedAt) - timeValue(a.createdAtServer || a.createdAt || a.updatedAt))
    .slice(0, 500);
}

export async function listRetailProducts(tenantId) {
  const id = requireContext(tenantId);
  const snapshot = await getDocs(tenantCollection(id, "products"));
  return normalizeProductDocuments(snapshot.docs);
}

export function watchRetailProducts(tenantId, onRows, onError = () => {}) {
  const id = requireContext(tenantId);
  return onSnapshot(tenantCollection(id, "products"),
    snapshot => onRows(normalizeProductDocuments(snapshot.docs)),
    onError);
}

export async function listRetailCategories(tenantId) {
  const id = requireContext(tenantId);
  const snapshot = await getDocs(tenantCollection(id, "categories"));
  return normalizeCategoryDocuments(snapshot.docs);
}

export function watchRetailCategories(tenantId, onRows, onError = () => {}) {
  const id = requireContext(tenantId);
  return onSnapshot(tenantCollection(id, "categories"),
    snapshot => onRows(normalizeCategoryDocuments(snapshot.docs)),
    onError);
}

export async function saveRetailCategory(tenantId, category = {}, sourceCategory = null) {
  const id = requireContext(tenantId);
  const name = cleanName(category.name);
  if (!name) throw new Error("CATEGORY_NAME_REQUIRED");
  if (new Set(["ขายดี", "ทั้งหมด"].map(nameKey)).has(nameKey(name))) {
    throw new Error("CATEGORY_RESERVED_NAME");
  }

  const [categories, products] = await Promise.all([
    listRetailCategories(id),
    listRetailProducts(id),
  ]);
  const source = sourceCategory || null;
  const sourceId = String(source?.id || category.id || "");
  const sourceIsDerived = Boolean(source?.derived);
  const requestedId = sourceIsDerived && sourceId.startsWith("derived:") ? "" : sourceId;
  const categoryId = String(requestedId || `cat-${crypto.randomUUID()}`);
  const existing = categories.find(item => String(item.id) === categoryId);

  const duplicate = categories.find(item => {
    if (String(item.id) === categoryId) return false;
    const names = [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])];
    return names.some(value => nameKey(value) === nameKey(name));
  });
  if (duplicate) throw new Error("CATEGORY_DUPLICATE");

  const previousNames = [
    source?.name,
    ...(Array.isArray(source?.aliases) ? source.aliases : []),
    existing?.name,
    ...(Array.isArray(existing?.aliases) ? existing.aliases : []),
  ].map(cleanName).filter(Boolean);
  const aliases = [...new Set(previousNames)]
    .filter(value => nameKey(value) !== nameKey(name))
    .slice(0, 20);

  const now = Date.now();
  const payload = {
    ...(existing || {}),
    ...category,
    id: categoryId,
    tenantId: id,
    shopId: id,
    name,
    aliases,
    active: category.active !== false,
    sortOrder: Number(category.sortOrder ?? existing?.sortOrder ?? categories.length * 10),
    updatedBy: auth.currentUser.uid,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  };
  if (!existing) {
    payload.createdBy = auth.currentUser.uid;
    payload.createdAt = now;
    payload.createdAtServer = serverTimestamp();
  }
  await setDoc(tenantDoc(id, "categories", categoryId), payload, { merge: true });

  if (source) {
    const sourceNames = [source.name, ...(source.aliases || [])].map(cleanName).filter(Boolean);
    const sourceKeys = new Set(sourceNames.map(nameKey).filter(Boolean));
    const affected = products.filter(product => {
      const productCategoryId = String(product.categoryId || "");
      const productCategoryKey = nameKey(product.category);
      if (sourceIsDerived) return sourceKeys.has(productCategoryKey);
      if (sourceId && productCategoryId === sourceId) return true;
      return !productCategoryId && sourceKeys.has(productCategoryKey);
    });
    for (let offset = 0; offset < affected.length; offset += 400) {
      const batch = writeBatch(db);
      affected.slice(offset, offset + 400).forEach(product => {
        batch.set(tenantDoc(id, "products", product._documentId || product.id), {
          categoryId,
          category: name,
          updatedBy: auth.currentUser.uid,
          updatedAt: Date.now(),
          updatedAtServer: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
    }

    if (sourceKeys.size && [...sourceKeys].some(key => key !== nameKey(name))) {
      const orderRef = tenantDoc(id, "settings", "catalog-order");
      const orderSnapshot = await getDoc(orderRef);
      const order = orderSnapshot.exists() && Array.isArray(orderSnapshot.data()?.categoryOrder)
        ? orderSnapshot.data().categoryOrder.map(String)
        : [];
      if (order.length) {
        const replacement = `category:${name}`;
        const previousIds = new Set(sourceNames.map(value => `category:${value}`));
        const nextOrder = [...new Set(order.map(value => previousIds.has(String(value)) ? replacement : String(value)))];
        await setDoc(orderRef, {
          id: "catalog-order",
          type: "catalog-order",
          tenantId: id,
          categoryOrder: nextOrder,
          updatedBy: auth.currentUser.uid,
          updatedAt: Date.now(),
          updatedAtServer: serverTimestamp(),
        }, { merge: true });
      }
    }
  }
  return { ...payload, id: categoryId };
}

export async function deleteRetailCategory(tenantId, categoryId) {
  const id = requireContext(tenantId);
  const [categories, products] = await Promise.all([listRetailCategories(id), listRetailProducts(id)]);
  const category = categories.find(item => String(item.id) === String(categoryId));
  if (!category) return;
  const categoryKeys = new Set([category.name, ...(category.aliases || [])].map(nameKey).filter(Boolean));
  const inUse = products.some(product =>
    String(product.categoryId || "") === String(category.id)
    || categoryKeys.has(nameKey(product.category))
  );
  if (inUse) {
    const error = new Error("CATEGORY_IN_USE");
    error.code = "CATEGORY_IN_USE";
    throw error;
  }
  await deleteDoc(tenantDoc(id, "categories", category.id));
}

export async function listRetailStockMovements(tenantId) {
  const id = requireContext(tenantId);
  const snapshot = await getDocs(tenantCollection(id, "stockMovements"));
  return normalizeMovementDocuments(snapshot.docs);
}

export function watchRetailStockMovements(tenantId, onRows, onError = () => {}) {
  const id = requireContext(tenantId);
  return onSnapshot(tenantCollection(id, "stockMovements"),
    snapshot => onRows(normalizeMovementDocuments(snapshot.docs)),
    onError);
}

function movementPayload({ tenantId, product, before, after, note, action = "set", type = "adjustment" }) {
  const uid = auth.currentUser.uid;
  const movementId = crypto.randomUUID();
  const createdAt = nowIso();
  return {
    id: movementId,
    tenantId,
    shopId: tenantId,
    productId: product.id,
    productName: product.name,
    type,
    action,
    direction: after >= before ? "in" : "out",
    qty: Math.abs(after - before),
    requestedQuantity: Math.abs(after - before),
    before,
    after,
    stockBefore: before,
    stockAfter: after,
    note: cleanName(note) || "ปรับสต็อก",
    syncStatus: "synced",
    syncAttempt: 1,
    createdBy: uid,
    updatedBy: uid,
    createdAt,
    updatedAt: Date.now(),
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  };
}

export async function saveRetailProduct(tenantId, input = {}, editingId = "") {
  const id = requireContext(tenantId);
  const productId = String(editingId || input.id || "").trim().toUpperCase();
  if (!PRODUCT_CODE_PATTERN.test(productId)) throw new Error("INVALID_PRODUCT_ID");
  const barcode = String(input.barcode || "").trim();
  const name = cleanName(input.name);
  const unit = cleanName(input.unit);
  if (!barcode || !name || !unit || !input.categoryId) throw new Error("PRODUCT_REQUIRED_FIELDS");
  const products = await listRetailProducts(id);
  if (products.some(item => item.id.toUpperCase() === productId && item.id !== editingId)) throw new Error("DUPLICATE_PRODUCT_ID");
  if (products.some(item => item.barcode === barcode && item.id !== editingId)) throw new Error("DUPLICATE_BARCODE");
  const old = editingId ? products.find(item => item.id === editingId) : null;
  const stock = Number(input.stock || 0);
  const payload = normalizeProduct({
    ...(old || {}),
    ...input,
    id: productId,
    barcode,
    name,
    unit,
    stock,
    minStock: Number(input.minStock ?? 5),
    price: Number(input.price || 0),
    cost: input.cost === "" || input.cost == null ? null : Number(input.cost),
    tenantId: id,
    shopId: id,
    updatedBy: auth.currentUser.uid,
    updatedAt: Date.now(),
  });
  const batch = writeBatch(db);
  batch.set(tenantDoc(id, "products", productId), {
    ...payload,
    _documentId: productId,
    updatedAtServer: serverTimestamp(),
    ...(!old ? { createdBy: auth.currentUser.uid, createdAt: Date.now(), createdAtServer: serverTimestamp() } : {}),
  }, { merge: true });
  if (old) {
    const legacyDocumentIds = [...new Set([
      ...(Array.isArray(old._documentIds) ? old._documentIds : []),
      old._documentId,
    ].map(value => String(value || "").trim()).filter(value => value && value !== productId))];
    legacyDocumentIds.forEach(documentId => batch.delete(tenantDoc(id, "products", documentId)));
  }
  const before = Number(old?.stock || 0);
  if ((!old && stock > 0) || (old && before !== stock)) {
    const movement = movementPayload({
      tenantId: id,
      product: payload,
      before,
      after: stock,
      action: "set",
      note: old ? "แก้ไขยอดจากข้อมูลสินค้า" : "เพิ่มสินค้าใหม่",
    });
    batch.set(tenantDoc(id, "stockMovements", movement.id), movement, { merge: true });
  }
  await batch.commit();
  return payload;
}

export async function deleteRetailProduct(tenantId, product = {}) {
  const id = requireContext(tenantId);
  const productId = String(product?.id || product || "").trim();
  if (!productId) return;
  const documentIds = [...new Set([
    ...(Array.isArray(product?._documentIds) ? product._documentIds : []),
    product?._documentId,
    productId,
  ].map(value => String(value || "").trim()).filter(Boolean))];
  const batch = writeBatch(db);
  documentIds.forEach(documentId => batch.delete(tenantDoc(id, "products", documentId)));
  await batch.commit();
}

export async function adjustRetailStock(tenantId, productInput, action, quantity, note = "") {
  const id = requireContext(tenantId);
  const source = productInput && typeof productInput === "object"
    ? productInput
    : { id: String(productInput || "") };
  const productId = String(source.id || "").trim();
  const documentId = String(source._documentId || productId).trim();
  if (!productId || !documentId) throw new Error("PRODUCT_NOT_FOUND");
  const productRef = tenantDoc(id, "products", documentId);
  const movementId = crypto.randomUUID();
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(productRef);
    if (!snapshot.exists()) throw new Error("PRODUCT_NOT_FOUND");
    const product = normalizeProduct({ _documentId: snapshot.id, ...snapshot.data(), id: productId || snapshot.id });
    const before = Number(product.stock || 0);
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("INVALID_QUANTITY");
    const after = action === "add" ? before + amount : action === "remove" ? before - amount : amount;
    if (after < 0) throw new Error("NEGATIVE_STOCK");
    if (after === before) return { product, movement: null, noChange: true };
    const movement = {
      ...movementPayload({ tenantId: id, product, before, after, action, note }),
      id: movementId,
      requestedQuantity: amount,
    };
    transaction.update(productRef, {
      stock: after,
      tenantId: id,
      shopId: product.shopId || id,
      updatedAt: Date.now(),
      updatedAtServer: serverTimestamp(),
    });
    transaction.set(tenantDoc(id, "stockMovements", movementId), movement, { merge: true });
    return { product: { ...product, stock: after }, movement, noChange: false };
  });
}

export async function saveRetailCatalogOrder(tenantId, categoryOrder = [], changedProducts = []) {
  const id = requireContext(tenantId);
  await setDoc(tenantDoc(id, "settings", "catalog-order"), {
    id: "catalog-order",
    type: "catalog-order",
    tenantId: id,
    categoryOrder,
    updatedBy: auth.currentUser.uid,
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp(),
  }, { merge: true });
  for (let offset = 0; offset < changedProducts.length; offset += 400) {
    const batch = writeBatch(db);
    changedProducts.slice(offset, offset + 400).forEach(product => {
      const documentId = String(product._documentId || product.id);
      batch.set(tenantDoc(id, "products", documentId), {
        sortOrder: Number(product.sortOrder || 0),
        updatedBy: auth.currentUser.uid,
        updatedAt: Date.now(),
        updatedAtServer: serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }
}

export async function loadRetailCatalogOrder(tenantId) {
  const id = requireContext(tenantId);
  const snapshot = await getDoc(tenantDoc(id, "settings", "catalog-order"));
  const data = snapshot.exists() ? snapshot.data() : {};
  return Array.isArray(data.categoryOrder) ? data.categoryOrder.map(String) : [];
}

export function watchRetailCatalogOrder(tenantId, onRows, onError = () => {}) {
  const id = requireContext(tenantId);
  return onSnapshot(tenantDoc(id, "settings", "catalog-order"), snapshot => {
    const data = snapshot.exists() ? snapshot.data() : {};
    onRows(Array.isArray(data.categoryOrder) ? data.categoryOrder.map(String) : []);
  }, onError);
}

export async function uploadRetailProductImage(tenantId, productId, file) {
  const id = requireContext(tenantId);
  if (!file) throw new Error("IMAGE_REQUIRED");
  const safeName = String(file.name || "image").replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `tenants/${id}/product-images/${productId}/${Date.now()}-${safeName}`;
  const target = storageRef(storage, path);
  await uploadBytes(target, file, { contentType: file.type || "image/jpeg" });
  return { imageUrl: await getDownloadURL(target), imagePath: path, imageKey: path };
}

export async function deleteRetailProductImage(product = {}) {
  const path = String(product.imagePath || "");
  if (!path) return;
  try { await deleteObject(storageRef(storage, path)); } catch {}
}


export async function listRetailStockCounts(tenantId) {
  const id = requireContext(tenantId);
  const snapshot = await getDocs(tenantCollection(id, "stockCounts"));
  return snapshot.docs.map(row)
    .sort((a,b)=>timeValue(b.createdAtServer||b.createdAt||b.updatedAt)-timeValue(a.createdAtServer||a.createdAt||a.updatedAt))
    .slice(0,300);
}

export function watchRetailStockCounts(tenantId, onRows, onError = () => {}) {
  const id = requireContext(tenantId);
  return onSnapshot(tenantCollection(id, "stockCounts"), snapshot => {
    onRows(snapshot.docs.map(row)
      .sort((a,b)=>timeValue(b.createdAtServer||b.createdAt||b.updatedAt)-timeValue(a.createdAtServer||a.createdAt||a.updatedAt))
      .slice(0,300));
  }, onError);
}

export async function commitRetailStockCount(tenantId, input = {}) {
  const id=requireContext(tenantId), uid=auth.currentUser?.uid||"";
  if(!uid) throw new Error("AUTH_REQUIRED");
  const countId=cleanName(input.id)||`COUNT-${Date.now()}`;
  const createdAt=nowIso(), rows=(input.items||[]).filter(item=>item.actual!==""&&item.actual!=null);
  if(!rows.length) throw new Error("COUNT_ITEMS_REQUIRED");
  let committed=null;
  await runTransaction(db, async transaction=>{
    const refs=rows.map(item=>{
      const productId=String(item.productId||item.id||"").trim();
      const documentId=String(item.documentId||item._documentId||productId).trim();
      if(!productId||!documentId) throw new Error("PRODUCT_NOT_FOUND");
      return {item,productId,documentId,ref:tenantDoc(id,"products",documentId)};
    });
    const snapshots=await Promise.all(refs.map(entry=>transaction.get(entry.ref)));
    const normalized=refs.map((entry,index)=>{
      const snap=snapshots[index];
      if(!snap.exists()) throw new Error("PRODUCT_NOT_FOUND");
      const product=normalizeProduct({_documentId:snap.id,...snap.data(),id:entry.productId});
      const before=Number(product.stock||0), actual=Number(entry.item.actual);
      if(!Number.isFinite(actual)||actual<0) throw new Error("INVALID_QUANTITY");
      const difference=actual-before, cost=Number(product.cost||0);
      return {...entry,product,before,actual,difference,cost,
        line:{
          productId:entry.productId,
          productName:product.name,
          unit:product.unit||"ชิ้น",
          system:before,
          actual,
          difference,
          systemQty:before,
          actualQty:actual,
          variance:difference,
          varianceValue:difference*cost,
          cost,
        }};
    });
    normalized.forEach(entry=>{
      if(entry.actual===entry.before) return;
      transaction.update(entry.ref,{stock:entry.actual,tenantId:id,shopId:entry.product.shopId||id,updatedAt:Date.now(),updatedAtServer:serverTimestamp()});
      const movement={...movementPayload({
        tenantId:id,
        product:entry.product,
        before:entry.before,
        after:entry.actual,
        action:"set",
        type:"adjustment",
        note:cleanName(input.movementNote)||`ตรวจนับสต็อก ${countId}`,
      }),referenceType:"stock_count",referenceId:countId,referenceNumber:countId};
      transaction.set(tenantDoc(id,"stockMovements",movement.id),movement,{merge:true});
    });
    const lines=normalized.map(entry=>entry.line);
    const summary={
      id:countId,tenantId:id,shopId:id,name:cleanName(input.name)||`ตรวจนับ ${createdAt.slice(0,10)}`,countDate:String(input.countDate||createdAt.slice(0,10)),
      countedBy:cleanName(input.countedBy)||auth.currentUser?.displayName||auth.currentUser?.email||"",note:cleanName(input.note),items:lines,
      itemCount:lines.length,countedItems:lines.length,differenceCount:lines.filter(r=>r.difference!==0).length,
      shortQty:lines.filter(r=>r.difference<0).reduce((a,r)=>a+Math.abs(r.difference),0),
      overQty:lines.filter(r=>r.difference>0).reduce((a,r)=>a+r.difference,0),varianceValue:lines.reduce((a,r)=>a+r.varianceValue,0),
      createdBy:uid,updatedBy:uid,createdAt,updatedAt:Date.now(),createdAtServer:serverTimestamp(),updatedAtServer:serverTimestamp()
    };
    transaction.set(tenantDoc(id,"stockCounts",countId),summary,{merge:true});
    committed=summary;
  });
  return committed;
}
