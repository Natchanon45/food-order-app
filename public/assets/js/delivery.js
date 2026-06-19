import { dataService, usingDemoMode } from "./data-service.js";
import { storage, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";
import { money, toast } from "./ui.js";
import { generatePromptPayPayload } from "./promptpay.js";

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';

const menuGrid = document.querySelector("#menuGrid");
const cartList = document.querySelector("#cartList");
const categoryTabs = document.querySelector("#categoryTabs");
const paymentMethod = document.querySelector("#paymentMethod");
const promptPaySection = document.querySelector("#promptPaySection");
const promptPayQr = document.querySelector("#promptPayQr");
const promptPayPlaceholder = document.querySelector("#promptPayPlaceholder");
const promptPayAmount = document.querySelector("#promptPayAmount");
const promptPayName = document.querySelector("#promptPayName");
const paymentSlipWrap = document.querySelector("#paymentSlipWrap");
const paymentSlip = document.querySelector("#paymentSlip");
const paymentSlipDropzone = document.querySelector("#paymentSlipDropzone");
const paymentSlipContent = document.querySelector("#paymentSlipContent");
const paymentSlipPreviewWrap = document.querySelector("#paymentSlipPreviewWrap");
const paymentSlipPreview = document.querySelector("#paymentSlipPreview");
const paymentSlipFileName = document.querySelector("#paymentSlipFileName");
const paymentSlipFileSize = document.querySelector("#paymentSlipFileSize");
const paymentSlipError = document.querySelector("#paymentSlipError");
const removePaymentSlip = document.querySelector("#removePaymentSlip");
const cart = new Map();
let menus = [];
let activeCategory = "ทั้งหมด";
let storeSettings = {};
let currentTotal = 0;
let selectedSlipFile = null;
let selectedSlipObjectUrl = "";

function categories() {
  return ["ทั้งหมด", ...new Set(menus.filter(x => x.active !== false).map(x => x.category || "อื่น ๆ"))];
}

function renderTabs() {
  categoryTabs.innerHTML = categories().map(category => `<button type="button" class="category-tab${category === activeCategory ? " active" : ""}" data-category="${category}">${category}</button>`).join("");
}

function renderMenus() {
  const keyword = document.querySelector("#searchInput").value.trim().toLowerCase();
  const filtered = menus.filter(item => item.active !== false && (!keyword || item.name.toLowerCase().includes(keyword)) && (activeCategory === "ทั้งหมด" || (item.category || "อื่น ๆ") === activeCategory));
  menuGrid.innerHTML = filtered.length ? filtered.map(item => `<article class="card menu-card"><div class="menu-image"><img src="${item.image}" alt="${item.name}"></div><div class="menu-name">${item.name}</div><div class="menu-category">${item.category || "อื่น ๆ"}</div><div class="menu-footer"><span class="price">${money(item.price)} บาท</span><button class="btn btn-primary btn-sm" data-add="${item.id}">เพิ่ม</button></div></article>`).join("") : '<div class="card empty">ไม่พบเมนู</div>';
}

function showPromptPayPlaceholder(message) {
  promptPayQr.hidden = true;
  promptPayQr.removeAttribute("src");
  promptPayPlaceholder.hidden = false;
  promptPayPlaceholder.textContent = message;
}

function renderPromptPay() {
  const isPromptPay = paymentMethod.value === "promptpay";
  promptPaySection.hidden = !isPromptPay;
  paymentSlipWrap.hidden = !isPromptPay;
  paymentSlip.required = isPromptPay;
  if (!isPromptPay) {
    clearSlipSelection();
    return;
  }

  promptPayAmount.textContent = `${money(currentTotal)} บาท`;
  promptPayName.textContent = storeSettings.promptPayName || storeSettings.bankAccountName || "";

  if (!storeSettings.promptPayId) {
    showPromptPayPlaceholder("ร้านยังไม่ได้ตั้งค่าเลขพร้อมเพย์");
    return;
  }

  if (currentTotal <= 0) {
    showPromptPayPlaceholder("เพิ่มรายการอาหารเพื่อสร้าง QR ตามยอดสุทธิ");
    return;
  }

  try {
    const payload = generatePromptPayPayload(storeSettings.promptPayId, currentTotal);
    promptPayPlaceholder.hidden = true;
    promptPayQr.hidden = false;
    promptPayQr.src = `https://quickchart.io/qr?text=${encodeURIComponent(payload)}&size=320&margin=1`;
    promptPayQr.onerror = () => showPromptPayPlaceholder("สร้าง QR ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  } catch (error) {
    console.error(error);
    showPromptPayPlaceholder("เลขพร้อมเพย์ไม่ถูกต้อง กรุณาติดต่อร้าน");
  }
}

function updateCart() {
  const items = [...cart.values()];
  cartList.innerHTML = items.length ? items.map(item => `<div class="cart-row"><div><strong>${item.name}</strong><div class="menu-category">${money(item.price)} บาท</div><input class="input" data-note="${item.id}" value="${item.note || ""}" placeholder="หมายเหตุรายการ" style="margin-top:7px"></div><div class="qty"><button data-dec="${item.id}">−</button><strong>${item.qty}</strong><button data-inc="${item.id}">+</button></div></div>`).join("") : '<div class="empty">ยังไม่มีรายการในตะกร้า</div>';
  const totalQty = items.reduce((sum, x) => sum + x.qty, 0);
  currentTotal = items.reduce((sum, x) => sum + x.qty * Number(x.price), 0);
  document.querySelector("#cartCount").textContent = `${totalQty} รายการ`;
  document.querySelector("#cartTotal").textContent = money(currentTotal);
  document.querySelector("#submitOrder").disabled = !items.length;
  renderPromptPay();
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function setSlipError(message = "") {
  paymentSlipError.textContent = message;
  paymentSlipError.hidden = !message;
}

function clearSlipSelection() {
  selectedSlipFile = null;
  paymentSlip.value = "";
  paymentSlipDropzone.classList.remove("has-file", "is-dragover");
  paymentSlipContent.hidden = false;
  paymentSlipPreviewWrap.hidden = true;
  removePaymentSlip.hidden = true;
  paymentSlipPreview.removeAttribute("src");
  paymentSlipFileName.textContent = "-";
  paymentSlipFileSize.textContent = "-";
  setSlipError("");
  if (selectedSlipObjectUrl) URL.revokeObjectURL(selectedSlipObjectUrl);
  selectedSlipObjectUrl = "";
}

function selectSlipFile(file) {
  if (!file) return;
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (file.size > 8 * 1024 * 1024) {
    clearSlipSelection();
    setSlipError("สลิปต้องมีขนาดไม่เกิน 8 MB");
    toast("สลิปต้องมีขนาดไม่เกิน 8 MB", "error");
    return;
  }
  if (file.type && !allowedTypes.includes(file.type)) {
    clearSlipSelection();
    setSlipError("รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WebP และ HEIC");
    toast("ชนิดไฟล์สลิปไม่รองรับ", "error");
    return;
  }

  if (selectedSlipObjectUrl) URL.revokeObjectURL(selectedSlipObjectUrl);
  selectedSlipFile = file;
  selectedSlipObjectUrl = URL.createObjectURL(file);
  paymentSlipPreview.src = selectedSlipObjectUrl;
  paymentSlipFileName.textContent = file.name || "สลิปการชำระเงิน";
  paymentSlipFileSize.textContent = formatFileSize(file.size);
  paymentSlipContent.hidden = true;
  paymentSlipPreviewWrap.hidden = false;
  removePaymentSlip.hidden = false;
  paymentSlipDropzone.classList.add("has-file");
  setSlipError("");
}

async function uploadSlip(file, orderId) {
  if (!file) return { url: "", path: "" };
  if (file.size > 8 * 1024 * 1024) throw new Error("SLIP_TOO_LARGE");
  if (!storage) throw new Error("STORAGE_NOT_READY");
  const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
  const path = `payment-slips/${orderId}/${Date.now()}.${extension}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type || "image/jpeg" });
  return { url: await getDownloadURL(fileRef), path };
}

paymentSlip.addEventListener("change", event => selectSlipFile(event.target.files?.[0] || null));

for (const eventName of ["dragenter", "dragover"]) {
  paymentSlipDropzone.addEventListener(eventName, event => {
    event.preventDefault();
    paymentSlipDropzone.classList.add("is-dragover");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  paymentSlipDropzone.addEventListener(eventName, event => {
    event.preventDefault();
    paymentSlipDropzone.classList.remove("is-dragover");
  });
}

paymentSlipDropzone.addEventListener("drop", event => selectSlipFile(event.dataTransfer?.files?.[0] || null));
removePaymentSlip.addEventListener("click", clearSlipSelection);

categoryTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  renderTabs();
  renderMenus();
});

document.querySelector("#searchInput").addEventListener("input", renderMenus);
paymentMethod.addEventListener("change", renderPromptPay);
menuGrid.addEventListener("click", event => {
  const id = event.target.dataset.add;
  if (!id) return;
  const menu = menus.find(x => x.id === id);
  const current = cart.get(id);
  cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" });
  updateCart();
  toast(`เพิ่ม ${menu.name} แล้ว`);
});
cartList.addEventListener("click", event => {
  const id = event.target.dataset.inc || event.target.dataset.dec;
  if (!id) return;
  const item = cart.get(id);
  item.qty += event.target.dataset.inc ? 1 : -1;
  if (item.qty <= 0) cart.delete(id); else cart.set(id, item);
  updateCart();
});
cartList.addEventListener("input", event => {
  const id = event.target.dataset.note;
  if (!id) return;
  const item = cart.get(id);
  item.note = event.target.value;
  cart.set(id, item);
});

document.querySelector("#submitOrder").addEventListener("click", async () => {
  const recipientName = document.querySelector("#recipientName").value.trim();
  const recipientPhone = document.querySelector("#recipientPhone").value.trim();
  const deliveryAddress = document.querySelector("#deliveryAddress").value.trim();
  if (!recipientName || !recipientPhone || !deliveryAddress) {
    toast("กรุณากรอกชื่อผู้รับ ที่อยู่ และเบอร์โทรศัพท์", "error");
    return;
  }

  const method = paymentMethod.value;
  if (method === "promptpay" && !storeSettings.promptPayId) {
    toast("ร้านยังไม่ได้ตั้งค่าเลขพร้อมเพย์", "error");
    return;
  }
  if (method === "promptpay" && !selectedSlipFile) {
    setSlipError("กรุณาแนบสลิปก่อนยืนยันคำสั่งซื้อ");
    paymentSlipDropzone.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("กรุณาแนบสลิปหรือหลักฐานการชำระ", "error");
    return;
  }

  const button = document.querySelector("#submitOrder");
  const items = [...cart.values()].map(({ id, name, price, qty, note }) => ({ menuId: id, name, price: Number(price), qty, note: note || "", cancelled: false }));
  const totalAmount = items.reduce((sum, x) => sum + x.price * x.qty, 0);

  button.disabled = true;
  button.textContent = "กำลังส่ง...";
  try {
    const result = await dataService.createOrder({
      orderType: "delivery",
      tableCode: "DELIVERY",
      recipientName,
      recipientPhone,
      deliveryAddress,
      paymentMethod: method,
      paymentStatus: method === "promptpay" ? "pending_verification" : "unpaid",
      status: "pending",
      totalAmount,
      note: document.querySelector("#orderNote").value.trim(),
      items
    });

    if (method === "promptpay" && result?.id) {
      const slip = await uploadSlip(selectedSlipFile, result.id);
      await dataService.updateOrder(result.id, { paymentSlipUrl: slip.url, paymentSlipPath: slip.path });
    }

    cart.clear();
    clearSlipSelection();
    updateCart();
    toast("ส่งคำสั่งซื้อ Delivery เรียบร้อย");
    if (result?.id) location.href = `/delivery/success/?order=${encodeURIComponent(result.id)}`;
  } catch (error) {
    console.error(error);
    const message = error.message === "SLIP_TOO_LARGE" ? "สลิปต้องมีขนาดไม่เกิน 8 MB" : "ส่งคำสั่งซื้อไม่สำเร็จ";
    toast(message, "error");
  } finally {
    button.textContent = "ยืนยันการสั่ง";
    updateCart();
  }
});

[menus, storeSettings] = await Promise.all([dataService.listMenus(), dataService.getStoreSettings()]);
renderTabs();
renderMenus();
updateCart();
