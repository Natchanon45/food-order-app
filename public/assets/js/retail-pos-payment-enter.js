const receivedInput = document.querySelector("#receivedInput");
const confirmPaymentBtn = document.querySelector("#confirmPaymentBtn");
const paymentForm = document.querySelector("#paymentDialog .payment-form");
let activePadInput = null;

receivedInput?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();

  if (!confirmPaymentBtn || confirmPaymentBtn.disabled) return;
  confirmPaymentBtn.click();
});

function desktopPadEnabled() {
  return window.matchMedia("(min-width: 801px)").matches;
}

function addPadStyle() {
  if (document.querySelector("#posDesktopPadStyle")) return;
  const style = document.createElement("style");
  style.id = "posDesktopPadStyle";
  style.textContent = `@media(min-width:801px){.payment-form.has-pos-pad{width:min(880px,calc(100vw - 48px));display:grid;grid-template-columns:minmax(0,1fr)260px;grid-template-areas:"head head" "total pad" "customer pad" "method pad" "received pad" "change pad" "error error" "actions actions";gap:12px 16px;align-items:start}.payment-form.has-pos-pad .dialog-head{grid-area:head}.payment-form.has-pos-pad .payment-total{grid-area:total}.payment-form.has-pos-pad .customer-picker{grid-area:customer}.payment-form.has-pos-pad label:has(#paymentMethod){grid-area:method}.payment-form.has-pos-pad #receivedWrap{grid-area:received}.payment-form.has-pos-pad .change-row{grid-area:change}.payment-form.has-pos-pad #paymentError{grid-area:error}.payment-form.has-pos-pad .dialog-actions{grid-area:actions}.pos-number-pad{grid-area:pad;position:sticky;top:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px;border:1px solid #dfeae3;border-radius:18px;background:#f8fcfa;z-index:1}.pos-number-pad-title{grid-column:1/-1;margin:0 0 2px;color:#526259;font-size:12px;font-weight:900}.pos-number-pad button{min-height:48px;border:1px solid #dbe7df;border-radius:14px;background:#fff;color:#102317;font-size:18px;font-weight:900;touch-action:manipulation}.pos-number-pad button::before,.pos-number-pad button::after{content:none!important;display:none!important}.pos-number-pad button:hover{border-color:#9fd0b3;background:#effaf3}.pos-number-pad .is-action{color:#0d6f34;background:#eef8f1}.pos-number-pad .is-danger{color:#b42318;background:#fff3f3;border-color:#ffd0d0}.pos-number-pad .is-wide{grid-column:span 2}.pos-number-pad .is-primary{color:#fff;background:#159447;border-color:#159447}.payment-form.has-pos-pad .customer-search-results{z-index:20}}@media(max-width:800px){.pos-number-pad{display:none!important}}`;
  document.head.appendChild(style);
}

function setValue(input, value) {
  if (!input) return;
  const phoneMode = input.id === "saleCustomerSearch";
  input.value = phoneMode ? String(value || "").replace(/\D/g, "").slice(0, 10) : String(value || "").replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.focus({ preventScroll: true });
}

function appendPad(value) {
  if (!activePadInput) return;
  if (activePadInput.id === "saleCustomerSearch" && (value === "." || value === "00")) return;
  if (activePadInput.id === "receivedInput" && value === "." && activePadInput.value.includes(".")) return;
  setValue(activePadInput, `${activePadInput.value || ""}${value}`);
}

function exactAmount() {
  if (activePadInput !== receivedInput) return;
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
    if (button.dataset.action === "back") setValue(activePadInput, String(activePadInput?.value || "").slice(0, -1));
    if (button.dataset.action === "clear") setValue(activePadInput, "");
    if (button.dataset.action === "exact") exactAmount();
    if (button.dataset.action === "done") activePadInput?.blur?.();
  });
  paymentForm.appendChild(pad);
}

function bindPadInput(input) {
  input?.addEventListener("focus", () => { if (desktopPadEnabled()) activePadInput = input; });
  input?.addEventListener("pointerdown", () => { if (desktopPadEnabled()) activePadInput = input; });
}

createPad();
bindPadInput(receivedInput);
bindPadInput(document.querySelector("#saleCustomerSearch"));