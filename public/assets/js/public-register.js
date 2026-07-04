import { auth, functions, createUserWithEmailAndPassword, sendEmailVerification, reload, onAuthStateChanged, httpsCallable } from './firebase-config.js?v=20260704-003';

const $ = selector => document.querySelector(selector);
const form = $('#registerForm');
const verifyBox = $('#verifyBox');
const slugInput = $('#slug');
const slugPreview = $('#slugPreview');
const statusBox = $('#registerStatus');
const verifyStatus = $('#verifyStatus');
const submitButton = $('#submitRegister');
const activateButton = $('#activateTrial');
const resendButton = $('#resendEmail');
const requestSignup = httpsCallable(functions, 'requestTrialTenantSignup');
const activateSignup = httpsCallable(functions, 'activateTrialTenantSignup');

function cleanSlug(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function previewUrl(slug) { return `${location.origin}/s/${encodeURIComponent(slug || 'saas-test-shop')}/`; }
function setStatus(message = '', type = 'info') {
  statusBox.textContent = message;
  statusBox.classList.toggle('hidden', !message);
  statusBox.classList.toggle('error', type === 'error');
}
function setVerify(message = '', type = 'info') {
  verifyStatus.textContent = message;
  verifyStatus.classList.toggle('error', type === 'error');
}
function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  activateButton.disabled = isBusy;
  resendButton.disabled = isBusy;
}
function signupPayload() {
  const secretA = $('#secretA').value;
  const secretB = $('#secretB').value;
  if (secretA !== secretB) throw new Error('รหัสเข้าใช้งานและยืนยันรหัสไม่ตรงกัน');
  return {
    packageId: 'premium',
    ownerName: $('#ownerName').value.trim(),
    phone: $('#phone').value.trim(),
    orderDeliveryShopName: $('#orderDeliveryShopName').value.trim(),
    retailPosShopName: $('#retailPosShopName').value.trim(),
    slug: cleanSlug(slugInput.value),
    email: $('#email').value.trim().toLowerCase(),
    secret: secretA
  };
}
async function sendVerifyEmail(user) {
  await sendEmailVerification(user, { url: `${location.origin}/register/?verify=1`, handleCodeInApp: false });
}
async function submitSignup(event) {
  event.preventDefault();
  setStatus('');
  setBusy(true);
  try {
    const payload = signupPayload();
    slugInput.value = payload.slug;
    slugPreview.textContent = previewUrl(payload.slug);
    const credential = await createUserWithEmailAndPassword(auth, payload.email, payload.secret);
    await requestSignup(payload);
    await sendVerifyEmail(credential.user);
    form.classList.add('hidden');
    verifyBox.classList.add('show');
    setVerify('ส่งอีเมลยืนยันแล้ว กรุณาตรวจสอบกล่องจดหมาย');
  } catch (error) {
    const code = String(error?.code || error?.message || '');
    let message = error?.message || 'สมัครใช้งานไม่สำเร็จ';
    if (code.includes('email-already-in-use')) message = 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่นหรือลงชื่อเข้าใช้';
    if (code.includes('already-exists')) message = 'Slug นี้ถูกใช้งานแล้ว กรุณาเปลี่ยน slug';
    if (code.includes('weak-password')) message = 'รหัสเข้าใช้งานต้องมีอย่างน้อย 8 ตัวอักษร';
    setStatus(message, 'error');
  } finally {
    setBusy(false);
  }
}
async function activateTrial() {
  setBusy(true);
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('กรุณาสมัครหรือลงชื่อเข้าใช้ก่อน');
    await reload(user);
    if (!auth.currentUser.emailVerified) throw new Error('ยังไม่พบสถานะยืนยันอีเมล กรุณากดลิงก์ในอีเมลก่อน');
    const result = await activateSignup({});
    const slug = result.data?.slug || '';
    setVerify(`เปิดร้านสำเร็จแล้ว Premium Trial เริ่มใช้งานแล้ว`);
    location.href = slug ? `/login?tenant=${encodeURIComponent(slug)}` : '/login';
  } catch (error) {
    setVerify(error?.message || 'เปิดร้านไม่สำเร็จ', 'error');
  } finally {
    setBusy(false);
  }
}
async function resendVerification() {
  setBusy(true);
  try {
    if (!auth.currentUser) throw new Error('ไม่พบบัญชีผู้สมัคร กรุณาสมัครใหม่อีกครั้ง');
    await sendVerifyEmail(auth.currentUser);
    setVerify('ส่งอีเมลยืนยันอีกครั้งแล้ว');
  } catch (error) {
    setVerify(error?.message || 'ส่งอีเมลยืนยันไม่สำเร็จ', 'error');
  } finally {
    setBusy(false);
  }
}

slugInput.addEventListener('input', () => {
  const slug = cleanSlug(slugInput.value);
  slugPreview.textContent = previewUrl(slug);
});
form.addEventListener('submit', submitSignup);
activateButton.addEventListener('click', activateTrial);
resendButton.addEventListener('click', resendVerification);
onAuthStateChanged(auth, user => {
  if (user && location.search.includes('verify=1')) {
    form.classList.add('hidden');
    verifyBox.classList.add('show');
    setVerify(user.emailVerified ? 'อีเมลยืนยันแล้ว กดเปิดร้านได้เลย' : 'กรุณากดลิงก์ยืนยันในอีเมลก่อน');
  }
});