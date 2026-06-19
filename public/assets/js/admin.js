import { dataService, usingDemoMode } from "./data-service.js";
import { storage, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";
import { money, toast } from "./ui.js";

if (usingDemoMode) {
  document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง: ข้อมูลอยู่ในเบราว์เซอร์นี้</div>';
}

let menus = [];
let tables = [];
let selectedImageFile = null;

const menuImage = document.querySelector("#menuImage");
const menuImagePath = document.querySelector("#menuImagePath");
const previewWrap = document.querySelector("#menuImagePreviewWrap");
const preview = document.querySelector("#menuImagePreview");

function showPreview(src) {
  if (!src) {
    previewWrap.hidden = true;
    preview.removeAttribute("src");
    return;
  }
  preview.src = src;
  previewWrap.hidden = false;
}

async function resizeImage(file) {
  if (file.size > 8 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
  const bitmap = await createImageBitmap(file);
  const maxSize = 1200;
  const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, "image/webp", .82));
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
      <td>${item.image ? `<img src="${item.image}" alt="${item.name}" style="width:58px;height:46px;object-fit:cover;border-radius:8px">` : "-"}</td>
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

document.querySelector("#menuImageFile").addEventListener("change", event => {
  selectedImageFile = event.target.files?.[0] || null;
  if (selectedImageFile) showPreview(URL.createObjectURL(selectedImageFile));
});

document.querySelector("#removeMenuImage").addEventListener("click", () => {
  selectedImageFile = null;
  menuImage.value = "";
  menuImagePath.value = "";
  document.querySelector("#menuImageFile").value = "";
  showPreview("");
});

document.querySelector("#menuForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = document.querySelector("#saveMenuButton");
  button.disabled = true;
  button.textContent = selectedImageFile ? "กำลังอัปโหลดรูป..." : "กำลังบันทึก...";

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
    toast(error.message === "IMAGE_TOO_LARGE" ? "รูปต้องมีขนาดไม่เกิน 8 MB" : "บันทึกเมนูไม่สำเร็จ", "error");
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
    menuImage.value = item.image || "";
    menuImagePath.value = item.imagePath || "";
    document.querySelector("#menuActive").checked = item.active !== false;
    selectedImageFile = null;
    showPreview(item.image || "");
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

await load();
