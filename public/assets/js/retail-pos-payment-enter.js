const receivedInput = document.querySelector("#receivedInput");
const confirmPaymentBtn = document.querySelector("#confirmPaymentBtn");
const paymentForm = document.querySelector("#paymentDialog .payment-form");
let activePadInput = null;
let replaceNext = false;

receivedInput?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();

  if (!confirmPaymentBtn || confirmPaymentBtn.disabled) return;
  confirmPaymentBtn.click();
});

if (receivedInput) {
  receivedInput.type = "text";
  receivedInput.inputMode = "decimal";
  receivedInput.autocomplete = "off";
}

function desktopPadEnabled() {
  return window.matchMedia("(min-width: 801px)").matches;
}

function addPadStyle() {
  if (document.querySelector("#posDesktopPadStyle")) return;
  const style = document.createElement("style");
  style.id = "posDesktopPadStyle";
  style.textContent = `@media(min-width:801px){.payment-form.has-pos-pad{width:min(760px,calc(100vw - 64px));max-width:760px;display:grid;grid-template-columns:minmax(0,1fr)220px;grid-template-areas:"head head" "total pad" "customer pad" "method pad" "received pad" "change pad" "error error" "actions actions";gap:10px 12px;align-items:start;overflow-x:hidden}.payment-form.has-pos-pad .dialog-head{grid-area:head}.payment-form.has-pos-pad .payment-total{grid-area:total}.payment-form.has-pos-pad .customer-picker{grid-area:customer;min-width:0}.payment-form.has-pos-pad label:has(#paymentMethod){grid-area:method}.payment-form.has-pos-pad #receivedWrap{grid-area:received}.payment-form.has-pos-pad .change-row{grid-area:change}.payment-form.has-pos-pad #paymentError{grid-area:error}.payment-form.has-pos-pad .dialog-actions{grid-area:actions}.payment-form.has-pos-pad input,.payment-form.has-pos-pad select{min-width:0}.pos-number-pad{grid-area:pad;position:sticky;top:8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;padding:10px;border:1px solid #dfeae3;border-radius:16px;background:#f8fcfa;z-index:1;min-width:0}.pos-number-pad-title{grid-column:1/-1;margin:0 0 2px;color:#526259;font-size:12px;font-weight:900}.pos-number-pad button{appearance:none!important;-webkit-appearance:none!important;min-width:0;min-height:42px;border:1px solid #dbe7df;border-radius:12px;background:#fff!important;background-image:none!important;color:#102317;font-family:inherit!important;font-size:17px;font-weight:900;line-height:1;touch-action:manipulation;padding:0 6px;display:inline-grid!important;place-items:center!important;text-indent:0!important}.pos-number-pad button::before,.pos-number-pad button::after,.pos-number-pad button i,.pos-number-pad button svg{content:none!important;display:none!important;visibility:hidden!important;width:0!important;height:0!important;margin:0!important}.pos-number-pad button:hover{border-color:#9fd0b3;background:#effaf3!important}.pos-number-pad .is-action{color:#0d6f34;background:#eef8f1!important;font-size:14px}.pos-number-pad .is-danger{color:#b42318;background:#fff3f3!important;border-color:#ffd0d0;font-size:14px}.pos-number-pad .is-wide{grid-column:span 2}.pos-number-pad .is-primary{color:#fff;background:#159447!important;border-color:#159447;font-size:15px}.payment-form.has-pos-pad .customer-search-results{z-index:20;max-width:100%}}@media(max-width:800px){.pos-number-pad{display:none!important}}`;
  document.head.appendChild(style);
}

function selectionCoversValue(input) {
  try {
    return input.selectionStart === 0 && input.selectionEnd === String(input.value || "").length && input.selectionEnd > input.selectionStart;
  } catch {
    return false;
  }
}

function moveCursorToEnd(input) {
  try {
    const end = String(input.value || "").length;
    input.setSelectionRange(end, end);
  } catch {}
}

function selectAllInput(input) {
  if (!input || !desktopPadEnabled()) return;
  activePadInput = input;
  replaceNext = true;
  setTimeout(() => {
    try { input.select(); } catch {}
  }, 0);
}

function cleanMoney(value = "") {
  let text = String(value || "").replace(/[^0-9.]/g, "");
  const firstDot = text.indexOf(".");
  if (firstDot >= 0) {
    text = text.slice(0, firstDot + 1) + text.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  }
  return text;
}

function setValue(input, value) {
  if (!input) return;
  const phoneMode = input.id === "saleCustomerSearch";
  input.value = phoneMode ? String(value || "").replace(/\D/g, "").slice(0, 10) : cleanMoney(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.focus({ preventScroll: true });
  moveCursorToEnd(input);
}

function appendPad(value) {
  if (!activePadInput) return;
  const phoneMode = activePadInput.id === "saleCustomerSearch";
  if (phoneMode && (value === "." || value === "00")) return;

  const shouldReplace = replaceNext || selectionCoversValue(activePadInput);
  let current = shouldReplace ? "" : String(activePadInput.value || "");
  replaceNext = false;

  if (!phoneMode && value === ".") {
    if (current.includes(".")) return;
    current = current ? `${current}.` : "0.";
    setValue(activePadInput, current);
    return;
  }

  setValue(activePadInput, `${current}${value}`);
}

function exactAmount() {
  if (activePadInput !== receivedInput) return;
  replaceNext = false;
  setValue(receivedInput, (document.querySelector("#paymentTotal")?.textContent || "").replace(/[^0-9.]/g, ""));
}

function createPad() {
  if (!paymentForm || paymentForm.querySelector(".pos-number-pad")) return;
  addPadStyle();
  paymentForm.classList.add("has-pos-pad");
  const pad = document.createElement("section");
  pad.className = "pos-number-pad";
  pad.innerHTML = `<p class="pos-number-pad-title">แป้นตัวเลข</p><button type="button" data-key="7">7</button><button type="button" data-key="8">8</button><button type="button" data-key="9">9</button><button type="button" data-key="4">4</button><button type="button" data-key="5">5</button><button type="button" data-key="6">6</button><button type="button" data-key="1">1</button><button type="button" data-key="2">2</button><button type="button" data-key="3">3</button><button type="button" data-key="0">0</button><button type="button" data-key="00">00</button><button type="button" data-key=".">.</button><button type="button" class="is-action" data-action="exact">รับพอดี</button><button type="button" class="is-danger" data-action="clear">ล้าง</button><button type="button" class="is-action" data-action="back">ลบ</button><button type="button" class="is-primary is-wide" data-action="done">ตกลง</button>`;
  pad.addEventListener("pointerdown", event => event.preventDefault());
  pad.addEventListener("click", event => {
    if (!desktopPadEnabled()) return;
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.key) appendPad(button.dataset.key);
    if (button.dataset.action === "back") { replaceNext = false; setValue(activePadInput, String(activePadInput?.value || "").slice(0, -1)); }
    if (button.dataset.action === "clear") { replaceNext = false; setValue(activePadInput, ""); }
    if (button.dataset.action === "exact") exactAmount();
    if (button.dataset.action === "done") { replaceNext = false; activePadInput?.blur?.(); }
  });
  paymentForm.appendChild(pad);
}

function bindPadInput(input) {
  input?.addEventListener("focus", () => selectAllInput(input));
  input?.addEventListener("click", () => selectAllInput(input));
  input?.addEventListener("pointerdown", () => { if (desktopPadEnabled()) activePadInput = input; });
  input?.addEventListener("keydown", () => { replaceNext = false; });
}

createPad();
bindPadInput(receivedInput);
bindPadInput(document.querySelector("#saleCustomerSearch"));