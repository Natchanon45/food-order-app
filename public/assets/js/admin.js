import { dataService, usingDemoMode } from "./data-service.js";
import { storage, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";
import { money, toast, DEFAULT_FOOD_IMAGE } from "./ui.js";

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: ข้อมูลอยู่ในเบราว์เซอร์นี้</div>';
}

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

  preview.onerror = () => {
    preview.onerror = null;
    preview.src = DEFAULT_FOOD_IMAGE;
  };
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
    showPreview(previewUrl, file.name || "รูปอาหาร", formatFileSize(file.size));
  } catch (error) {
    selectedImageFile = null;
    fileInput.value = "";
    let message = "ไม่สามารถอ่านไฟล์รูปนี้ได้";
    if (error.message === "IMAGE_TOO_LARGE") message = "รูปต้องมีขนาดไม่เกิน 8 MB";
    if (error.message === "INVALID_IMAGE_TYPE") message = "รองรับเฉพาะไฟล์ JPG, PNG, WebP และ HEIC";
    setImageError(message);
    toast(message, "error");
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("IMAGE_DECODE_FAILED"));
    };
    image.src = objectUrl;
  });
}

async function resizeImage(file) {
  validateImageFile(file);
  const image = await loadImageElement(file);
  const maxSize = 1200;
  const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  canvas.getContext("2d", { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .82));
  if (!blob) throw new Error("IMAGE_CONVERT_FAILED");
  return blob;
}

async function uploadMenuImage(file, menuId) {
  const blob = await resizeImage(file);

  if (usingDemoMode) {
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result, path: "" });
      reader.readAsDataURL(blob);
    });
  }

  if (!storage) throw new Error("STORAGE_NOT_READY");

  const path = `menu-images/${menuId}/${Date.now()}.webp`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType: "image/webp" });
  return { url: await getDownloadURL(fileRef), path };
}

async function load() {
  const [menuData, tableData, settings] = await Promise.all([
    dataService.listMenus(),
    dataService.listTables(),
    dataService.getStoreSettings()
  ]);
  menus = menuData;
  tables = tableData;

  document.querySelector("#shopName").value = settings.shopName || "";
  document.querySelector("#shopAddress").value = settings.shopAddress || "";
  document.querySelector("#shopPhone").value = settings.shopPhone || "";

  document.querySelector("#menuRows").innerHTML = menus.map(item => `
    <tr>
      <td><img src="${item.image || DEFAULT_FOOD_IMAGE}" alt="${item.name}" data-food-image style="width:58px;height:46px;object-fit:cover;border-radius:8px"></td>
      <td><strong>${item.name}</strong></td>
      <td>${item.category || "-"}</td>
      <td>${money(item.price)}</td>
      <td>${item.active !== false ? '<span class="badge">เปิดขาย</span>' : '<span class="badge dark">ปิด</span>'}</td>
      <td><button class="btn btn-sm" data-edit-menu="${item.id}">แก้ไข</button> <button class="btn btn-danger btn-sm" data-delete-menu="${item.id}">ลบ</button></td>
    </tr>
  `).join("");

  document.querySelector("#tableRows").innerHTML = tables.map(item => `
    <tr>
      <td><strong>${item.code}</strong></td>
      <td>${item.name}</td>
      <td>${item.active !== false ? '<span class="badge">ใช้งาน</span>' : '<span class="badge dark">ปิด</span>'}</td>
      <td><button class="btn btn-sm" data-edit-table="${item.id}">แก้ไข</button> <button class="btn btn-danger btn-sm" data-delete-table="${item.id}">ลบ</button></td>
    </tr>
  `).join("");
}

document.querySelector("#storeForm").addEventListener("submit", async event => {
  event.preventDefault();
  await dataService.saveStoreSettings({
    shopName: document.querySelector("#shopName").value.trim(),
    shopAddress: document.querySelector("#shopAddress").value.trim(),
    shopPhone: document.querySelector("#shopPhone").value.trim()
  });
  toast("บันทึกข้อมูลร้านแล้ว");
});

fileInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) selectImageFile(file);
});

for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropzone.addEventListener(eventName, event => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
  });
}

dropzone.addEventListener("drop", event => {
  const file = event.dataTransfer?.files?.[0];
  if (file) selectImageFile(file);
});

removeImageButton.addEventListener("click", () => {
  selectedImageFile = null;
  menuImage.value = "";
  menuImagePath.value = "";
  fileInput.value = "";
  setImageError("");
  showPreview("");
});

document.querySelector("#menuForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.querySelector("#saveMenuButton");
  button.disabled = true;
  button.textContent = selectedImageFile ? "กำลังอัปโหลดรูป..." : "กำลังบันทึก...";
  setImageError("");

  try {
    const id = document.querySelector("#menuId").value || crypto.randomUUID();
    let image = menuImage.value;
    let imagePath = menuImagePath.value;

    if (selectedImageFile) {
      const uploaded = await uploadMenuImage(selectedImageFile, id);
      image = uploaded.url;
      imagePath = uploaded.path;
    }

    await dataService.saveMenu({
      id,
      name: document.querySelector("#menuName").value.trim(),
      category: document.querySelector("#menuCategory").value.trim(),
      price: Number(document.querySelector("#menuPrice").value),
      image,
      imagePath,
      active: document.querySelector("#menuActive").checked
    });

    event.target.reset();
    document.querySelector("#menuId").value = "";
    menuImage.value = "";
    menuImagePath.value = "";
    document.querySelector("#menuActive").checked = true;
    selectedImageFile = null;
    showPreview("");
    toast("บันทึกเมนูแล้ว");
    await load();
  } catch (error) {
    console.error(error);
    let message = "บันทึกเมนูไม่สำเร็จ";
    if (error.message === "IMAGE_TOO_LARGE") message = "รูปต้องมีขนาดไม่เกิน 8 MB";
    if (error.message === "INVALID_IMAGE_TYPE") message = "ชนิดไฟล์รูปไม่รองรับ";
    if (["IMAGE_DECODE_FAILED", "IMAGE_CONVERT_FAILED"].includes(error.message)) message = "เบราว์เซอร์อ่านรูปนี้ไม่ได้ กรุณาใช้ JPG, PNG หรือ WebP";
    if (error.message === "STORAGE_NOT_READY" || error.code === "storage/unknown" || error.code === "storage/unauthorized") {
      message = "Firebase Storage ยังไม่พร้อมใช้งาน กรุณาตรวจสอบ Storage rules";
    }
    setImageError(message);
    toast(message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "บันทึกเมนู";
  }
});

document.querySelector("#tableForm").addEventListener("submit", async event => {
  event.preventDefault();
  const code = document.querySelector("#tableCode").value.trim().toUpperCase();
  await dataService.saveTable({
    id: document.querySelector("#tableId").value || code,
    code,
    name: document.querySelector("#tableName").value.trim(),
    active: document.querySelector("#tableActive").checked
  });
  event.target.reset();
  document.querySelector("#tableActive").checked = true;
  toast("บันทึกโต๊ะแล้ว");
  await load();
});

document.body.addEventListener("click", async event => {
  const editMenu = event.target.dataset.editMenu;
  const deleteMenu = event.target.dataset.deleteMenu;
  const editTable = event.target.dataset.editTable;
  const deleteTable = event.target.dataset.deleteTable;

  if (editMenu) {
    const item = menus.find(row => row.id === editMenu);
    document.querySelector("#menuId").value = item.id;
    document.querySelector("#menuName").value = item.name;
    document.querySelector("#menuCategory").value = item.category || "";
    document.querySelector("#menuPrice").value = item.price;
    menuImage.value = item.image && item.image !== DEFAULT_FOOD_IMAGE ? item.image : "";
    menuImagePath.value = item.imagePath || "";
    document.querySelector("#menuActive").checked = item.active !== false;
    selectedImageFile = null;
    fileInput.value = "";
    setImageError("");
    showPreview(item.image || DEFAULT_FOOD_IMAGE, "รูปอาหารเดิม", "");
    scrollTo({ top: 0, behavior: "smooth" });
  }

  if (deleteMenu && confirm("ยืนยันลบเมนูนี้?")) {
    await dataService.deleteMenu(deleteMenu);
    toast("ลบเมนูแล้ว");
    await load();
  }

  if (editTable) {
    const item = tables.find(row => row.id === editTable);
    document.querySelector("#tableId").value = item.id;
    document.querySelector("#tableCode").value = item.code;
    document.querySelector("#tableName").value = item.name;
    document.querySelector("#tableActive").checked = item.active !== false;
    scrollTo({ top: 0, behavior: "smooth" });
  }

  if (deleteTable && confirm("ยืนยันลบโต๊ะนี้?")) {
    await dataService.deleteTable(deleteTable);
    toast("ลบโต๊ะแล้ว");
    await load();
  }
});

showPreview("");
await load();
