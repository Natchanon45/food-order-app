import { requireRole } from "./auth-service.js?v=20260731-079";
import { sweetAlert, sweetConfirm, sweetPrompt } from "./sweet-dialog.js?v=20260801-002";
import {
  WAITING_QUEUE_STATUS,
  WAITING_QUEUE_ACTIVE_STATUSES,
  acknowledgeCustomerResponse,
  callCountdownSeconds,
  compatibleQueuesForTable,
  createWaitingQueue,
  currentActor,
  customerTrackingUrl,
  ensureWaitingNumberLease,
  estimateWaitRange,
  getWaitingQueueOutbox,
  isOnline,
  loadWaitingQueueTables,
  queueDisplayUrl,
  recommendQueueForTable,
  refreshPublicSnapshots,
  resolveTenantId,
  schedulePublicSnapshotRefresh,
  seatWaitingQueue,
  syncWaitingQueueOutbox,
  transitionWaitingQueue,
  waitDurationMinutes,
  waitingQueueStatusLabel,
  watchWaitingQueuePublicResponses,
  watchWaitingQueues,
} from "./waiting-queue-core.js?v=20260801-002";

await requireRole(["owner", "admin", "manager", "cashier"]);

const els = {
  tenantName: document.querySelector("#waitingTenantName"),
  onlineState: document.querySelector("#waitingOnlineState"),
  syncState: document.querySelector("#waitingSyncState"),
  syncBtn: document.querySelector("#waitingSyncBtn"),
  addBtn: document.querySelector("#addWaitingQueueBtn"),
  displayBtn: document.querySelector("#openWaitingDisplayBtn"),
  statsWaiting: document.querySelector("#waitingStatWaiting"),
  statsCalled: document.querySelector("#waitingStatCalled"),
  statsOverdue: document.querySelector("#waitingStatOverdue"),
  statsSeated: document.querySelector("#waitingStatSeated"),
  search: document.querySelector("#waitingSearch"),
  statusFilter: document.querySelector("#waitingStatusFilter"),
  partyFilter: document.querySelector("#waitingPartyFilter"),
  queueList: document.querySelector("#waitingQueueList"),
  empty: document.querySelector("#waitingQueueEmpty"),
  tableList: document.querySelector("#waitingTableList"),
  tableEmpty: document.querySelector("#waitingTableEmpty"),
  recommendation: document.querySelector("#waitingRecommendation"),
  addDialog: document.querySelector("#waitingQueueDialog"),
  addForm: document.querySelector("#waitingQueueForm"),
  closeAdd: document.querySelector("#closeWaitingQueueDialog"),
  cancelAdd: document.querySelector("#cancelWaitingQueueDialog"),
  addError: document.querySelector("#waitingQueueFormError"),
  addSubmit: document.querySelector("#saveWaitingQueueBtn"),
  customerName: document.querySelector("#waitingCustomerName"),
  phone: document.querySelector("#waitingCustomerPhone"),
  partySize: document.querySelector("#waitingPartySize"),
  priority: document.querySelector("#waitingPriority"),
  highChair: document.querySelector("#waitingNeedHighChair"),
  wheelchair: document.querySelector("#waitingNeedWheelchair"),
  quietArea: document.querySelector("#waitingNeedQuietArea"),
  strollerSpace: document.querySelector("#waitingNeedStroller"),
  specialNote: document.querySelector("#waitingSpecialNote"),
  intakePreview: document.querySelector("#waitingQueuePreview"),
  intakeAhead: document.querySelector("#waitingQueuePreviewAhead"),
  intakeEstimate: document.querySelector("#waitingQueuePreviewEstimate"),
  seatDialog: document.querySelector("#waitingSeatDialog"),
  seatTitle: document.querySelector("#waitingSeatDialogTitle"),
  seatQueueSummary: document.querySelector("#waitingSeatQueueSummary"),
  seatTableList: document.querySelector("#waitingSeatTableList"),
  seatReasonWrap: document.querySelector("#waitingSeatReasonWrap"),
  seatReason: document.querySelector("#waitingSeatReason"),
  seatError: document.querySelector("#waitingSeatError"),
  seatConfirm: document.querySelector("#confirmWaitingSeatBtn"),
  closeSeat: document.querySelector("#closeWaitingSeatDialog"),
  cancelSeat: document.querySelector("#cancelWaitingSeatDialog"),
  toast: document.querySelector("#toast"),
};

let tenantId = "";
let queues = [];
let tables = [];
let publicRows = [];
let selectedSeatQueue = null;
let selectedSeatTable = null;
let recommendedSeatQueueId = "";
let unsubscribeQueues = () => {};
let unsubscribePublic = () => {};
let tableTimer = null;
let clockTimer = null;
let syncing = false;
const responseInFlight = new Set();
const LONG_WAIT_ALERT_MINUTES = 60;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function showToast(message, type = "success") {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.toggle("error", type === "error");
  els.toast.classList.toggle("is-error", type === "error");
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function formatTime(ms) {
  if (!Number(ms)) return "-";
  return new Date(Number(ms)).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function waitText(queue) {
  const minutes = waitDurationMinutes(queue);
  if (minutes < 1) return "น้อยกว่า 1 นาที";
  if (minutes < 60) return `${minutes.toLocaleString("th-TH")} นาที`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return `${hours} ชม. ${remain} นาที`;
}

function statusClass(status) {
  return ({
    waiting: "waiting",
    called: "called",
    acknowledged: "acknowledged",
    preparing_table: "preparing",
    seated: "seated",
    deferred: "deferred",
    no_show: "no-show",
    cancelled: "cancelled",
  })[status] || "waiting";
}

function priorityText(priority) {
  return ({ normal: "ทั่วไป", elderly: "ผู้สูงอายุ", disabled: "ผู้พิการ", young_child: "มีเด็กเล็ก" })[priority] || "ทั่วไป";
}

function needTags(queue) {
  const tags = [];
  if (queue.needs?.highChair) tags.push("เก้าอี้เด็ก");
  if (queue.needs?.wheelchair) tags.push("พื้นที่รถเข็น");
  if (queue.needs?.quietArea) tags.push("พื้นที่เงียบ");
  if (queue.needs?.strollerSpace) tags.push("พื้นที่รถเข็นเด็ก");
  if (queue.priority && queue.priority !== "normal") tags.push(priorityText(queue.priority));
  return tags;
}

function activeQueues() {
  return queues.filter(queue => WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status));
}

function publicRowFor(queue) {
  return publicRows.find(row => row.waitingQueueId === queue.id || row.token === queue.publicToken) || null;
}

function calledOverdue(queue) {
  const seconds = callCountdownSeconds(queue);
  return queue.status === WAITING_QUEUE_STATUS.CALLED && seconds !== null && seconds <= 0;
}

function queueActions(queue) {
  const actions = [];
  if (queue.status === WAITING_QUEUE_STATUS.WAITING || queue.status === WAITING_QUEUE_STATUS.DEFERRED) {
    actions.push(["call", "เรียกคิว", "volume-up"]);
  }
  if (queue.status === WAITING_QUEUE_STATUS.CALLED) {
    actions.push(["ack", "ตอบรับแล้ว", "check2-circle"]);
    actions.push(["recall", "เรียกซ้ำ", "volume-up"]);
  }
  if ([WAITING_QUEUE_STATUS.CALLED, WAITING_QUEUE_STATUS.ACKNOWLEDGED].includes(queue.status)) {
    actions.push(["prepare", "จัดโต๊ะ", "hourglass-split"]);
  }
  if (WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status)) {
    actions.push(["seat", "เปิดโต๊ะ", "door-open"]);
    if (Number(queue.deferCount || 0) < Number(queue.maxDefers ?? 2)) actions.push(["defer", "เลื่อนคิว", "arrow-clockwise"]);
    actions.push(["cancel", "ยกเลิก", "x-circle"]);
  }
  if (calledOverdue(queue)) actions.unshift(["no-show", "ไม่มา", "person-x"]);
  actions.push(["copy", "ลิงก์ลูกค้า", "link-45deg"]);
  return actions;
}

function renderQueue(queue) {
  const estimate = estimateWaitRange(queue, queues, tables);
  const tags = needTags(queue);
  const publicRow = publicRowFor(queue);
  const countdown = callCountdownSeconds(queue);
  const overdue = calledOverdue(queue);
  const longWait = WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status) && waitDurationMinutes(queue) >= LONG_WAIT_ALERT_MINUTES;
  const response = publicRow?.customerResponse === "on_the_way"
    ? '<span class="waiting-response yes">ลูกค้ายืนยันกำลังมา</span>'
    : publicRow?.customerResponse === "cancel_requested"
      ? '<span class="waiting-response cancel">ลูกค้าขอยกเลิก</span>'
      : "";
  const syncBadge = queue.syncStatus && queue.syncStatus !== "synced"
    ? `<span class="waiting-sync-badge ${escapeHtml(queue.syncStatus)}">${queue.syncStatus === "conflict" ? "ข้อมูลชนกัน" : "รอ Sync"}</span>`
    : "";
  const countdownText = queue.status === WAITING_QUEUE_STATUS.CALLED && countdown !== null
    ? `<span class="waiting-countdown ${overdue ? "overdue" : ""}" data-deadline="${Number(queue.responseDeadlineAtMs || 0)}">${overdue ? "พ้นเวลาตอบรับ" : `เหลือ ${Math.max(0, Math.ceil(countdown / 60))} นาที`}</span>`
    : "";
  return `<article class="waiting-queue-card ${statusClass(queue.status)}${overdue ? " is-overdue" : ""}${longWait ? " is-long-wait" : ""}" data-queue-id="${escapeHtml(queue.id)}">
    <div class="waiting-queue-number-wrap">
      <strong class="waiting-queue-number">${escapeHtml(queue.queueNumber)}</strong>
      ${queue.queueNumberProvisional ? '<span class="waiting-provisional">เลขชั่วคราว</span>' : ""}
      <span class="waiting-queued-time">รับคิว ${formatTime(queue.queuedAtMs)}</span>
    </div>
    <div class="waiting-queue-customer">
      <div class="waiting-customer-title"><strong>${escapeHtml(queue.customerName || "ไม่ระบุชื่อ")}</strong><span>${Number(queue.partySize || 1).toLocaleString("th-TH")} คน</span></div>
      <div class="waiting-customer-meta">${escapeHtml(queue.phoneMasked || "ไม่มีเบอร์โทร")} • รอจริง ${waitText(queue)}</div>
      <div class="waiting-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}${queue.specialNote ? `<span title="${escapeHtml(queue.specialNote)}">หมายเหตุ: ${escapeHtml(queue.specialNote)}</span>` : ""}</div>
      ${response}
    </div>
    <div class="waiting-queue-estimate">
      <span>ประมาณการ</span>
      <strong>${estimate.estimatedWaitMin}–${estimate.estimatedWaitMax} นาที</strong>
      <small>${estimate.groupsAhead.toLocaleString("th-TH")} คิวที่เหมาะสมก่อนหน้า</small>
    </div>
    <div class="waiting-queue-status-wrap">
      <span class="waiting-status ${statusClass(queue.status)}">${escapeHtml(waitingQueueStatusLabel(queue.status))}</span>
      ${countdownText}${longWait ? `<span class="waiting-long-wait">รอนานเกิน ${LONG_WAIT_ALERT_MINUTES} นาที</span>` : ""}${syncBadge}
    </div>
    <div class="waiting-queue-actions">
      ${queueActions(queue).map(([action, label, icon]) => `<button type="button" data-queue-action="${action}" data-queue-id="${escapeHtml(queue.id)}" class="waiting-action ${action}"><i class="bi bi-${icon}" aria-hidden="true"></i><span>${label}</span></button>`).join("")}
    </div>
  </article>`;
}

function filteredQueues() {
  const needle = String(els.search?.value || "").trim().toLocaleLowerCase("th");
  const status = els.statusFilter?.value || "active";
  const party = els.partyFilter?.value || "all";
  return queues.filter(queue => {
    const matchesText = !needle || [queue.queueNumber, queue.customerName, queue.phone, queue.phoneMasked, queue.specialNote]
      .some(value => String(value || "").toLocaleLowerCase("th").includes(needle));
    const matchesStatus = status === "all"
      || (status === "active" && WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status))
      || queue.status === status;
    const size = Number(queue.partySize || 1);
    const matchesParty = party === "all"
      || (party === "1-2" && size <= 2)
      || (party === "3-4" && size >= 3 && size <= 4)
      || (party === "5+" && size >= 5);
    return matchesText && matchesStatus && matchesParty;
  }).sort((a, b) => {
    if (WAITING_QUEUE_ACTIVE_STATUSES.has(a.status) !== WAITING_QUEUE_ACTIVE_STATUSES.has(b.status)) {
      return WAITING_QUEUE_ACTIVE_STATUSES.has(a.status) ? -1 : 1;
    }
    return Number(a.effectiveQueuedAtMs || a.queuedAtMs || 0) - Number(b.effectiveQueuedAtMs || b.queuedAtMs || 0);
  });
}

function renderStats() {
  const today = new Date().toDateString();
  const waiting = queues.filter(queue => ["waiting", "deferred"].includes(queue.status)).length;
  const called = queues.filter(queue => ["called", "acknowledged", "preparing_table"].includes(queue.status)).length;
  const overdue = queues.filter(calledOverdue).length;
  const seated = queues.filter(queue => queue.status === "seated" && new Date(Number(queue.seatedAtMs || queue.updatedAtMs || 0)).toDateString() === today).length;
  els.statsWaiting.textContent = waiting.toLocaleString("th-TH");
  els.statsCalled.textContent = called.toLocaleString("th-TH");
  els.statsOverdue.textContent = overdue.toLocaleString("th-TH");
  els.statsSeated.textContent = seated.toLocaleString("th-TH");
}

function renderQueues() {
  renderStats();
  const rows = filteredQueues();
  els.empty.hidden = rows.length > 0;
  els.queueList.innerHTML = rows.map(renderQueue).join("");
  schedulePublicSnapshotRefresh(tenantId, queues, tables);
}

function renderTables() {
  const available = tables.filter(table => table.available);
  els.tableEmpty.hidden = available.length > 0;
  els.tableList.innerHTML = available.map(table => {
    const match = recommendQueueForTable(table, queues);
    const queue = match.recommendation;
    return `<article class="waiting-table-card" data-table-id="${escapeHtml(table.id)}">
      <div><strong>${escapeHtml(table.label)}</strong><span>${Number(table.capacity).toLocaleString("th-TH")} ที่นั่ง${table.accessible ? " • รถเข็น" : ""}</span></div>
      ${queue
        ? `<div class="waiting-table-match"><span>แนะนำ</span><strong>${escapeHtml(queue.queueNumber)} • ${Number(queue.partySize)} คน</strong>${match.skipped.length ? `<small>ข้ามชั่วคราว ${match.skipped.length} คิว เพราะโต๊ะไม่เหมาะสม</small>` : ""}</div><button type="button" data-table-seat="${escapeHtml(table.id)}" data-queue-id="${escapeHtml(queue.id)}">จัดโต๊ะ</button>`
        : '<div class="waiting-table-match empty">ยังไม่มีคิวที่เหมาะสม</div>'}
    </article>`;
  }).join("");

  const firstAvailable = available[0];
  if (!firstAvailable) {
    els.recommendation.innerHTML = '<span>ยังไม่มีโต๊ะว่าง</span>';
    return;
  }
  const recommendation = recommendQueueForTable(firstAvailable, queues);
  els.recommendation.innerHTML = recommendation.recommendation
    ? `<strong>คำแนะนำล่าสุด:</strong> ${escapeHtml(firstAvailable.label)} เหมาะกับคิว <b>${escapeHtml(recommendation.recommendation.queueNumber)}</b> (${Number(recommendation.recommendation.partySize)} คน)`
    : `<strong>โต๊ะว่าง:</strong> ${escapeHtml(firstAvailable.label)} แต่ยังไม่มีคิวที่เหมาะสม`;
}

function renderConnectivity() {
  const online = isOnline();
  els.onlineState.classList.toggle("offline", !online);
  els.onlineState.innerHTML = `<i class="bi bi-${online ? "wifi" : "wifi-off"}" aria-hidden="true"></i><span>${online ? "ออนไลน์" : "ออฟไลน์"}</span>`;
  const outbox = getWaitingQueueOutbox(tenantId);
  els.syncState.textContent = outbox.length ? `รอ Sync ${outbox.length.toLocaleString("th-TH")}` : "Sync แล้ว";
  els.syncBtn.disabled = syncing || !online || outbox.length === 0;
}

async function refreshTables() {
  try {
    tables = await loadWaitingQueueTables(tenantId);
    renderTables();
    schedulePublicSnapshotRefresh(tenantId, queues, tables);
  } catch (error) {
    console.error("[waiting-queue-staff] load tables failed", error);
    els.tableEmpty.hidden = false;
    els.tableEmpty.textContent = "โหลดโต๊ะไม่สำเร็จ";
  }
}

function updateAddPreview() {
  const partySize = Math.max(1, Number(els.partySize?.value || 1));
  const previewQueue = {
    id: "waiting-intake-preview",
    partySize,
    needs: {
      highChair: Boolean(els.highChair?.checked),
      wheelchair: Boolean(els.wheelchair?.checked),
      quietArea: Boolean(els.quietArea?.checked),
      strollerSpace: Boolean(els.strollerSpace?.checked),
    },
    queuedAtMs: Date.now(),
    effectiveQueuedAtMs: Date.now(),
    status: WAITING_QUEUE_STATUS.WAITING,
  };
  const estimate = estimateWaitRange(previewQueue, [...queues, previewQueue], tables);
  if (els.intakeAhead) els.intakeAhead.textContent = estimate.groupsAhead.toLocaleString("th-TH");
  if (els.intakeEstimate) els.intakeEstimate.textContent = `${estimate.estimatedWaitMin}–${estimate.estimatedWaitMax} นาที`;
}

function openAddDialog() {
  els.addForm.reset();
  els.partySize.value = "2";
  els.priority.value = "normal";
  els.addError.textContent = "";
  updateAddPreview();
  els.addDialog.showModal();
  setTimeout(() => els.customerName.focus(), 50);
}

function closeAddDialog() {
  if (!els.addSubmit.disabled) els.addDialog.close();
}

async function submitAddQueue(event) {
  event.preventDefault();
  els.addError.textContent = "";
  els.addSubmit.disabled = true;
  els.addSubmit.textContent = "กำลังบันทึก...";
  try {
    const partySize = Number(els.partySize.value);
    const needs = {
      highChair: els.highChair.checked,
      wheelchair: els.wheelchair.checked,
      quietArea: els.quietArea.checked,
      strollerSpace: els.strollerSpace.checked,
    };
    const estimateDraft = {
      id: `draft-${Date.now()}`,
      partySize,
      needs,
      queuedAtMs: Date.now(),
      effectiveQueuedAtMs: Date.now(),
      status: WAITING_QUEUE_STATUS.WAITING,
    };
    const estimate = estimateWaitRange(estimateDraft, [...queues, estimateDraft], tables);
    const row = await createWaitingQueue({
      tenantId,
      customerName: els.customerName.value,
      phone: els.phone.value,
      partySize,
      priority: els.priority.value,
      needs,
      specialNote: els.specialNote.value,
      groupsAhead: estimate.groupsAhead,
      estimatedWaitMin: estimate.estimatedWaitMin,
      estimatedWaitMax: estimate.estimatedWaitMax,
      source: "staff",
    });
    els.addDialog.close();
    showToast(isOnline() && row.syncStatus === "synced" ? `เพิ่มคิว ${row.queueNumber} แล้ว` : `บันทึกคิว ${row.queueNumber} ในเครื่องแล้ว รอ Sync`);
    const tracking = customerTrackingUrl(row);
    const copy = await sweetConfirm(`ออกคิว ${row.queueNumber} สำเร็จ\nประมาณ ${row.estimatedWaitMin || 0}–${row.estimatedWaitMax || 5} นาที\nต้องการคัดลอกลิงก์ติดตามให้ลูกค้าหรือไม่?`, {
      title: "เพิ่มคิวสำเร็จ",
      confirmText: "คัดลอกลิงก์",
      cancelText: "ปิด",
      type: "success",
    });
    if (copy) {
      await navigator.clipboard.writeText(tracking).catch(() => fallbackCopy(tracking));
      showToast("คัดลอกลิงก์ติดตามคิวแล้ว");
    }
  } catch (error) {
    console.error("[waiting-queue-staff] create failed", error);
    els.addError.textContent = error?.message || "เพิ่มคิวไม่สำเร็จ";
  } finally {
    els.addSubmit.disabled = false;
    els.addSubmit.textContent = "บันทึกคิว";
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function queueById(id) {
  return queues.find(queue => String(queue.id) === String(id));
}

async function performTransition(queue, toStatus, options) {
  try {
    await transitionWaitingQueue(queue.id, toStatus, { tenantId, ...options });
    showToast(options.successMessage || `อัปเดตคิว ${queue.queueNumber} แล้ว`);
  } catch (error) {
    console.error("[waiting-queue-staff] transition failed", error);
    await sweetAlert(error?.message || "อัปเดตคิวไม่สำเร็จ", { title: "ดำเนินการไม่สำเร็จ", type: "error" });
  }
}

async function handleQueueAction(action, queue) {
  if (!queue) return;
  if (action === "call" || action === "recall") {
    await performTransition(queue, WAITING_QUEUE_STATUS.CALLED, {
      action: action === "recall" ? "queue_recalled" : "queue_called",
      reason: action === "recall" ? "พนักงานเรียกคิวซ้ำ" : "พนักงานเรียกคิว",
      callTimeoutMinutes: 5,
      allowSameStatus: action === "recall",
      successMessage: `เรียกคิว ${queue.queueNumber} แล้ว`,
    });
    return;
  }
  if (action === "ack") {
    await performTransition(queue, WAITING_QUEUE_STATUS.ACKNOWLEDGED, {
      action: "staff_acknowledged",
      reason: "พนักงานยืนยันว่าลูกค้าตอบรับแล้ว",
    });
    return;
  }
  if (action === "prepare") {
    await performTransition(queue, WAITING_QUEUE_STATUS.PREPARING_TABLE, {
      action: "table_preparing",
      reason: "เริ่มจัดโต๊ะให้ลูกค้า",
    });
    return;
  }
  if (action === "defer") {
    const reason = await sweetPrompt("ระบุเหตุผลที่เลื่อนคิว เช่น ลูกค้ายังมาไม่ครบ", "", {
      title: `เลื่อนคิว ${queue.queueNumber}`,
      placeholder: "เหตุผลการเลื่อนคิว",
      confirmText: "เลื่อนคิว",
    });
    if (reason === null) return;
    if (!reason.trim()) return sweetAlert("กรุณาระบุเหตุผลการเลื่อนคิว", { title: "ต้องระบุเหตุผล", type: "warning" });
    await performTransition(queue, WAITING_QUEUE_STATUS.DEFERRED, {
      action: "queue_deferred",
      reason,
      requireReason: true,
    });
    return;
  }
  if (action === "cancel" || action === "no-show") {
    const noShow = action === "no-show";
    const reason = await sweetPrompt(noShow ? "ระบุเหตุผลหรือรายละเอียดการไม่มา" : "ระบุเหตุผลการยกเลิกคิว", "", {
      title: noShow ? `บันทึกไม่มา ${queue.queueNumber}` : `ยกเลิกคิว ${queue.queueNumber}`,
      placeholder: "เหตุผล",
      confirmText: noShow ? "บันทึกไม่มา" : "ยกเลิกคิว",
    });
    if (reason === null) return;
    if (!reason.trim()) return sweetAlert("กรุณาระบุเหตุผล", { title: "ต้องระบุเหตุผล", type: "warning" });
    await performTransition(queue, noShow ? WAITING_QUEUE_STATUS.NO_SHOW : WAITING_QUEUE_STATUS.CANCELLED, {
      action: noShow ? "queue_no_show" : "queue_cancelled",
      reason,
      requireReason: true,
    });
    return;
  }
  if (action === "copy") {
    const url = customerTrackingUrl(queue);
    await navigator.clipboard.writeText(url).catch(() => fallbackCopy(url));
    showToast(`คัดลอกลิงก์คิว ${queue.queueNumber} แล้ว`);
    return;
  }
  if (action === "seat") openSeatDialog(queue);
}

function openSeatDialog(queue, preferredTable = null) {
  selectedSeatQueue = queue;
  selectedSeatTable = preferredTable;
  els.seatTitle.textContent = `เปิดโต๊ะให้คิว ${queue.queueNumber}`;
  els.seatQueueSummary.innerHTML = `<strong>${escapeHtml(queue.customerName || "ไม่ระบุชื่อ")}</strong><span>${Number(queue.partySize)} คน • รอ ${waitText(queue)}</span>`;
  renderSeatTables();
  els.seatReason.value = "";
  els.seatReasonWrap.hidden = true;
  els.seatError.textContent = "";
  els.seatConfirm.disabled = !selectedSeatTable;
  els.seatDialog.showModal();
}

function renderSeatTables() {
  const queue = selectedSeatQueue;
  const available = tables.filter(table => table.available);
  const suitable = available.filter(table => compatibleQueuesForTable(table, [queue]).length > 0);
  const ordered = [...suitable, ...available.filter(table => !suitable.includes(table))];
  els.seatTableList.innerHTML = ordered.length ? ordered.map(table => {
    const fits = suitable.includes(table);
    const checked = selectedSeatTable?.id === table.id;
    const match = recommendQueueForTable(table, queues);
    const recommended = match.recommendation?.id === queue.id;
    return `<label class="waiting-seat-table ${fits ? "fits" : "not-fit"}${recommended ? " recommended" : ""}">
      <input type="radio" name="waitingSeatTable" value="${escapeHtml(table.id)}" ${checked ? "checked" : ""}>
      <span><strong>${escapeHtml(table.label)}</strong><small>${Number(table.capacity)} ที่นั่ง${recommended ? " • แนะนำสำหรับคิวนี้" : fits ? " • เหมาะสม" : " • ต้องระบุเหตุผล"}</small></span>
    </label>`;
  }).join("") : '<div class="waiting-seat-empty">ยังไม่มีโต๊ะว่าง</div>';
  recommendedSeatQueueId = "";
  if (selectedSeatTable) recommendedSeatQueueId = recommendQueueForTable(selectedSeatTable, queues).recommendation?.id || "";
  syncSeatReasonVisibility();
}

function syncSeatReasonVisibility() {
  const table = selectedSeatTable;
  const queue = selectedSeatQueue;
  if (!table || !queue) {
    els.seatReasonWrap.hidden = true;
    els.seatConfirm.disabled = true;
    return;
  }
  const fits = compatibleQueuesForTable(table, [queue]).length > 0;
  const recommendation = recommendQueueForTable(table, queues).recommendation;
  const bypassFairOrder = recommendation && recommendation.id !== queue.id;
  els.seatReasonWrap.hidden = fits && !bypassFairOrder;
  els.seatReason.placeholder = !fits
    ? "เหตุผลที่ใช้โต๊ะไม่ตรงเงื่อนไข"
    : `เหตุผลที่เลือก ${queue.queueNumber} แทน ${recommendation?.queueNumber || "คิวแนะนำ"}`;
  els.seatConfirm.disabled = false;
}

async function confirmSeat() {
  if (!selectedSeatQueue || !selectedSeatTable) return;
  const reasonRequired = !els.seatReasonWrap.hidden;
  const reason = els.seatReason.value.trim();
  if (reasonRequired && !reason) {
    els.seatError.textContent = "กรุณาระบุเหตุผลการข้ามเงื่อนไขหรือข้ามคิว";
    els.seatReason.focus();
    return;
  }
  els.seatError.textContent = "";
  els.seatConfirm.disabled = true;
  els.seatConfirm.textContent = "กำลังเปิดโต๊ะ...";
  try {
    const fairness = recommendQueueForTable(selectedSeatTable, queues);
    const result = await seatWaitingQueue(selectedSeatQueue.id, selectedSeatTable, {
      tenantId,
      overrideReason: reason,
      fairnessContext: {
        recommendedQueueId: fairness.recommendation?.id || "",
        recommendedQueueNumber: fairness.recommendation?.queueNumber || "",
        skippedQueues: fairness.skipped.map(item => ({
          waitingQueueId: item.queue.id,
          queueNumber: item.queue.queueNumber,
          partySize: Number(item.queue.partySize || 1),
          reason: item.reason,
        })),
      },
    });
    els.seatDialog.close();
    showToast(`เปิด ${selectedSeatTable.label} ให้คิว ${selectedSeatQueue.queueNumber} แล้ว`);
    await refreshTables();
    const openOrder = await sweetConfirm("เปิดโต๊ะและสร้างออเดอร์เรียบร้อย ต้องการไปหน้าสั่งอาหารตอนนี้หรือไม่?", {
      title: "เปิดโต๊ะสำเร็จ",
      confirmText: "ไปหน้าสั่งอาหาร",
      cancelText: "อยู่หน้านี้",
      type: "success",
    });
    if (openOrder) location.href = result.orderUrl;
  } catch (error) {
    console.error("[waiting-queue-staff] seat failed", error);
    els.seatError.textContent = error?.message || "เปิดโต๊ะไม่สำเร็จ";
  } finally {
    els.seatConfirm.disabled = false;
    els.seatConfirm.textContent = "เปิดโต๊ะ";
  }
}

async function syncNow() {
  if (syncing) return;
  syncing = true;
  renderConnectivity();
  els.syncBtn.textContent = "กำลัง Sync...";
  try {
    const result = await syncWaitingQueueOutbox(tenantId, { maxOperations: 50 });
    if (result.errors?.length) {
      await sweetAlert(result.errors[0].error?.message || "มีรายการ Sync ไม่สำเร็จ", { title: "Sync ไม่ครบ", type: "warning" });
    } else showToast(`Sync สำเร็จ ${result.processed.toLocaleString("th-TH")} รายการ`);
  } finally {
    syncing = false;
    els.syncBtn.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i><span>Sync</span>';
    renderConnectivity();
  }
}

async function processPublicResponses() {
  for (const publicRow of publicRows) {
    if (!publicRow.customerResponse || responseInFlight.has(publicRow.waitingQueueId)) continue;
    const queue = queueById(publicRow.waitingQueueId);
    if (!queue) continue;
    const shouldApply = (publicRow.customerResponse === "on_the_way" && queue.status === "called")
      || (publicRow.customerResponse === "cancel_requested" && WAITING_QUEUE_ACTIVE_STATUSES.has(queue.status));
    if (!shouldApply) continue;
    responseInFlight.add(queue.id);
    try {
      await acknowledgeCustomerResponse(queue, publicRow);
      showToast(publicRow.customerResponse === "on_the_way" ? `${queue.queueNumber} ยืนยันกำลังมา` : `${queue.queueNumber} ขอยกเลิก`);
    } catch (error) {
      console.warn("[waiting-queue-staff] customer response apply failed", error);
    } finally {
      responseInFlight.delete(queue.id);
    }
  }
}

function bindEvents() {
  els.addBtn.addEventListener("click", openAddDialog);
  els.closeAdd.addEventListener("click", closeAddDialog);
  els.cancelAdd.addEventListener("click", closeAddDialog);
  els.addForm.addEventListener("submit", submitAddQueue);
  [els.partySize, els.priority, els.highChair, els.wheelchair, els.quietArea, els.strollerSpace].forEach(element => {
    element?.addEventListener("input", updateAddPreview);
    element?.addEventListener("change", updateAddPreview);
  });
  els.search.addEventListener("input", renderQueues);
  els.statusFilter.addEventListener("change", renderQueues);
  els.partyFilter.addEventListener("change", renderQueues);
  els.syncBtn.addEventListener("click", syncNow);
  els.displayBtn.addEventListener("click", () => window.open(queueDisplayUrl(tenantId), "waiting-queue-display", "noopener"));
  els.queueList.addEventListener("click", event => {
    const button = event.target.closest("[data-queue-action]");
    if (!button) return;
    handleQueueAction(button.dataset.queueAction, queueById(button.dataset.queueId));
  });
  els.tableList.addEventListener("click", event => {
    const button = event.target.closest("[data-table-seat]");
    if (!button) return;
    const table = tables.find(item => item.id === button.dataset.tableSeat);
    const queue = queueById(button.dataset.queueId);
    if (table && queue) openSeatDialog(queue, table);
  });
  els.seatTableList.addEventListener("change", event => {
    if (!event.target.matches('input[name="waitingSeatTable"]')) return;
    selectedSeatTable = tables.find(table => table.id === event.target.value) || null;
    syncSeatReasonVisibility();
  });
  els.closeSeat.addEventListener("click", () => els.seatDialog.close());
  els.cancelSeat.addEventListener("click", () => els.seatDialog.close());
  els.seatConfirm.addEventListener("click", confirmSeat);
  window.addEventListener("online", () => { renderConnectivity(); syncNow(); refreshTables(); });
  window.addEventListener("offline", renderConnectivity);
  window.addEventListener("waiting-queue:outbox-changed", renderConnectivity);
}

async function initialize() {
  tenantId = await resolveTenantId();
  const actor = currentActor();
  els.tenantName.textContent = `${tenantId} • ${actor.actorName}`;
  bindEvents();
  renderConnectivity();
  ensureWaitingNumberLease(tenantId).catch(() => {});
  await refreshTables();
  unsubscribeQueues = watchWaitingQueues(tenantId, rows => {
    queues = rows;
    renderQueues();
    renderTables();
    renderConnectivity();
  }, error => {
    console.error("[waiting-queue-staff] queue watch failed", error);
    showToast("โหลดคิวจาก Firebase ไม่สำเร็จ กำลังใช้ข้อมูลในเครื่อง", "error");
  });
  unsubscribePublic = watchWaitingQueuePublicResponses(tenantId, rows => {
    publicRows = rows;
    processPublicResponses();
    renderQueues();
  }, error => console.warn("[waiting-queue-staff] public watch failed", error));
  if (isOnline()) syncNow();
  tableTimer = setInterval(refreshTables, 15_000);
  clockTimer = setInterval(() => {
    renderStats();
    document.querySelectorAll(".waiting-countdown").forEach(element => {
      const remaining = Math.ceil((Number(element.dataset.deadline || 0) - Date.now()) / 1000);
      element.classList.toggle("overdue", remaining <= 0);
      element.textContent = remaining <= 0 ? "พ้นเวลาตอบรับ" : `เหลือ ${Math.max(1, Math.ceil(remaining / 60))} นาที`;
    });
  }, 15_000);
}

window.addEventListener("beforeunload", () => {
  unsubscribeQueues();
  unsubscribePublic();
  clearInterval(tableTimer);
  clearInterval(clockTimer);
}, { once: true });

initialize().catch(async error => {
  console.error("[waiting-queue-staff] initialize failed", error);
  await sweetAlert(error?.message || "เปิดระบบคิวรอโต๊ะไม่สำเร็จ", { title: "ระบบคิวรอโต๊ะ", type: "error" });
});
