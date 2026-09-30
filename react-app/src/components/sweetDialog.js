let activeResolve = null;

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function actionIcon(label, fallback = "check-lg") {
  const text = String(label || "");
  if (/ยกเลิก|ปิด|cancel|close/i.test(text)) return "x-lg";
  if (/ลบ|delete|remove/i.test(text)) return "trash";
  if (/บันทึก|save/i.test(text)) return "floppy";
  return fallback;
}

function setActionButton(button, label, fallbackIcon = "check-lg", explicitIcon = "") {
  const text = String(label || "");
  const icon = String(explicitIcon || "").trim() || actionIcon(text, fallbackIcon);
  button.innerHTML = `<i class="bi bi-${escapeHtml(icon)}" aria-hidden="true"></i><span>${escapeHtml(text)}</span>`;
}

function setDialogIcon(icon, type = "warning") {
  const name = type === "warning" ? "exclamation-triangle" : type === "error" ? "x-circle" : "check-circle";
  icon.innerHTML = `<i class="bi bi-${name}" aria-hidden="true"></i>`;
}

function closeDialog(value) {
  const root = document.querySelector("#sweetDialogRoot");
  root?.classList.remove("show");
  const resolve = activeResolve;
  activeResolve = null;
  window.setTimeout(() => {
    if (root && document.body && root.parentElement !== document.body) document.body.appendChild(root);
    resolve?.(value);
  }, 120);
}

function ensureDialog() {
  let root = document.querySelector("#sweetDialogRoot");
  if (root) return root;
  root = document.createElement("div");
  root.id = "sweetDialogRoot";
  root.className = "sweet-dialog-backdrop";
  root.innerHTML = `<div class="sweet-dialog" role="dialog" aria-modal="true" aria-labelledby="sweetDialogTitle" aria-describedby="sweetDialogMessage">
    <div id="sweetDialogIcon" class="sweet-dialog-icon"><i class="bi bi-check-circle" aria-hidden="true"></i></div>
    <h2 id="sweetDialogTitle" class="sweet-dialog-title"></h2>
    <p id="sweetDialogMessage" class="sweet-dialog-message"></p>
    <input id="sweetDialogInput" class="sweet-dialog-input" type="text" autocomplete="off" hidden>
    <div id="sweetDialogActions" class="sweet-dialog-actions">
      <button id="sweetDialogCancel" class="sweet-dialog-button sweet-dialog-cancel" type="button"><i class="bi bi-x-lg" aria-hidden="true"></i><span></span></button>
      <button id="sweetDialogConfirm" class="sweet-dialog-button sweet-dialog-confirm" type="button"><i class="bi bi-check-lg" aria-hidden="true"></i><span></span></button>
    </div>
  </div>`;
  document.body.appendChild(root);
  root.querySelector("#sweetDialogConfirm").addEventListener("click", () => closeDialog(true));
  root.querySelector("#sweetDialogCancel").addEventListener("click", () => closeDialog(false));
  root.addEventListener("click", event => { if (event.target === root) closeDialog(false); });
  document.addEventListener("keydown", event => {
    if (!root.classList.contains("show")) return;
    if (event.key === "Escape") closeDialog(false);
    if (event.key === "Enter" && !root.querySelector("#sweetDialogInput").hidden) closeDialog(true);
  });
  return root;
}

function mountDialogRoot(root, portalTarget) {
  const target = portalTarget instanceof Element ? portalTarget : document.body;
  if (root.parentElement !== target) target.appendChild(root);
}

function configure(message, options = {}, prompt = false) {
  const root = ensureDialog();
  mountDialogRoot(root, options.portalTarget);
  const title = root.querySelector("#sweetDialogTitle");
  const msg = root.querySelector("#sweetDialogMessage");
  const icon = root.querySelector("#sweetDialogIcon");
  const actions = root.querySelector("#sweetDialogActions");
  const input = root.querySelector("#sweetDialogInput");
  const cancel = root.querySelector("#sweetDialogCancel");
  const confirm = root.querySelector("#sweetDialogConfirm");
  title.textContent = options.title || "";
  msg.textContent = String(message ?? "");
  icon.className = `sweet-dialog-icon ${options.type || "warning"}`.trim();
  setDialogIcon(icon, options.type || "warning");
  setActionButton(confirm, options.confirmText || "ยืนยัน", "check-lg", options.confirmIcon);
  setActionButton(cancel, options.cancelText || "ยกเลิก", "x-lg", options.cancelIcon);
  cancel.hidden = false;
  input.hidden = !prompt;
  actions.classList.add("has-cancel");
  root.classList.add("show");
  return { root, input, confirm };
}

export function sweetConfirm(message, options = {}) {
  const { confirm } = configure(message, options, false);
  confirm.focus({ preventScroll: true });
  return new Promise(resolve => { activeResolve = resolve; });
}

export function sweetPrompt(message, defaultValue = "", options = {}) {
  const { input } = configure(message, options, true);
  input.readOnly = Boolean(options.readOnly);
  input.value = String(defaultValue ?? "");
  input.placeholder = options.placeholder || "";
  input.focus({ preventScroll: true });
  if (options.selectValue !== false) input.select();
  return new Promise(resolve => {
    activeResolve = confirmed => resolve(confirmed ? input.value : null);
  });
}

export function sweetAlert(message, options = {}) {
  const root = ensureDialog();
  mountDialogRoot(root, options.portalTarget);
  const title = root.querySelector("#sweetDialogTitle");
  const msg = root.querySelector("#sweetDialogMessage");
  const icon = root.querySelector("#sweetDialogIcon");
  const actions = root.querySelector("#sweetDialogActions");
  const input = root.querySelector("#sweetDialogInput");
  const cancel = root.querySelector("#sweetDialogCancel");
  const confirm = root.querySelector("#sweetDialogConfirm");
  title.textContent = options.title || "";
  msg.textContent = String(message ?? "");
  icon.className = `sweet-dialog-icon ${options.type || "warning"}`.trim();
  setDialogIcon(icon, options.type || "warning");
  setActionButton(confirm, options.confirmText || "ตกลง", "check-lg", options.confirmIcon);
  cancel.hidden = true;
  input.hidden = true;
  actions.classList.remove("has-cancel");
  root.classList.add("show");
  confirm.focus({ preventScroll: true });
  return new Promise(resolve => { activeResolve = resolve; });
}
