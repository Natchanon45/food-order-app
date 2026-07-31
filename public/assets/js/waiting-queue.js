import { db, auth, collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc, writeBatch } from './firebase-config.js?v=20260630-073';
import { resolveShopContext, shopCollectionPath, shopDocumentPath } from './tenant-context.js';
import { toast } from './ui.js?v=20260801-103';

const form = document.querySelector('#waitingQueueForm');
const list = document.querySelector('#waitingQueueList');
const dialog = document.querySelector('#seatQueueDialog');
const tableList = document.querySelector('#availableTableList');
const seatTitle = document.querySelector('#seatDialogTitle');
const confirmSeat = document.querySelector('#confirmSeatQueue');
const ACTIVE = new Set(['waiting', 'called']);
let queues = [];
let tables = [];
let selectedQueueId = '';
let syncingPositions = false;

const shop = () => resolveShopContext();
const shopCollection = name => collection(db, ...shopCollectionPath(name, shop()));
const shopDoc = (name, id) => doc(db, ...shopDocumentPath(name, id, shop()));
const publicDoc = token => doc(db, 'publicWaitingQueues', token);
const dateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date()).replaceAll('-', '');
const stableId = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const queueNumber = () => `W${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false }).replaceAll(':', '').slice(0, 6)}${Math.floor(Math.random() * 10)}`;
const timeValue = value => value?.toMillis?.() || value?.seconds * 1000 || new Date(value || 0).getTime() || 0;
const formatTime = value => new Intl.DateTimeFormat('th-TH-u-ca-gregory', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(new Date(timeValue(value) || Date.now()));
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const activeQueues = () => queues.filter(row => ACTIVE.has(row.status)).sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt) || String(a.queueNumber).localeCompare(String(b.queueNumber)));

function publicPayload(queue, position = 0) {
  return {
    publicToken: queue.publicToken, tenantId: shop().id, queueNumber: queue.queueNumber,
    partySize: Number(queue.partySize), status: queue.status, peopleAhead: Math.max(0, position),
    tableCode: queue.status === 'seated' ? String(queue.tableCode || '') : '',
    calledAtText: queue.calledAtText || '', updatedAt: serverTimestamp()
  };
}

async function syncPublicPositions() {
  if (syncingPositions || !auth?.currentUser) return;
  syncingPositions = true;
  try {
    const ordered = activeQueues();
    const batch = writeBatch(db);
    queues.filter(row => row.publicToken).forEach(row => {
      const position = ACTIVE.has(row.status) ? ordered.findIndex(item => item.id === row.id) : 0;
      batch.set(publicDoc(row.publicToken), publicPayload(row, position), { merge: true });
    });
    if (queues.length) await batch.commit();
  } catch (error) { console.warn('WAITING_QUEUE_PUBLIC_SYNC_FAILED', error); }
  finally { syncingPositions = false; }
}

function statusText(status) { return ({ waiting: 'กำลังรอ', called: 'เรียกแล้ว', seated: 'รับโต๊ะแล้ว', skipped: 'พักคิว', cancelled: 'ยกเลิก' })[status] || status; }
function render() {
  const active = activeQueues();
  document.querySelector('#waitingCount').textContent = String(queues.filter(row => row.status === 'waiting').length);
  document.querySelector('#calledCount').textContent = String(queues.filter(row => row.status === 'called').length);
  document.querySelector('#availableTableCount').textContent = String(tables.filter(row => row.active !== false && (!row.status || row.status === 'available')).length);
  if (!active.length) { list.innerHTML = '<div class="waiting-empty">ยังไม่มีลูกค้ารอโต๊ะ</div>'; return; }
  list.innerHTML = active.map((row, index) => `
    <article class="waiting-row ${row.status === 'called' ? 'is-called' : ''}" data-id="${row.id}">
      <div class="waiting-number"><small>เลขคิว</small><strong>${escapeHtml(row.queueNumber)}</strong></div>
      <div class="waiting-customer"><strong>${escapeHtml(row.customerName)}</strong><span>${escapeHtml(row.customerPhone || 'ไม่ระบุเบอร์')}</span></div>
      <div class="waiting-party"><i class="bi bi-people"></i>${Number(row.partySize)} คน</div>
      <div><span class="waiting-status">${statusText(row.status)}</span><div class="waiting-meta">รอ ${Math.max(0, Math.floor((Date.now() - timeValue(row.createdAt)) / 60000))} นาที${row.note ? ` • ${escapeHtml(row.note)}` : ''}</div></div>
      <div class="waiting-actions">
        ${row.status === 'waiting' ? '<button class="btn btn-warning btn-sm" data-action="call"><i class="bi bi-megaphone"></i><span>เรียกคิว</span></button>' : '<button class="btn btn-sm" data-action="recall"><i class="bi bi-megaphone-fill"></i><span>เรียกซ้ำ</span></button>'}
        <button class="btn btn-primary btn-sm" data-action="seat"><i class="bi bi-easel2"></i><span>เปิดโต๊ะ</span></button>
        <button class="btn btn-sm" data-action="skip"><i class="bi bi-arrow-down-circle"></i><span>พักคิว</span></button>
      </div>
    </article>`).join('');
  void syncPublicPositions();
}

async function updateQueue(row, patch) {
  const next = { ...row, ...patch, tenantId: shop().id, updatedAt: serverTimestamp() };
  await runTransaction(db, async transaction => {
    transaction.update(shopDoc('waitingQueues', row.id), { ...patch, tenantId: shop().id, updatedAt: serverTimestamp() });
    transaction.set(publicDoc(row.publicToken), publicPayload(next), { merge: true });
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!navigator.onLine) { toast('การออกเลขคิวใหม่ต้องเชื่อมต่ออินเทอร์เน็ต เพื่อป้องกันเลขคิวซ้ำ', 'error'); return; }
  const button = form.querySelector('button[type="submit"]');
  const customerName = document.querySelector('#customerName').value.trim();
  const customerPhone = document.querySelector('#customerPhone').value.trim();
  const partySize = Number(document.querySelector('#partySize').value);
  const note = document.querySelector('#queueNote').value.trim();
  if (!customerName || !Number.isInteger(partySize) || partySize < 1 || partySize > 30) { toast('กรุณาระบุชื่อและจำนวนลูกค้า 1–30 คน', 'error'); return; }
  button.disabled = true;
  try {
    const id = stableId('WAIT');
    const publicToken = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`;
    const row = { id, tenantId: shop().id, queueNumber: queueNumber(), publicToken, customerName, customerPhone, partySize, note, status: 'waiting', dateKey: dateKey(), createdBy: auth.currentUser?.uid || '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await runTransaction(db, async transaction => {
      transaction.set(shopDoc('waitingQueues', id), row);
      transaction.set(publicDoc(publicToken), publicPayload(row));
    });
    form.reset(); document.querySelector('#partySize').value = '2';
    await navigator.clipboard?.writeText(`${location.origin}/queue?token=${encodeURIComponent(publicToken)}`).catch(() => {});
    toast(`เพิ่มคิว ${row.queueNumber} แล้ว และคัดลอกลิงก์ติดตามแล้ว`);
  } catch (error) { console.error(error); toast('เพิ่มคิวไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและสิทธิ์ผู้ใช้', 'error'); }
  finally { button.disabled = false; }
});

list.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const row = queues.find(item => item.id === button.closest('[data-id]')?.dataset.id); if (!row) return;
  if (!navigator.onLine) { toast('การเปลี่ยนสถานะคิวต้องเชื่อมต่ออินเทอร์เน็ต', 'error'); return; }
  button.disabled = true;
  try {
    if (button.dataset.action === 'call' || button.dataset.action === 'recall') {
      await updateQueue(row, { status: 'called', calledAt: serverTimestamp(), calledAtText: new Date().toISOString(), callCount: Number(row.callCount || 0) + 1 }); toast(`เรียกคิว ${row.queueNumber} แล้ว`);
    } else if (button.dataset.action === 'skip') {
      await updateQueue(row, { status: 'skipped', skippedAt: serverTimestamp() }); toast(`พักคิว ${row.queueNumber} แล้ว`);
    } else if (button.dataset.action === 'seat') openSeatDialog(row);
  } catch (error) { console.error(error); toast('ปรับสถานะคิวไม่สำเร็จ', 'error'); }
  finally { button.disabled = false; }
});

function openSeatDialog(row) {
  selectedQueueId = row.id; seatTitle.textContent = `เลือกโต๊ะสำหรับ ${row.partySize} คน`;
  const available = tables.filter(table => table.active !== false && (!table.status || table.status === 'available')).sort((a, b) => Number(a.seats || a.capacity || 999) - Number(b.seats || b.capacity || 999));
  tableList.innerHTML = available.length ? available.map((table, index) => `<label class="table-choice"><input type="radio" name="seatTable" value="${escapeHtml(table.id)}" ${index === 0 ? 'checked' : ''}><span><strong>${escapeHtml(table.name || `โต๊ะ ${table.code || table.id}`)}</strong><small>${table.seats || table.capacity ? `รองรับ ${Number(table.seats || table.capacity)} คน` : 'ไม่ระบุจำนวนที่นั่ง'}</small></span></label>`).join('') : '<div class="waiting-empty">ขณะนี้ไม่มีโต๊ะว่าง</div>';
  confirmSeat.disabled = !available.length; dialog.showModal();
}

confirmSeat.addEventListener('click', async event => {
  event.preventDefault();
  const queue = queues.find(row => row.id === selectedQueueId);
  const tableId = tableList.querySelector('input:checked')?.value;
  if (!queue || !tableId) return;
  confirmSeat.disabled = true;
  try {
    const token = `TABLE-${crypto.randomUUID()}`;
    await runTransaction(db, async transaction => {
      const queueRef = shopDoc('waitingQueues', queue.id); const tableRef = shopDoc('tables', tableId);
      const [queueSnap, tableSnap] = await Promise.all([transaction.get(queueRef), transaction.get(tableRef)]);
      if (!queueSnap.exists() || !ACTIVE.has(queueSnap.data().status)) throw new Error('QUEUE_NOT_ACTIVE');
      if (!tableSnap.exists() || tableSnap.data().active === false || (tableSnap.data().status && tableSnap.data().status !== 'available')) throw new Error('TABLE_NOT_AVAILABLE');
      const table = tableSnap.data(); const tableCode = table.code || tableId;
      transaction.update(tableRef, { status: 'occupied', orderToken: token, currentRound: 0, orderIds: [], sessionStartedAt: new Date().toISOString(), waitingQueueId: queue.id, tenantId: shop().id, updatedAt: serverTimestamp() });
      transaction.update(queueRef, { status: 'seated', tableId, tableCode, tableToken: token, seatedAt: serverTimestamp(), tenantId: shop().id, updatedAt: serverTimestamp() });
      transaction.set(publicDoc(queue.publicToken), publicPayload({ ...queue, status: 'seated', tableCode }), { merge: true });
    });
    dialog.close(); toast(`เปิดโต๊ะให้คิว ${queue.queueNumber} แล้ว`);
  } catch (error) { console.error(error); toast(error.message === 'TABLE_NOT_AVAILABLE' ? 'โต๊ะนี้ไม่ว่างแล้ว กรุณาเลือกโต๊ะใหม่' : 'เปิดโต๊ะจากคิวไม่สำเร็จ', 'error'); }
  finally { confirmSeat.disabled = false; }
});

document.querySelector('#copyPublicLink').addEventListener('click', async () => {
  const row = activeQueues()[0]; if (!row) { toast('ยังไม่มีคิวสำหรับคัดลอกลิงก์', 'error'); return; }
  await navigator.clipboard.writeText(`${location.origin}/queue?token=${encodeURIComponent(row.publicToken)}`); toast(`คัดลอกลิงก์คิว ${row.queueNumber} แล้ว`);
});

onSnapshot(shopCollection('waitingQueues'), snapshot => { queues = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(row => row.dateKey === dateKey()); render(); }, error => { console.error(error); list.innerHTML = '<div class="waiting-empty">โหลดคิวไม่สำเร็จ กรุณาตรวจสอบสิทธิ์</div>'; });
onSnapshot(shopCollection('tables'), snapshot => { tables = snapshot.docs.map(item => ({ id: item.id, ...item.data() })); render(); });
