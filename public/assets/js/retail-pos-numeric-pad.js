const mq = window.matchMedia('(min-width: 801px)');
const paymentForm = document.querySelector('#paymentDialog .payment-form');
const receivedInput = document.querySelector('#receivedInput');
const customerInput = document.querySelector('#saleCustomerSearch');
const confirmPaymentBtn = document.querySelector('#confirmPaymentBtn');

let activeInput = null;

function isEnabled() {
  return mq.matches;
}

function normalizeMoney(value = '') {
  const cleaned = String(value || '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}` : parts[0];
}

function normalizePhone(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function modeFor(input) {
  if (!input) return 'money';
  if (input.id === 'saleCustomerSearch') return 'phone';
  return 'money';
}

function inputValue(input) {
  if (!input) return '';
  return String(input.value || '');
}

function setInputValue(input, value) {
  if (!input) return;
  const mode = modeFor(input);
  input.value = mode === 'phone' ? normalizePhone(value) : normalizeMoney(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.focus({ preventScroll: true });
}

function appendValue(value) {
  if (!activeInput) return;
  const mode = modeFor(activeInput);
  if (mode === 'phone' && value === '.') return;
  if (mode === 'phone' && value === '00') return;
  const current = inputValue(activeInput);
  if (mode === 'money' && value === '.' && current.includes('.')) return;
  setInputValue(activeInput, current + value);
}

function backspace() {
  if (!activeInput) return;
  setInputValue(activeInput, inputValue(activeInput).slice(0, -1));
}

function clearValue() {
  if (!activeInput) return;
  setInputValue(activeInput, '');
}

function exactAmount() {
  const totalText = document.querySelector('#paymentTotal')?.textContent || '';
  const amount = totalText.replace(/[^0-9.]/g, '');
  if (activeInput === receivedInput) setInputValue(receivedInput, amount);
}

function done() {
  activeInput?.blur?.();
  if (activeInput === receivedInput) confirmPaymentBtn?.focus?.();
}

function createPad() {
  if (!paymentForm || paymentForm.querySelector('.pos-number-pad')) return;
  paymentForm.classList.add('has-pos-pad');
  const pad = document.createElement('section');
  pad.className = 'pos-number-pad';
  pad.setAttribute('aria-label', 'แป้นตัวเลข POS');
  pad.innerHTML = `
    <p class="pos-number-pad-title">แป้นตัวเลข</p>
    <button type="button" data-key="7">7</button>
    <button type="button" data-key="8">8</button>
    <button type="button" data-key="9">9</button>
    <button type="button" data-key="4">4</button>
    <button type="button" data-key="5">5</button>
    <button type="button" data-key="6">6</button>
    <button type="button" data-key="1">1</button>
    <button type="button" data-key="2">2</button>
    <button type="button" data-key="3">3</button>
    <button type="button" data-key="0">0</button>
    <button type="button" data-key="00">00</button>
    <button type="button" data-key=".">.</button>
    <button type="button" class="is-action" data-action="exact">รับพอดี</button>
    <button type="button" class="is-danger" data-action="clear">ล้าง</button>
    <button type="button" class="is-action" data-action="back">ลบ</button>
    <button type="button" class="is-primary is-wide" data-action="done">ตกลง</button>
  `;
  pad.addEventListener('pointerdown', event => event.preventDefault());
  pad.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !isEnabled()) return;
    const key = button.dataset.key;
    const action = button.dataset.action;
    if (key) appendValue(key);
    if (action === 'back') backspace();
    if (action === 'clear') clearValue();
    if (action === 'exact') exactAmount();
    if (action === 'done') done();
  });
  paymentForm.insertBefore(pad, paymentForm.querySelector('.dialog-actions'));
}

function bindInput(input) {
  input?.addEventListener('focus', () => {
    if (!isEnabled()) return;
    activeInput = input;
  });
  input?.addEventListener('pointerdown', () => {
    if (!isEnabled()) return;
    activeInput = input;
  });
}

createPad();
bindInput(receivedInput);
bindInput(customerInput);
receivedInput?.setAttribute('data-numeric-pad', 'money');
customerInput?.setAttribute('data-numeric-pad', 'phone');

mq.addEventListener?.('change', () => {
  if (!isEnabled()) activeInput = null;
});