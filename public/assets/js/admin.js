import "./admin-delivery-qr.js?v=20260629-046";
import { dataService, usingDemoMode } from "./data-service.js";
import { storage, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";
import { money, toast, DEFAULT_FOOD_IMAGE } from "./ui.js";
import { getMenuImagePosition, setMenuImagePosition } from "./admin-image-position.js";

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: ข้อมูลอยู่ในเบราว์เซอร์นี้</div>';

let menus = [];
let tables = [];
let selectedImageFile = null;

const menuImage = document.querySelector("#menuImage");
const menuImagePath = document.querySelector("#menuImagePath");
const fileInput = document.querySelector("#menuImageFile");
const dropzone = document.querySelector("#menuImageDropzone");
const dropzoneContent = document.querySelector("#menuImageDropzoneContent");
const previewWrap = document.querySelector("#menuImagePreviewWrap");
const preview = document.querySelector("#menuImagePreview");
const fileName = document.querySelector("#menuImageFileName");
const fileSize = document.querySelector("#menuImageFileSize");
const removeImageButton = document.querySelector("#removeMenuImage");
const imageError = document.querySelector("#menuImageError");

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setImageError(message = "") {
  imageError.textContent = message;
  imageError.hidden = !message;
}

function showPreview(src, name = "รูปอาหารเดิม", sizeText = "") {
  if (!src) {
    preview.src = DEFAULT_FOOD_IMAGE;
    previewWrap.hidden = true;
    dropzoneContent.hidden = false;
    dropzone.classList.remove("has-image");
    removeImageButton.hidden = true;
    fileName.textContent = "-";
    fileSize.textContent = "-";
    return;
  }
  preview.onerror = () => { preview.onerror = null; preview.src = DEFAULT_FOOD_IMAGE; };
  preview.src = src;
  previewWrap.hidden = false;
  dropzoneContent.hidden = true;
  dropzone.classList.add("has-image");
  removeImageButton.hidden = false;
  fileName.textContent = name;
  fileSize.textContent = sizeText;
}

function validateImageFile(file) {
  if (!file) throw new Error("NO_IMAGE_FILE");
  if (file.size > 8 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (file.type && !allowed.includes(file.type)) throw new Error("INVALID_IMAGE_TYPE");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("IMAGE_PREVIEW_FAILED"));
    reader.readAsDataURL(file);
  });
}

async function selectImageFile(file) {
  try {
    validateImageFile(file);
    const previewUrl = await readFileAsDataUrl(file);
    selectedImageFile = file;
    setImageError("");
    setMenuImagePosition(50, 50);
    showPreview(previewUrl, file.name || "รูปอาหาร", formatFileSize(file.size));
  } catch (error) {
    selectedImageFile = null;
    showPreview(menuImage.value.trim());
    const messages = { IMAGE_TOO_LARGE: "รูปภาพต้องมีขนาดไม่เกิน 8 MB", INVALID_IMAGE_TYPE: "รองรับเฉพาะ JPG, PNG, WEBP, HEIC/HEIF", NO_IMAGE_FILE: "ไม่พบไฟล์รูปภาพ", IMAGE_PREVIEW_FAILED: "ไม่สามารถอ่านไฟล์รูปภาพได้" };
    setImageError(messages[error.message] || "ไม่สามารถเลือกไฟล์รูปภาพได้");
  }
}

fileInput?.addEventListener("change", () => selectImageFile(fileInput.files?.[0]));
dropzone?.addEventListener("click", event => { if (event.target !== fileInput) fileInput?.click(); });
["dragenter", "dragover"].forEach(type => dropzone?.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add("is-dragover"); }));
["dragleave", "drop"].forEach(type => dropzone?.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove("is-dragover"); }));
dropzone?.addEventListener("drop", event => selectImageFile(event.dataTransfer?.files?.[0]));
removeImageButton?.addEventListener("click", () => { selectedImageFile = null; fileInput.value = ""; menuImage.value = ""; menuImagePath.value = ""; showPreview(""); setImageError(""); });

async function uploadSelectedImage() {
  if (!selectedImageFile) return menuImage.value.trim();
  const activeShop = dataService.getActiveShop();
  const safeShop = (activeShop?.id || activeShop?.slug || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeName = (selectedImageFile.name || "menu-image").replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = `menus/${safeShop}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, selectedImageFile);
  const url = await getDownloadURL(fileRef);
  menuImagePath.value = path;
  menuImage.value = url;
  return url;
}
