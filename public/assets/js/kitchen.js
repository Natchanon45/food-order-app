import "./sweet-dialog.js?v=20260629-048";
import "./kitchen-item-serve.js?v=20260630-058";
import { dataService, usingDemoMode } from "./data-service.js";
import { money, statusLabel, formatTime, toast } from "./ui.js";
import { observeDeliveryOrders } from "./delivery-notifier.js";

if (!document.querySelector('link[href*="sweet-dialog.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/sweet-dialog.css?v=20260629-048";
  document.head.appendChild(link);
}

if (usingDemoMode) document.querySelector("#demoBanner").innerHTML = '<div class="demo-banner">โหมดตัวอย่าง</div>';

const grid = document.querySelector("#orderGrid");
const activeStatuses = ["pending", "accepted", "cooking", "ready", "served"];
let currentOrders = [];
let availableMenus = [];

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return confirm(message);
}

function icon(name) {
  return `<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg?v=20260622-9#icon-${name}"></use></svg>`;
}

function nextActions(status, orderType) {
  if (status === "pending") return [["accepted", "รับออเดอร์", "btn-primary"]];
  if (status === "accepted") return [["cooking", "เริ่มทำ", "btn-warning"]];
  if (status === "cooking") return [["ready", orderType === "delivery" ? "พร้อมจัดส่ง" : "พร้อมเสิร์ฟ", "btn-primary"]];
  if (status === "ready") return [["served", orderType === "delivery" ? "ส่งให้ไรเดอร์แล้ว" : "เสิร์ฟแล้ว", "btn-dark"]];
  return [];
}

function isKitchenLocked(order) {
  return ["served", "paid", "cancelled"].includes(order?.status);
}

function lockedItemLabel(order) {
  if (order?.orderType === "delivery" && order?.status === "served") return "ส่งให้ไรเดอร์แล้ว";
  if (order?.status === "served") return "เสิร์ฟแล้ว";
  if (order?.status === "paid") return "ชำระเงินแล้ว";
  return "ล็อกแล้ว";
}

function recalculateOrder(order, items) {
  const subtotalAmount = items.filter(item => !item.cancelled).reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0);
  const deliveryFee = order.orderType === "delivery" && subtotalAmount > 0 ? Number(order.deliveryFee || 0) : 0;
  return { subtotalAmount, deliveryFee, totalAmount: subtotalAmount + deliveryFee };
}

function render(orders) {
  currentOrders = orders;
  const active = orders.filter(order => activeStatuses.includes(order.status));
  grid.innerHTML = active.length ? active.map(order => {
    const isDelivery = order.orderType === "delivery";
    const locked = isKitchenLocked(order);
    const roundText = isDelivery ? "" : ` • รอบที่ ${order.roundNumber || 1}`;
    const title = isDelivery ? `Delivery: ${order.recipientName || "ไม่ระบุชื่อ"}` : `โต๊ะ ${order.tableCode}${roundText}`;
    const paymentBadge = isDelivery
      ? `<p><span class="badge ${order.paymentStatus === "paid" ? "" : "warning"}">${order.paymentStatus === "paid" ? "ชำระเงินแล้ว" : "ยังไม่ชำระเงิน"}</span><br><strong>โทร:</strong> ${order.recipientPhone || "-"}<br><strong>ที่อยู่:</strong> ${order.deliveryAddress || "-"}</p>`
      : "";

    const itemRows = (order.items || []).map((item, index) => `
      <li style="${item.cancelled ? "opacity:.48;text-decoration:line-through" : ""}">
        <strong>${item.qty} × ${item.name}</strong>${item.note ? `<br><small>หมายเหตุ: ${item.note}</small>` : ""}
        ${item.originalQty && (Number(item.originalQty) !== Number(item.qty) || item.originalName) ? `<br><small>ลูกค้าสั่งเดิม: ${item.originalName || item.replacedFromName || item.name} × ${item.originalQty}</small>` : ""}
        ${item.cancelled ? '<br><small>ยกเลิกแล้ว</small>' : locked ? `<div class="kitchen-item-actions"><span class="badge">${lockedItemLabel(order)}</span></div>` : `
          <div class="kitchen-item-actions">
            <button class="btn btn-sm" data-edit-item="${order.id}" data-item-index="${index}">${icon("pencil")}<span>แก้ไข</span></button>
            <button class="btn btn-danger btn-sm" data-cancel-item="${order.id}" data-item-index="${index}">${icon("x-circle")}<span>ยกเลิก</span></button>
          </div>`}
      </li>
    `).join("");

    const deliverySummary = isDelivery ? `
      <div class="card" style="margin-top:10px;padding:10px 12px;box-shadow:none;background:#f8fbf9">
        <div class="receipt-row"><span>พื้นที่จัดส่ง</span><strong>${order.deliveryZoneLabel || "-"}</strong></div>
        <div class="receipt-row"><span>ค่าอาหาร</span><strong>${money(order.subtotalAmount ?? (Number(order.totalAmount || 0) - Number(order.deliveryFee || 0)))} บาท</strong></div>
        <div class="receipt-row"><span>ค่าจัดส่ง</span><strong>${money(order.deliveryFee || 0)} บาท</strong></div>
      </div>` : "";

    return `<article class="card order-card">
      <div class="order-head"><div><h2 style="margin:0">${title}</h2><small>${formatTime(order.createdAt)}</small></div><span class="badge">${statusLabel(order.status)}</span></div>
      ${paymentBadge}
      <ul class="order-items">${itemRows}</ul>
      ${deliverySummary}
      ${order.note ? `<p><strong>หมายเหตุรวม:</strong> ${order.note}</p>` : ""}
      <div class="order-head" style="margin-top:10px"><strong>ยอดสุทธิ</strong><strong class="price">${money(order.totalAmount)} บาท</strong></div>
      <div class="order-actions" style="margin-top:12px">
        ${nextActions(order.status, order.orderType).map(([status,label,cls]) => `<button class="btn ${cls}" data-id="${order.id}" data-status="${status}">${label}</button>`).join("")}
        ${locked ? "" : `<button class="btn btn-danger" data-cancel-order="${order.id}">ยกเลิกทั้งออเดอร์</button>`}
      </div>
    </article>`;
  }).join("") : '<div class="card empty">ยังไม่มีออเดอร์ที่รอดำเนินการ</div>';
}

function closeEditor() {
  document.querySelector(".kitchen-item-editor-backdrop")?.remove();
}

function openEditor(order, itemIndex) {
  const item = order.items?.[itemIndex];
  if (!item || item.cancelled || isKitchenLocked(order)) return;

  const maxQty = Math.max(1, Number(item.originalQty || item.qty || 1));
  const originalName = item.originalName || item.replacedFromName || item.name;
  const activeMenus = availableMenus.filter(menu => menu.active !== false);
  const options = activeMenus.map(menu => `<option value="${menu.id}" ${menu.id === item.menuId ? "selected" : ""}>${menu.name} — ${money(menu.price)} บาท</option>`).join("");

  const backdrop = document.createElement("div");
  backdrop.className = "kitchen-item-editor-backdrop";
  backdrop.innerHTML = `
    <section class="kitchen-item-editor" role="dialog" aria-modal="true" aria-labelledby="kitchenEditorTitle">
      <h2 id="kitchenEditorTitle">แก้ไขรายการ</h2>
      <div class="editor-grid">
        <div class="field"><label>เมนู</label><select class="input" id="kitchenReplacementMenu">${options}</select></div>
        <div class="field"><label>จำนวนที่ทำได้</label><input class="input" id="kitchenReplacementQty" type="number" min="1" max="${maxQty}" step="1" value="${Math.min(Number(item.qty || 1), maxQty)}"><div class="editor-help">จำนวนเดิมที่ลูกค้าสั่ง: ${originalName} × ${maxQty}</div></div>
        <div class="field"><label>หมายเหตุการแก้ไข *</label><input class="input" id="kitchenReplacementNote" value="${item.note || ""}" maxlength="200" placeholder="เช่น วัตถุดิบไม่พอ ลูกค้ายินยอมให้ลดจำนวน"><div class="editor-help">ต้องระบุเหตุผลก่อนลดจำนวนหรือเปลี่ยนเมนู</div></div>
      </div>
      <div class="editor-actions"><button type="button" class="btn" data-close-editor>ยกเลิก</button><button type="button" class="btn btn-primary" data-save-editor>บันทึกการแก้ไข</button></div>
    </section>`;

  backdrop.addEventListener("click", async event => {
    if (event.target === backdrop || event.target.closest("[data-close-editor]")) {
      closeEditor();
      return;
    }

    const saveButton = event.target.closest("[data-save-editor]");
    if (!saveButton || isKitchenLocked(order)) return;
    const selectedMenuId = backdrop.querySelector("#kitchenReplacementMenu").value;
    const selectedMenu = activeMenus.find(menu => menu.id === selectedMenuId);
    const nextQty = Number(backdrop.querySelector("#kitchenReplacementQty").value);
    const nextNote = backdrop.querySelector("#kitchenReplacementNote").value.trim();

    if (!selectedMenu || !Number.isInteger(nextQty) || nextQty < 1 || nextQty > maxQty) {
      toast("กรุณาตรวจสอบเมนูและจำนวน", "error");
      return;
    }

    const changingQty = nextQty !== Number(item.qty);
    const changingMenu = selectedMenu.id !== item.menuId;
    if ((changingQty || changingMenu) && !nextNote) {
      toast("กรุณาระบุหมายเหตุก่อนแก้ไขจำนวนหรือเปลี่ยนเมนู", "error");
      backdrop.querySelector("#kitchenReplacementNote").focus();
      return;
    }

    const items = order.items.map((row, index) => {
      if (index !== itemIndex) return row;
      const replacing = selectedMenu.id !== row.menuId;
      return {
        ...row,
        originalQty: row.originalQty || row.qty,
        originalName: row.originalName || row.replacedFromName || row.name,
        menuId: selectedMenu.id,
        name: selectedMenu.name,
        price: Number(selectedMenu.price),
        qty: nextQty,
        note: nextNote,
        replacedFromName: replacing ? (row.replacedFromName || row.name) : row.replacedFromName || "",
        updatedByKitchenAt: new Date().toISOString()
      };
    });

    const totals = recalculateOrder(order, items);
    saveButton.disabled = true;
    try {
      await dataService.updateOrder(order.id, { items, ...totals, kitchenAdjustedAt: new Date().toISOString() });
      closeEditor();
      toast("อัปเดตรายการและคำนวณยอดใหม่แล้ว");
    } catch (error) {
      console.error(error);
      toast("แก้ไขรายการไม่สำเร็จ", "error");
      saveButton.disabled = false;
    }
  });

  document.body.appendChild(backdrop);
}

grid.addEventListener("click", async event => {
  const editItemButton = event.target.closest("[data-edit-item]");
  if (editItemButton) {
    const order = currentOrders.find(item => item.id === editItemButton.dataset.editItem);
    const itemIndex = Number(editItemButton.dataset.itemIndex);
    if (order && Number.isInteger(itemIndex) && !isKitchenLocked(order)) openEditor(order, itemIndex);
    return;
  }

  const cancelItemButton = event.target.closest("[data-cancel-item]");
  if (cancelItemButton) {
    const order = currentOrders.find(item => item.id === cancelItemButton.dataset.cancelItem);
    const itemIndex = Number(cancelItemButton.dataset.itemIndex);
    if (!order || !Number.isInteger(itemIndex) || isKitchenLocked(order)) return;
    const selectedItem = order.items?.[itemIndex];
    if (!selectedItem || selectedItem.cancelled) return;
    const ok = await askConfirm(`ยกเลิกเฉพาะรายการ ${selectedItem.name} ใช่หรือไม่?`, { title: "ยกเลิกรายการ", confirmText: "ตกลง", cancelText: "ยกเลิก", type: "warning" });
    if (!ok) return;

    const items = order.items.map((item, index) => index === itemIndex ? { ...item, cancelled: true, cancelledReason: "out_of_stock", cancelledAt: new Date().toISOString() } : item);
    const totals = recalculateOrder(order, items);
    const patch = { items, ...totals };
    if (totals.subtotalAmount <= 0) patch.status = "cancelled";
    await dataService.updateOrder(order.id, patch);
    toast(totals.subtotalAmount <= 0 ? "ยกเลิกทั้งออเดอร์แล้ว เพราะไม่มีรายการเหลือ" : "ยกเลิกรายการและคำนวณยอดใหม่แล้ว");
    return;
  }

  const cancelOrderButton = event.target.closest("[data-cancel-order]");
  if (cancelOrderButton) {
    const order = currentOrders.find(item => item.id === cancelOrderButton.dataset.cancelOrder);
    if (isKitchenLocked(order)) return;
    const ok = await askConfirm("ยืนยันยกเลิกทุกรายการในออเดอร์นี้?", { title: "ยกเลิกทั้งออเดอร์", confirmText: "ตกลง", cancelText: "ยกเลิก", type: "warning" });
    if (!ok) return;
    await dataService.updateOrder(cancelOrderButton.dataset.cancelOrder, { status: "cancelled", subtotalAmount: 0, deliveryFee: 0, totalAmount: 0, cancelledAt: new Date().toISOString() });
    toast("ยกเลิกทั้งออเดอร์แล้ว");
    return;
  }

  const button = event.target.closest("[data-id][data-status]");
  if (!button) return;
  const { id, status } = button.dataset;
  const order = currentOrders.find(item => item.id === id);
  button.disabled = true;

  try {
    const patch = { status };
    if (status === "served") patch.servedAt = new Date().toISOString();
    if (order?.orderType === "delivery" && status === "served" && order.paymentStatus === "paid") {
      patch.status = "paid";
      patch.completedAt = new Date().toISOString();
    }
    await dataService.updateOrder(id, patch);
    toast(patch.status === "paid" ? "ส่งให้ไรเดอร์และปิดออเดอร์ Delivery แล้ว" : `เปลี่ยนสถานะเป็น ${statusLabel(patch.status)}`);
  } catch (error) {
    console.error(error);
    toast("อัปเดตสถานะไม่สำเร็จ", "error");
    button.disabled = false;
  }
});

try {
  availableMenus = await dataService.listMenus();
} catch (error) {
  console.error("Unable to load menus for kitchen editor", error);
}

dataService.subscribeOrders(orders => {
  observeDeliveryOrders(orders);
  render(orders);
});
