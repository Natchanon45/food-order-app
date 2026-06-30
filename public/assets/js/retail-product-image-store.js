import { storage, ref, uploadBytes, getDownloadURL, deleteObject } from "./firebase-config.js?v=20260630-073";
import { getTenantId } from "./retail-db.js";

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

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = String(dataUrl || "").split(",");
  if (!header || !encoded) throw new Error("ข้อมูลรูปไม่ถูกต้อง");
  const mime = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
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

function firebaseImagePath(productId) {
  const safeProductId = encodeURIComponent(String(productId || "").trim());
  return `tenants/${getTenantId()}/product-images/${safeProductId}/product.webp`;
}

async function saveLocalProductImage(productId, blob) {
  const key = String(productId || "").trim();
  if (!key) throw new Error("ไม่พบรหัสสินค้า");
  await transaction("readwrite", store => store.put(blob, key));
  const oldUrl = objectUrls.get(key);
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  objectUrls.delete(key);
  return key;
}

export async function saveProductImage(productId, file) {
  const key = String(productId || "").trim();
  if (!key) throw new Error("ไม่พบรหัสสินค้า");
  if (!storage) throw new Error("ยังไม่ได้เชื่อมต่อ Firebase Storage");

  const blob = await compressProductImage(file);
  const imagePath = firebaseImagePath(key);
  const imageRef = ref(storage, imagePath);
  await uploadBytes(imageRef, blob, {
    contentType: blob.type || "image/webp",
    cacheControl: "public,max-age=3600"
  });
  const imageUrl = await getDownloadURL(imageRef);

  // Keep a local copy as an offline fallback without making it the source of truth.
  await saveLocalProductImage(key, blob);
  return { imageKey: key, imagePath, imageUrl };
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

export async function deleteProductImage(productOrKey) {
  const product = typeof productOrKey === "object" && productOrKey ? productOrKey : {};
  const key = String(product.imageKey || (typeof productOrKey === "string" ? productOrKey : "")).trim();
  const imagePath = String(product.imagePath || "").trim();

  if (imagePath && storage) {
    try {
      await deleteObject(ref(storage, imagePath));
    } catch (error) {
      if (error?.code !== "storage/object-not-found") throw error;
    }
  }
  if (!key) return;
  await transaction("readwrite", store => store.delete(key));
  const url = objectUrls.get(key);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(key);
}

export async function exportProductImages() {
  const db = await openDb();
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const keysRequest = store.getAllKeys();
    const valuesRequest = store.getAll();
    let keys;
    let values;

    function finishIfReady() {
      if (!keys || !values) return;
      resolve(keys.map((key, index) => ({ key: String(key), blob: values[index] })));
    }

    keysRequest.onsuccess = () => {
      keys = keysRequest.result || [];
      finishIfReady();
    };
    valuesRequest.onsuccess = () => {
      values = valuesRequest.result || [];
      finishIfReady();
    };
    keysRequest.onerror = () => reject(keysRequest.error);
    valuesRequest.onerror = () => reject(valuesRequest.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => db.close();
  });

  return Promise.all(records.map(async record => ({
    key: record.key,
    dataUrl: await blobToDataUrl(record.blob)
  })));
}

export async function importProductImages(images, { clearExisting = true } = {}) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    if (clearExisting) store.clear();
    (Array.isArray(images) ? images : []).forEach(item => {
      if (!item?.key || !item?.dataUrl) return;
      store.put(dataUrlToBlob(item.dataUrl), String(item.key));
    });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  objectUrls.forEach(url => URL.revokeObjectURL(url));
  objectUrls.clear();
}

function enhanceProductImageDropzone() {
  const input = document.querySelector("#productImageFile");
  if (!input || input.dataset.dropzoneReady === "1") return;

  const label = input.closest("label");
  if (!label) return;

  input.dataset.dropzoneReady = "1";
  label.classList.add("product-upload-dropzone");

  const content = document.createElement("div");
  content.className = "product-upload-content";
  content.innerHTML = `
    <div class="product-upload-icon">⇧</div>
    <div class="product-upload-title">ลากรูปมาวางที่นี่</div>
    <div class="product-upload-help">หรือคลิกเพื่อเลือกรูปจากเครื่อง</div>
    <div class="product-upload-file" hidden></div>
  `;

  label.insertBefore(content, input);

  const fileText = content.querySelector(".product-upload-file");
  const title = content.querySelector(".product-upload-title");

  function updateState() {
    const file = input.files?.[0];
    label.classList.toggle("has-file", Boolean(file));
    if (file) {
      title.textContent = "เลือกรูปแล้ว";
      fileText.textContent = file.name;
      fileText.hidden = false;
    } else {
      title.textContent = "ลากรูปมาวางที่นี่";
      fileText.textContent = "";
      fileText.hidden = true;
    }
  }

  function acceptFiles(files) {
    const file = [...files].find(item => String(item.type || "").startsWith("image/"));
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    updateState();
  }

  ["dragenter", "dragover"].forEach(type => {
    label.addEventListener(type, event => {
      event.preventDefault();
      label.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    label.addEventListener(type, event => {
      event.preventDefault();
      label.classList.remove("is-dragover");
    });
  });

  label.addEventListener("drop", event => acceptFiles(event.dataTransfer?.files || []));
  input.addEventListener("change", updateState);
  document.querySelector("#removeProductImage")?.addEventListener("click", () => setTimeout(updateState, 0));
  document.querySelector("#addProductBtn")?.addEventListener("click", () => setTimeout(updateState, 0));
  document.querySelector("#productTableBody")?.addEventListener("click", event => {
    if (event.target.closest('[data-action="edit"]')) setTimeout(updateState, 0);
  });

  updateState();
}

setTimeout(enhanceProductImageDropzone, 0);
