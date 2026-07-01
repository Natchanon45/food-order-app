import { usingDemoMode } from './data-service.js';
import { db, collection, onSnapshot, query, where } from './firebase-config.js?v=20260630-073';
import { demoStore } from './demo-store.js';
import { shopCollectionPath, resolveShopContext } from './tenant-context.js';
import { money, formatTime, getTableCode } from './ui.js?v=20260701-001';

const token = new URLSearchParams(location.search).get('token') || '';
const tableCode = getTableCode();
const section = document.querySelector('#previousOrdersSection');
const list = document.querySelector('#previousOrdersList');
const count = document.querySelector('#previousRoundCount');
const roundLabel = document.querySelector('#currentRoundLabel');

function sameCode(a, b) { return String(a || '').toUpperCase() === String(b || '').toUpperCase(); }
function timeValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
function isSameSession(order) {
  if (!order || order.orderType === 'delivery' || order.orderType === 'takeaway') return false;
  if (['paid', 'cancelled'].includes(order.status) || order.paymentStatus === 'paid') return false;
  return Boolean((token && order.tableToken === token) || (tableCode && sameCode(order.tableCode, tableCode)) || (tableCode && sameCode(order.movedFromTableCode, tableCode)));
}
function rowHtml(order) {
  const items = (order.items || []).map(item => '<div class="previous-round-item"><span>' + item.qty + ' × ' + item.name + '</span><strong>' + money(Number(item.qty) * Number(item.price)) + '</strong></div>').join('');
  return '<article class="previous-round"><div class="previous-round-head"><div class="previous-round-title">รอบที่ ' + (order.roundNumber || 1) + '</div><small>' + formatTime(order.createdAt || order.createdAtText) + '</small></div><div class="previous-round-items">' + items + '</div><div class="previous-round-head" style="margin-top:8px;margin-bottom:0"><small>ยืนยันแล้ว</small><strong>' + money(order.totalAmount) + ' บาท</strong></div></article>';
}
function render(orders) {
  if (!section || !list || (!token && !tableCode)) return;
  const rows = (orders || []).filter(isSameSession).sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0) || timeValue(a.createdAt || a.createdAtText) - timeValue(b.createdAt || b.createdAtText));
  const currentTable = [...rows].reverse().find(order => order.tableCode)?.tableName || [...rows].reverse().find(order => order.tableCode)?.tableCode || '';
  const highest = rows.reduce((max, order) => Math.max(max, Number(order.roundNumber || 0)), 0);
  if (roundLabel) roundLabel.textContent = 'รอบที่ ' + (highest + 1);
  if (count) count.textContent = rows.length + ' รอบ';
  const heading = section.querySelector('h2');
  if (heading) heading.textContent = currentTable ? 'รายการที่' + (String(currentTable).startsWith('โต๊ะ') ? currentTable : 'โต๊ะ ' + currentTable) + 'สั่งแล้ว' : 'รายการที่โต๊ะนี้สั่งแล้ว';
  section.hidden = rows.length === 0;
  list.innerHTML = rows.map(rowHtml).join('');
}
if (token || tableCode) {
  if (usingDemoMode) {
    const emit = () => render(demoStore.orders.list());
    emit();
    window.addEventListener('storage', emit);
    window.addEventListener('demo-store-change', emit);
    setInterval(emit, 1500);
  } else {
    const ordersPath = shopCollectionPath('orders', resolveShopContext());
    const ordersRef = collection(db, ...ordersPath);
    let byToken = [];
    let byTable = [];
    let byMovedFrom = [];
    const flush = () => { const merged = new Map(); [...byToken, ...byTable, ...byMovedFrom].forEach(order => merged.set(order.id, order)); render([...merged.values()]); };
    if (token) onSnapshot(query(ordersRef, where('tableToken', '==', token)), snapshot => { byToken = snapshot.docs.map(item => ({ id: item.id, ...item.data() })); flush(); });
    if (tableCode) onSnapshot(query(ordersRef, where('tableCode', '==', tableCode)), snapshot => { byTable = snapshot.docs.map(item => ({ id: item.id, ...item.data() })); flush(); });
    if (tableCode) onSnapshot(query(ordersRef, where('movedFromTableCode', '==', tableCode)), snapshot => { byMovedFrom = snapshot.docs.map(item => ({ id: item.id, ...item.data() })); flush(); });
  }
}
