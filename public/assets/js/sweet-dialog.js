let activeResolve = null;

function whenBodyReady() {
  if (document.body) return Promise.resolve();
  return new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

function ensureDialog() {
  let root = document.querySelector('#sweetDialogRoot');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'sweetDialogRoot';
  root.className = 'sweet-dialog-backdrop';
  root.innerHTML = `<div class="sweet-dialog" role="dialog" aria-modal="true" aria-labelledby="sweetDialogTitle" aria-describedby="sweetDialogMessage"><div id="sweetDialogIcon" class="sweet-dialog-icon"><i class="bi bi-check-circle" aria-hidden="true"></i></div><h2 id="sweetDialogTitle" class="sweet-dialog-title">แจ้งเตือน</h2><p id="sweetDialogMessage" class="sweet-dialog-message"></p><input id="sweetDialogInput" class="sweet-dialog-input" type="text" autocomplete="off" hidden><div id="sweetDialogActions" class="sweet-dialog-actions"><button id="sweetDialogCancel" class="sweet-dialog-button sweet-dialog-cancel" type="button">ยกเลิก</button><button id="sweetDialogConfirm" class="sweet-dialog-button sweet-dialog-confirm" type="button">ตกลง</button></div></div>`;
  document.body.appendChild(root);
  root.querySelector('#sweetDialogConfirm').addEventListener('click', () => closeDialog(true));
  root.querySelector('#sweetDialogCancel').addEventListener('click', () => closeDialog(false));
  root.addEventListener('click', event => { if (event.target === root) closeDialog(false); });
  document.addEventListener('keydown', event => {
    if (!root.classList.contains('show')) return;
    if (event.key === 'Escape') closeDialog(false);
    if (event.key === 'Enter' && !root.querySelector('#sweetDialogInput').hidden) closeDialog(true);
  });
  return root;
}

function setDialogIcon(icon, type = "warning") {
  const iconName = type === "warning" ? "exclamation-triangle" : type === "error" ? "x-circle" : "check-circle";
  icon.innerHTML = `<i class="bi bi-${iconName}" aria-hidden="true"></i>`;
}

function setDialogButton(button, label, iconName) {
  button.innerHTML = `<i class="bi bi-${iconName}" aria-hidden="true"></i><span>${String(label || '')}</span>`;
}

function closeDialog(value) {
  const root = document.querySelector('#sweetDialogRoot');
  root?.classList.remove('show');
  const resolve = activeResolve;
  activeResolve = null;
  setTimeout(() => resolve?.(value), 120);
}

export async function sweetAlert(message, options = {}) {
  await whenBodyReady();
  const root = ensureDialog();
  const title = root.querySelector('#sweetDialogTitle');
  const msg = root.querySelector('#sweetDialogMessage');
  const icon = root.querySelector('#sweetDialogIcon');
  const actions = root.querySelector('#sweetDialogActions');
  const input = root.querySelector('#sweetDialogInput');
  const cancel = root.querySelector('#sweetDialogCancel');
  const confirm = root.querySelector('#sweetDialogConfirm');
  title.textContent = options.title || 'แจ้งเตือน';
  msg.textContent = String(message ?? '');
  icon.className = `sweet-dialog-icon ${options.type || 'warning'}`.trim();
  setDialogIcon(icon, options.type || 'warning');
  setDialogButton(confirm, options.confirmText || 'ตกลง', options.confirmIcon || 'check-circle');
  cancel.hidden = true;
  input.hidden = true;
  actions.classList.remove('has-cancel');
  root.classList.add('show');
  confirm.focus({ preventScroll: true });
  return new Promise(resolve => { activeResolve = resolve; });
}

export async function sweetConfirm(message, options = {}) {
  await whenBodyReady();
  const root = ensureDialog();
  const title = root.querySelector('#sweetDialogTitle');
  const msg = root.querySelector('#sweetDialogMessage');
  const icon = root.querySelector('#sweetDialogIcon');
  const actions = root.querySelector('#sweetDialogActions');
  const input = root.querySelector('#sweetDialogInput');
  const cancel = root.querySelector('#sweetDialogCancel');
  const confirm = root.querySelector('#sweetDialogConfirm');
  title.textContent = options.title || 'ยืนยันการทำรายการ';
  msg.textContent = String(message ?? '');
  icon.className = `sweet-dialog-icon ${options.type || 'warning'}`.trim();
  setDialogIcon(icon, options.type || 'warning');
  setDialogButton(confirm, options.confirmText || 'ยืนยัน', options.confirmIcon || 'check-circle');
  setDialogButton(cancel, options.cancelText || 'ยกเลิก', options.cancelIcon || 'x-circle');
  cancel.hidden = false;
  input.hidden = true;
  actions.classList.add('has-cancel');
  root.classList.add('show');
  confirm.focus({ preventScroll: true });
  return new Promise(resolve => { activeResolve = resolve; });
}

export async function sweetPrompt(message, defaultValue = '', options = {}) {
  await whenBodyReady();
  const root = ensureDialog();
  const title = root.querySelector('#sweetDialogTitle');
  const msg = root.querySelector('#sweetDialogMessage');
  const icon = root.querySelector('#sweetDialogIcon');
  const input = root.querySelector('#sweetDialogInput');
  const actions = root.querySelector('#sweetDialogActions');
  const cancel = root.querySelector('#sweetDialogCancel');
  const confirm = root.querySelector('#sweetDialogConfirm');
  title.textContent = options.title || 'กรอกข้อมูล';
  msg.textContent = String(message ?? '');
  icon.className = `sweet-dialog-icon ${options.type || 'warning'}`.trim();
  setDialogIcon(icon, options.type || 'warning');
  input.hidden = false;
  input.readOnly = Boolean(options.readOnly);
  input.value = String(defaultValue ?? '');
  input.placeholder = options.placeholder || '';
  setDialogButton(confirm, options.confirmText || 'ตกลง', options.confirmIcon || 'check-circle');
  setDialogButton(cancel, options.cancelText || 'ยกเลิก', options.cancelIcon || 'x-circle');
  cancel.hidden = false;
  actions.classList.add('has-cancel');
  root.classList.add('show');
  input.focus({ preventScroll: true });
  if (options.selectValue !== false) input.select();
  return new Promise(resolve => {
    activeResolve = confirmed => resolve(confirmed ? input.value : null);
  });
}

window.sweetAlert = sweetAlert;
window.sweetConfirm = sweetConfirm;
window.sweetPrompt = sweetPrompt;
window.alert = message => { sweetAlert(message); };
window.confirm = message => { sweetConfirm(message); return false; };
