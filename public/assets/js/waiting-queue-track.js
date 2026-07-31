import { db, doc, onSnapshot } from './firebase-config.js?v=20260630-073';

const card = document.querySelector('#queueTrackCard');
const token = new URLSearchParams(location.search).get('token')?.trim() || '';
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
function render(row) {
  const state = ({ waiting: ['กำลังรอเรียกคิว', 'กรุณารอในบริเวณร้าน'], called: ['ถึงคิวของคุณแล้ว', 'กรุณาติดต่อพนักงานเพื่อรับโต๊ะ'], seated: ['รับโต๊ะเรียบร้อยแล้ว', `โต๊ะ ${row.tableCode || '-'}`], skipped: ['คิวถูกพักไว้', 'กรุณาติดต่อพนักงานเมื่อต้องการกลับเข้าคิว'], cancelled: ['คิวนี้ถูกยกเลิก', 'กรุณาติดต่อพนักงานหากต้องการรับคิวใหม่'] })[row.status] || ['กำลังตรวจสอบ', ''];
  card.className = `queue-track-card ${row.status === 'called' ? 'queue-track-called' : ''}`;
  card.innerHTML = `<header class="queue-track-head"><small>เลขคิวของคุณ</small><div class="queue-track-number">${escapeHtml(row.queueNumber)}</div><span>${Number(row.partySize)} คน</span></header><div class="queue-track-body"><div class="queue-track-state">${state[0]}</div><p>${escapeHtml(state[1])}</p>${row.status === 'waiting' ? `<div class="queue-track-ahead"><div><strong>${Number(row.peopleAhead || 0)}</strong><span>คิวก่อนหน้า</span></div><div><strong>${Math.max(0, Number(row.peopleAhead || 0) * 5)}–${Math.max(5, (Number(row.peopleAhead || 0) + 1) * 8)}</strong><span>นาทีโดยประมาณ</span></div></div>` : ''}</div>`;
}
if (!token || token.length < 20) card.innerHTML = '<div class="queue-track-loading">ลิงก์ติดตามคิวไม่ถูกต้อง</div>';
else onSnapshot(doc(db, 'publicWaitingQueues', token), snapshot => { if (!snapshot.exists()) card.innerHTML = '<div class="queue-track-loading">ไม่พบคิวนี้ หรือคิวหมดอายุแล้ว</div>'; else render(snapshot.data()); }, () => { card.innerHTML = '<div class="queue-track-loading">เชื่อมต่อข้อมูลคิวไม่สำเร็จ กรุณาลองใหม่</div>'; });
