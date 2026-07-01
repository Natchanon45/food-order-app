import { usingDemoMode } from './data-service.js';
import { db, collection, onSnapshot, query, where } from './firebase-config.js?v=20260630-073';
import { demoStore } from './demo-store.js';
import { shopCollectionPath, resolveShopContext } from './tenant-context.js';
import { money, formatTime } from './ui.js?v=20260701-001';

const token = new URLSearchParams(location.search).get('token') || '';
const section = document.querySelector('#previousOrdersSection');
const list = document.querySelector('#previousOrdersList');
const count = document.querySelector('#previousRoundCount');
const roundLabel = document.querySelector('#currentRoundLabel');

function timeValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowHtml(order) {
  const items = (order.items || []).map(item => '<div class="previous-round-item"><span>' + item.qty + ' × ' + item.name + (item.note ? '<br><small>' + item.note + '</small>' : '') + '</span><strong>' + money(Number(item.qty) * Number(item.price)) + '</strong></div>').join('');
  return '<article class="previous-round"><div class="previous-round-head"><div class="previous-round-title">รอบที่ ' + (order.roundNumber || 1) + '</div><small>' + formatTime(order.createdAt || order.createdAtText) + '</small></div><div class="previous-round-items">' + items + '</div><div class="previous-round-head" style="margin-top:8px;margin-bottom:0"><small>ยืนยันแล้ว</small><strong>' + money(order.totalAmount) + ' บาท</strong></div></article>';
}

function render(orders) {
  if (!section || !list || !token) return;
  const rows = (orders || []).filter(order => order.tableToken === token && order.orderType !== 'delivery' && order.orderType !== 'takeaway').sort((a, b) => Number(a.roundNumber || 0) - Number(b.roundNumber || 0) || timeValue(a.createdAt || a.createdAtText) - timeValue(b.createdAt || b.createdAtText));
  const highest = rows.reduce((max, order) => Math.max(max, Number(order.roundNumber || 0)), 0);
  if (roundLabel) roundLabel.textContent = 'รอบที่ ' + (highest + 1);
  if (count) count.textContent = rows.length + ' รอบ';
  section.hidden = rows.length === 0;
  list.innerHTML = rows.map(rowHtml).join('');
}

if (token) {
  if (usingDemoMode) {
    const emit = () => render(demoStore.orders.list());
    emit();
    window.addEventListener('storage', emit);
    window.addEventListener('demo-store-change', emit);
    setInterval(emit, 1500);
  } else {
    const ordersPath = shopCollectionPath('orders', resolveShopContext());
    onSnapshot(query(collection(db, ...ordersPath), where('tableToken', '==', token)), snapshot => render(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))));
  }
}
