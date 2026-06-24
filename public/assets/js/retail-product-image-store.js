const DB_NAME = "retail_pos_media_v1";
const STORE_NAME = "product_images";
const DB_VERSION = 1;
const objectUrls = new Map();

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction(mode, action) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  }));
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("สร้างไฟล์รูปไม่สำเร็จ")), type, quality);
  });
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    };
    image.src = url;
  });
}

export async function compressProductImage(file, maxSize = 600) {
  if (!(file instanceof Blob) || !String(file.type).startsWith("image/")) {
    throw new Error("กรุณาเลือกไฟล์รูปภาพ");
  }

  const bitmap = await loadBitmap(file);
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === "function") bitmap.close();

  try {
    return await canvasToBlob(canvas, "image/webp", 0.82);
  } catch {
    return canvasToBlob(canvas, "image/jpeg", 0.86);
  }
}

export async function saveProductImage(productId, file) {
  const key = String(productId || "").trim();
  if (!key) throw new Error("ไม่พบรหัสสินค้า");
  const blob = await compressProductImage(file);
  await transaction("readwrite", store => store.put(blob, key));
  const oldUrl = objectUrls.get(key);
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  objectUrls.delete(key);
  return key;
}

export async function getProductImageUrl(productId) {
  const key = String(productId || "").trim();
  if (!key) return "";
  if (objectUrls.has(key)) return objectUrls.get(key);
  const blob = await transaction("readonly", store => store.get(key));
  if (!blob) return "";
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
}

export async function deleteProductImage(productId) {
  const key = String(productId || "").trim();
  if (!key) return;
  await transaction("readwrite", store => store.delete(key));
  const url = objectUrls.get(key);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(key);
}
