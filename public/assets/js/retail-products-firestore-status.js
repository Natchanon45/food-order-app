import { auth, db, doc, setDoc, serverTimestamp } from './firebase-config.js?v=20260627-5';
import { getTenantId } from './retail-db.js?v=20260627-5';

const panel = document.createElement('section');
panel.className = 'panel';
panel.style.marginTop = '12px';
panel.innerHTML = `
  <div class="section-heading">
    <div>
      <h2>สถานะ Firestore</h2>
      <p id="firestoreStatusText">กำลังตรวจสอบ...</p>
    </div>
    <button id="firestoreTestBtn" class="btn btn-secondary" type="button">ทดสอบบันทึก Firestore</button>
  </div>
  <p id="firestoreStatusError" class="error-text"></p>
`;

document.querySelector('.management-container')?.prepend(panel);

const statusText = panel.querySelector('#firestoreStatusText');
const errorText = panel.querySelector('#firestoreStatusError');
const button = panel.querySelector('#firestoreTestBtn');

function statusLine() {
  const tenantId = getTenantId();
  const email = auth?.currentUser?.email || '-';
  const uid = auth?.currentUser?.uid || '-';
  return `path: tenants/${tenantId}/products • email: ${email} • uid: ${uid}`;
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  errorText.textContent = isError ? message : '';
}

setStatus(statusLine());

button?.addEventListener('click', async () => {
  const tenantId = getTenantId();
  const id = `DIAG-${Date.now()}`;
  button.disabled = true;
  button.textContent = 'กำลังทดสอบ...';
  setStatus(statusLine());
  try {
    if (!auth?.currentUser) throw new Error('ยังไม่มี Firebase Auth currentUser กรุณา logout/login ใหม่');
    if (!db) throw new Error('Firestore db ไม่พร้อมใช้งาน');
    await setDoc(doc(db, 'tenants', tenantId, 'products', id), {
      id,
      tenantId,
      name: 'Firestore Diagnostic Product',
      barcode: id,
      unit: 'test',
      price: 0,
      stock: 0,
      minStock: 0,
      diagnostic: true,
      createdByUid: auth.currentUser.uid,
      createdByEmail: auth.currentUser.email || '',
      updatedAt: Date.now(),
      updatedAtServer: serverTimestamp()
    }, { merge: true });
    setStatus(`บันทึก Firestore สำเร็จ: tenants/${tenantId}/products/${id}`);
    alert(`บันทึก Firestore สำเร็จ\n${id}`);
  } catch (error) {
    console.error('[products-firestore-status]', error);
    const message = `${error?.code || 'error'}: ${error?.message || error}`;
    setStatus(message, true);
    alert(`Firestore Error\n${message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'ทดสอบบันทึก Firestore';
  }
});
