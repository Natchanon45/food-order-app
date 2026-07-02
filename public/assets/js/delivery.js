import { dataService, usingDemoMode } from "./data-service.js?v=20260701-009";
import { storage, ref, uploadBytes } from "./firebase-config.js?v=20260630-073";
import { money, toast } from "./ui.js?v=20260701-003";
import { generatePromptPayPayload } from "./promptpay.js";
import "./cart-item-layout.js?v=20260702-002";

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';

const menuGrid = document.querySelector("#menuGrid");
const cartList = document.querySelector("#cartList");
const categoryTabs = document.querySelector("#categoryTabs");
const paymentMethod = document.querySelector("#paymentMethod");
const deliveryZone = document.querySelector("#deliveryZone");
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
const submitOrderButton = document.querySelector("#submitOrder");
const cart = new Map();
let menus = [];
let activeCategory = "ทั้งหมด";
let storeSettings = {};
let currentSubtotal = 0;
let currentDeliveryFee = 0;
let currentTotal = 0;
let selectedSlipFile = null;
let selectedSlipObjectUrl = "";
let isSubmitting = false;

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function createOrderId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function categories() { return ["ทั้งหมด", ...new Set(menus.filter(x => x.active !== false).map(x => x.category || "อื่น ๆ"))]; }
function renderTabs() { categoryTabs.innerHTML = categories().map(category => `<button type="button" class="category-tab${category === activeCategory ? " active" : ""}" data-category="${category}">${category}</button>`).join(""); }
function renderMenus() { const keyword = document.querySelector("#searchInput").value.trim().toLowerCase(); const filtered = menus.filter(item => item.active !== false && (!keyword || item.name.toLowerCase().includes(keyword)) && (activeCategory === "ทั้งหมด" || (item.category || "อื่น ๆ") === activeCategory)); menuGrid.innerHTML = filtered.length ? filtered.map(item => `<article class="card menu-card"><div class="menu-image"><img src="${item.image}" alt="${item.name}"></div><div class="menu-name">${item.name}</div><div class="menu-category">${item.category || "อื่น ๆ"}</div><div class="menu-footer"><span class="price">${money(item.price)} บาท</span><button class="btn btn-primary btn-sm" data-add="${item.id}">เพิ่ม</button></div></article>`).join("") : '<div class="card empty">ไม่พบเมนู</div>'; }
function deliveryZones() { return [{ id: "nearby", label: "ในเขตใกล้ร้าน", fee: Number(storeSettings.deliveryFeeNearby ?? 0) }, { id: "general", label: "พื้นที่ทั่วไป", fee: Number(storeSettings.deliveryFeeGeneral ?? 30) }, { id: "far", label: "พื้นที่ห่างไกล", fee: Number(storeSettings.deliveryFeeFar ?? 50) }]; }
function renderDeliveryZones() { const previous = deliveryZone.value || "nearby"; deliveryZone.innerHTML = deliveryZones().map(zone => `<option value="${zone.id}">${zone.label} • ${money(zone.fee)} บาท</option>`).join(""); deliveryZone.value = deliveryZones().some(zone => zone.id === previous) ? previous : "nearby"; }
function selectedZone() { return deliveryZones().find(zone => zone.id === deliveryZone.value) || deliveryZones()[0]; }
function showPromptPayPlaceholder(message) { promptPayQr.hidden = true; promptPayQr.removeAttribute("src"); promptPayPlaceholder.hidden = false; promptPayPlaceholder.textContent = message; }
function renderPromptPay() {
  const isPromptPay = paymentMethod.value === "promptpay";
  promptPaySection.hidden = !isPromptPay;
  paymentSlipWrap.hidden = !isPromptPay;
  paymentSlip.required = false;
  if (!isPromptPay) { clearSlipSelection(); return; }
  promptPayAmount.textContent = `${money(currentTotal)} บาท`;
  promptPayName.textContent = storeSettings.promptPayName || storeSettings.bankAccountName || "";
  if (!storeSettings.promptPayId) { showPromptPayPlaceholder("ร้านยังไม่ได้ตั้งค่าเลขพร้อมเพย์"); return; }
  if (currentSubtotal <= 0) { showPromptPayPlaceholder("เพิ่มรายการอาหารเพื่อสร้าง QR ตามยอดสุทธิ"); return; }
  try { const payload = generatePromptPayPayload(storeSettings.promptPayId, currentTotal); promptPayPlaceholder.hidden = true; promptPayQr.hidden = false; promptPayQr.src = `https://quickchart.io/qr?text=${encodeURIComponent(payload)}&size=320&margin=1`; promptPayQr.onerror = () => showPromptPayPlaceholder("สร้าง QR ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"); }
  catch (error) { console.error(error); showPromptPayPlaceholder("เลขพร้อมเพย์ไม่ถูกต้อง กรุณาติดต่อร้าน"); }
}
function updateCart() { const items = [...cart.values()]; cartList.innerHTML = items.length ? items.map(item => `<div class="cart-row"><div><strong>${item.name}</strong><div class="menu-category">${money(item.price)} บาท</div><input class="input" data-note="${item.id}" value="${item.note || ""}" placeholder="หมายเหตุรายการ" style="margin-top:7px"></div><div class="qty"><button data-dec="${item.id}">−</button><strong>${item.qty}</strong><button data-inc="${item.id}">+</button></div></div>`).join("") : '<div class="empty">ยังไม่มีรายการในตะกร้า</div>'; const totalQty = items.reduce((sum, x) => sum + x.qty, 0); currentSubtotal = items.reduce((sum, x) => sum + x.qty * Number(x.price), 0); currentDeliveryFee = currentSubtotal > 0 ? selectedZone().fee : 0; currentTotal = currentSubtotal + currentDeliveryFee; document.querySelector("#cartCount").textContent = `${totalQty} รายการ`; document.querySelector("#deliverySubtotal").textContent = money(currentSubtotal); document.querySelector("#deliveryFeeDisplay").textContent = money(currentDeliveryFee); document.querySelector("#cartTotal").textContent = money(currentTotal); submitOrderButton.disabled = isSubmitting || !items.length; renderPromptPay(); }
function formatFileSize(bytes = 0) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function setSlipError(message = "") { paymentSlipError.textContent = message; paymentSlipError.hidden = !message; }
function clearSlipSelection() { selectedSlipFile = null; paymentSlip.value = ""; paymentSlipDropzone.classList.remove("has-file", "is-dragover"); paymentSlipContent.hidden = false; paymentSlipPreviewWrap.hidden = true; removePaymentSlip.hidden = true; paymentSlipPreview.removeAttribute("src"); paymentSlipFileName.textContent = "-"; paymentSlipFileSize.textContent = "-"; setSlipError(""); if (selectedSlipObjectUrl) URL.revokeObjectURL(selectedSlipObjectUrl); selectedSlipObjectUrl = ""; }
function selectSlipFile(file) { if (!file) return; const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]; const extension = String(file.name || "").split(".").pop()?.toLowerCase() || ""; const allowedExtension = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension); if (file.size > 8 * 1024 * 1024) { clearSlipSelection(); setSlipError("สลิปต้องมีขนาดไม่เกิน 8 MB"); toast("สลิปต้องมีขนาดไม่เกิน 8 MB", "error"); return; } if ((file.type && !allowedTypes.includes(file.type)) || (!file.type && !allowedExtension)) { clearSlipSelection(); setSlipError("รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WebP และ HEIC"); toast("ชนิดไฟล์สลิปไม่รองรับ", "error"); return; } if (selectedSlipObjectUrl) URL.revokeObjectURL(selectedSlipObjectUrl); selectedSlipFile = file; selectedSlipObjectUrl = URL.createObjectURL(file); paymentSlipPreview.src = selectedSlipObjectUrl; paymentSlipFileName.textContent = file.name || "สลิปการชำระเงิน"; paymentSlipFileSize.textContent = formatFileSize(file.size); paymentSlipContent.hidden = true; paymentSlipPreviewWrap.hidden = false; removePaymentSlip.hidden = false; paymentSlipDropzone.classList.add("has-file"); setSlipError(""); toast("แนบสลิปเรียบร้อยแล้ว"); }
async function uploadSlip(file, orderId) { if (!file) return { path: "" }; if (file.size > 8 * 1024 * 1024) throw new Error("SLIP_TOO_LARGE"); if (!storage) throw new Error("STORAGE_NOT_READY"); const tenant = dataService.getActiveShop(); if (!tenant?.id) throw new Error("TENANT_NOT_READY"); const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "") || "jpg"; const path = `tenants/${tenant.id}/payment-slips/${orderId}/${Date.now()}.${extension}`; const fileRef = ref(storage, path); const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg"; await uploadBytes(fileRef, file, { contentType, customMetadata: { tenantId: tenant.id, orderId } }); return { path }; }
function submitErrorMessage(error) { const code = String(error?.code || error?.message || ""); if (code.includes("SLIP_TOO_LARGE")) return "สลิปต้องมีขนาดไม่เกิน 8 MB"; if (code.includes("TENANT_NOT_READY")) return "ไม่พบข้อมูลร้าน กรุณาเปิดหน้า Delivery จาก QR ของร้านอีกครั้ง"; if (code.includes("storage/unauthorized")) return "ระบบไม่มีสิทธิ์บันทึกสลิป กรุณาตรวจสอบ Storage Rules"; if (code.includes("storage/retry-limit-exceeded")) return "อัปโหลดสลิปไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"; if (code.includes("storage/canceled")) return "การอัปโหลดสลิปถูกยกเลิก"; if (code.includes("STORAGE_NOT_READY")) return "ระบบจัดเก็บสลิปยังไม่พร้อมใช้งาน"; return `ส่งคำสั่งซื้อไม่สำเร็จ (${code || "UNKNOWN_ERROR"})`; }

paymentSlip.addEventListener("click", event => event.stopPropagation());
paymentSlip.addEventListener("change", event => selectSlipFile(event.target.files?.[0] || null));
paymentSlipDropzone.addEventListener("click", () => paymentSlip.click());
for (const eventName of ["dragenter", "dragover"]) paymentSlipDropzone.addEventListener(eventName, event => { event.preventDefault(); paymentSlipDropzone.classList.add("is-dragover"); });
for (const eventName of ["dragleave", "drop"]) paymentSlipDropzone.addEventListener(eventName, event => { event.preventDefault(); paymentSlipDropzone.classList.remove("is-dragover"); });
paymentSlipDropzone.addEventListener("drop", event => selectSlipFile(event.dataTransfer?.files?.[0] || null));
removePaymentSlip.addEventListener("click", event => { event.stopPropagation(); clearSlipSelection(); });
categoryTabs.addEventListener("click", event => { const button = event.target.closest("[data-category]"); if (!button) return; activeCategory = button.dataset.category; renderTabs(); renderMenus(); });
document.querySelector("#searchInput").addEventListener("input", renderMenus);
paymentMethod.addEventListener("change", renderPromptPay);
deliveryZone.addEventListener("change", updateCart);
menuGrid.addEventListener("click", event => { const id = event.target.dataset.add; if (!id) return; const menu = menus.find(x => x.id === id); const current = cart.get(id); cart.set(id, current ? { ...current, qty: current.qty + 1 } : { ...menu, qty: 1, note: "" }); updateCart(); });
cartList.addEventListener("click", async event => { const inc = event.target.dataset.inc; const dec = event.target.dataset.dec; const id = inc || dec; if (!id) return; const item = cart.get(id); if (!item) return; if (inc) { item.qty += 1; cart.set(id, item); updateCart(); return; } if (item.qty <= 1) { const ok = await askConfirm(`ลบ ${item.name} ออกจากตะกร้าใช่หรือไม่?`, { title: "ลบรายการอาหาร", confirmText: "ตกลง", cancelText: "ยกเลิก", type: "warning" }); if (!ok) return; cart.delete(id); } else { item.qty -= 1; cart.set(id, item); } updateCart(); });
cartList.addEventListener("input", event => { const id = event.target.dataset.note; if (!id) return; const item = cart.get(id); item.note = event.target.value; cart.set(id, item); });

submitOrderButton.addEventListener("click", async () => {
  if (isSubmitting) return;
  const recipientName = document.querySelector("#recipientName").value.trim();
  const recipientPhone = document.querySelector("#recipientPhone").value.trim();
  const deliveryAddress = document.querySelector("#deliveryAddress").value.trim();
  if (!recipientName || !recipientPhone || !deliveryAddress) { toast("กรุณากรอกชื่อผู้รับ ที่อยู่ และเบอร์โทรศัพท์", "error"); return; }
  const method = paymentMethod.value;
  if (method === "promptpay" && !storeSettings.promptPayId) { toast("ร้านยังไม่ได้ตั้งค่าเลขพร้อมเพย์", "error"); return; }
  if (method === "promptpay" && !selectedSlipFile) { setSlipError("กรุณาแนบสลิปก่อนยืนยันคำสั่งซื้อ"); paymentSlipDropzone.scrollIntoView({ behavior: "smooth", block: "center" }); toast("กรุณาแนบสลิปหรือหลักฐานการชำระ", "error"); return; }
  const items = [...cart.values()].map(({ id, name, price, qty, note }) => ({ menuId: id, name, price: Number(price), qty, note: note || "", cancelled: false }));
  if (!items.length) return;
  const zone = selectedZone();
  const orderId = createOrderId();
  const slipFile = selectedSlipFile;
  isSubmitting = true;
  submitOrderButton.disabled = true;
  submitOrderButton.textContent = method === "promptpay" ? "กำลังบันทึกสลิป..." : "กำลังส่ง...";
  try {
    let slip = { path: "" };
    if (method === "promptpay") { slip = await uploadSlip(slipFile, orderId); submitOrderButton.textContent = "กำลังสร้างออเดอร์..."; }
    await dataService.createOrderWithId(orderId, { orderType: "delivery", tableCode: "DELIVERY", recipientName, recipientPhone, deliveryAddress, deliveryZone: zone.id, deliveryZoneLabel: zone.label, deliveryFee: zone.fee, subtotalAmount: currentSubtotal, totalAmount: currentTotal, paymentMethod: method, paymentStatus: method === "promptpay" ? "pending_verification" : "unpaid", paymentSlipUrl: "", paymentSlipPath: slip.path, status: "pending", note: document.querySelector("#orderNote").value.trim(), items });
    const tenant = dataService.getActiveShop();
    const slug = encodeURIComponent(tenant.slug);
    cart.clear(); clearSlipSelection(); toast("ส่งคำสั่งซื้อ Delivery เรียบร้อย"); location.href = `/s/${slug}/delivery/success/?order=${encodeURIComponent(orderId)}`;
  } catch (error) { console.error("DELIVERY_ORDER_FAILED", error); toast(submitErrorMessage(error), "error"); }
  finally { isSubmitting = false; submitOrderButton.textContent = "ยืนยันการสั่ง"; updateCart(); }
});

try { [menus, storeSettings] = await Promise.all([dataService.listMenus(), dataService.getStoreSettings()]); renderTabs(); renderMenus(); renderDeliveryZones(); updateCart(); }
catch (error) { console.error(error); menuGrid.innerHTML = '<div class="card empty">โหลดเมนูไม่สำเร็จ</div>'; }
