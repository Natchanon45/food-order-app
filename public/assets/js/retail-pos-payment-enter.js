const receivedInput = document.querySelector("#receivedInput");
const confirmPaymentBtn = document.querySelector("#confirmPaymentBtn");
const paymentForm = document.querySelector("#paymentDialog .payment-form");
let activePadInput = null;
let replaceNext = false;

receivedInput?.addEventListener("keydown", (event) => {
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
  style.textContent = `#paymentDialog .payment-total{background:linear-gradient(135deg,#eefaf2,#f7fbf8)!important;border:1px solid #cfe8d8!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}#paymentDialog .payment-total span,#paymentDialog .change-row span{font-weight:500!important;color:#0f5132!important}#paymentDialog .payment-total strong{font-weight:500!important;color:#083b1d!important;letter-spacing:0!important}#paymentDialog #receivedInput{font-weight:500!important;color:#102317!important;background:linear-gradient(180deg,#fff,#fbfdfc)!important;border-color:#cfe5d7!important}#paymentDialog .change-row{border-radius:14px;padding:12px 14px!important;background:#fff7ed!important;border:1px solid #fed7aa!important}#paymentDialog .change-row strong{font-weight:500!important;color:#dc2626!important;letter-spacing:0!important}@media(min-width:801px){#paymentDialog:has(.payment-form.has-pos-pad){width:min(860px,calc(100vw - 56px));max-width:860px;padding:0;overflow:hidden}.payment-form.has-pos-pad{width:100%;max-width:none;box-sizing:border-box;display:grid;grid-template-columns:minmax(0,1fr)270px;grid-template-areas:"head head" "total pad" "customer pad" "method pad" "received pad" "change pad" "error error" "actions actions";gap:12px 16px;align-items:start;overflow-x:hidden}.payment-form.has-pos-pad .dialog-head{grid-area:head}.payment-form.has-pos-pad .payment-total{grid-area:total;margin-top:0!important;min-height:84px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-radius:18px;background:linear-gradient(135deg,#eaf7ef,#f5fbf7)!important;border:1px solid #ccebd8!important}.payment-form.has-pos-pad .payment-total span{font-size:14px;font-weight:500!important;color:#1f5131}.payment-form.has-pos-pad .payment-total strong{font-size:30px;font-weight:500!important;color:#062d16;letter-spacing:0!important;white-space:nowrap}.payment-form.has-pos-pad .customer-picker{grid-area:customer;min-width:0}.payment-form.has-pos-pad label:has(#paymentMethod){grid-area:method}.payment-form.has-pos-pad #receivedWrap{grid-area:received}.payment-form.has-pos-pad #receivedInput{text-align:right;font-size:20px;font-weight:500!important}.payment-form.has-pos-pad .change-row{grid-area:change;display:flex;align-items:center;justify-content:space-between;gap:12px}.payment-form.has-pos-pad .change-row span{font-size:14px;font-weight:500!important;color:#7c3d12}.payment-form.has-pos-pad .change-row strong{font-size:22px;font-weight:500!important;color:#dc2626;white-space:nowrap}.payment-form.has-pos-pad #paymentError{grid-area:error}.payment-form.has-pos-pad .dialog-actions{grid-area:actions}.payment-form.has-pos-pad input,.payment-form.has-pos-pad select{min-width:0}.pos-number-pad{grid-area:pad;position:sticky;top:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px;border:1px solid #dfeae3;border-radius:18px;background:linear-gradient(180deg,#f8fcfa,#f1f8f4);z-index:1;min-width:0;align-self:start;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}.pos-number-pad-title{display:none!important}.pos-number-pad button{appearance:none!important;-webkit-appearance:none!important;min-width:0;min-height:46px;border:1px solid #dbe7df;border-radius:13px;background:#fff!important;background-image:none!important;color:#102317;font-family:inherit!important;font-size:18px;font-weight:500!important;line-height:1;touch-action:manipulation;padding:0 8px;display:inline-grid!important;place-items:center!important;text-indent:0!important;white-space:nowrap;box-shadow:0 2px 8px rgba(16,35,23,.04)}.pos-number-pad button::before,.pos-number-pad button::after,.pos-number-pad button i,.pos-number-pad button svg{content:none!important;display:none!important;visibility:hidden!important;width:0!important;height:0!important;margin:0!important}.pos-number-pad button:hover{border-color:#9fd0b3;background:#effaf3!important}.pos-number-pad .is-action{color:#0d6f34;background:#eef8f1!important;font-size:14px;font-weight:500!important}.pos-number-pad .pos-pad-backspace i{display:inline-block!important;visibility:visible!important;width:auto!important;height:auto!important;margin:0!important;font-size:20px;line-height:1}.pos-number-pad .is-danger{color:#b42318;background:#fff3f3!important;border-color:#ffd0d0;font-size:14px;font-weight:500!important}.payment-form.has-pos-pad .customer-search-results{z-index:20;max-width:100%}}@media(max-width:800px){.pos-number-pad{display:none!important}#paymentDialog .payment-total strong{font-size:1.35rem!important}#paymentDialog .change-row strong{font-size:1.12rem!important}#paymentDialog #receivedInput{font-size:1rem!important}}`;
  style.textContent += `@media(max-width:800px){#paymentDialog #receivedInput{text-align:right!important}}`;
  document.head.appendChild(style);
}

function selectionCoversValue(input) {
  try {
    return (
      input.selectionStart === 0 &&
      input.selectionEnd === String(input.value || "").length &&
      input.selectionEnd > input.selectionStart
    );
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
    try {
      input.select();
    } catch {}
  }, 0);
}

function cleanMoney(value = "") {
  let text = String(value || "").replace(/[^0-9.]/g, "");
  const firstDot = text.indexOf(".");
  if (firstDot >= 0) {
    text =
      text.slice(0, firstDot + 1) +
      text
        .slice(firstDot + 1)
        .replace(/\./g, "")
        .slice(0, 2);
  }
  return text;
}

function setValue(input, value) {
  if (!input) return;
  const phoneMode = input.id === "saleCustomerSearch";
  input.value = phoneMode
    ? String(value || "")
        .replace(/\D/g, "")
        .slice(0, 10)
    : cleanMoney(value);
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
  setValue(
    receivedInput,
    (document.querySelector("#paymentTotal")?.textContent || "").replace(
      /[^0-9.]/g,
      "",
    ),
  );
}

function createPad() {
  if (!paymentForm || paymentForm.querySelector(".pos-number-pad")) return;
  addPadStyle();
  paymentForm.classList.add("has-pos-pad");
  const pad = document.createElement("section");
  pad.className = "pos-number-pad";
  pad.innerHTML = `<p class="pos-number-pad-title">แป้นตัวเลข</p><button type="button" data-key="7">7</button><button type="button" data-key="8">8</button><button type="button" data-key="9">9</button><button type="button" data-key="4">4</button><button type="button" data-key="5">5</button><button type="button" data-key="6">6</button><button type="button" data-key="1">1</button><button type="button" data-key="2">2</button><button type="button" data-key="3">3</button><button type="button" data-key="0">0</button><button type="button" data-key="00">00</button><button type="button" data-key=".">.</button><button type="button" class="is-action" data-action="exact">รับพอดี</button><button type="button" class="is-danger" data-action="clear">ล้าง</button><button type="button" class="is-action pos-pad-backspace" data-action="back" aria-label="ลบตัวเลขล่าสุด" title="ลบตัวเลขล่าสุด"><i class="bi bi-backspace" aria-hidden="true"></i></button>`;
  pad.addEventListener("pointerdown", (event) => event.preventDefault());
  pad.addEventListener("click", (event) => {
    if (!desktopPadEnabled()) return;
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.key) appendPad(button.dataset.key);
    if (button.dataset.action === "back") {
      replaceNext = false;
      setValue(
        activePadInput,
        String(activePadInput?.value || "").slice(0, -1),
      );
    }
    if (button.dataset.action === "clear") {
      replaceNext = false;
      setValue(activePadInput, "");
    }
    if (button.dataset.action === "exact") exactAmount();
  });
  paymentForm.appendChild(pad);
}

function bindPadInput(input) {
  input?.addEventListener("focus", () => selectAllInput(input));
  input?.addEventListener("click", () => selectAllInput(input));
  input?.addEventListener("pointerdown", () => {
    if (desktopPadEnabled()) activePadInput = input;
  });
  input?.addEventListener("keydown", () => {
    replaceNext = false;
  });
}

createPad();
bindPadInput(receivedInput);
bindPadInput(document.querySelector("#saleCustomerSearch"));
