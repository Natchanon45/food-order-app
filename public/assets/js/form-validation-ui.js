const STYLE_ID = "bootstrapFormValidationUiStyles";
const BOUND_KEY = "bootstrapValidationUiBound";
const FORM_BOUND_KEY = "bootstrapValidationFormBound";
const CONTROL_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  "select",
  "textarea"
].join(",");
const SKIP_SELECTOR = [
  "[data-skip-validation-ui]",
  "[data-no-validation-ui]",
  ".receipt",
  ".receipt-paper",
  ".receipt-preview",
  ".tax-paper",
  ".tax-invoice-page",
  ".print-document",
  ".print-page",
  ".document-page",
  ".qr-ticket"
].join(",");

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root{--bs-form-valid:#198754;--bs-form-valid-bg:#f4fbf7;--bs-form-invalid:#dc3545;--bs-form-invalid-bg:#fff5f6;--bs-form-neutral:#d8e2dc}
    input.is-valid,select.is-valid,textarea.is-valid,.input.is-valid,.form-control.is-valid,.form-select.is-valid{border-color:var(--bs-form-valid)!important;background-color:var(--bs-form-valid-bg)!important;box-shadow:0 0 0 .18rem rgba(25,135,84,.12)!important}
    input.is-invalid,select.is-invalid,textarea.is-invalid,.input.is-invalid,.form-control.is-invalid,.form-select.is-invalid{border-color:var(--bs-form-invalid)!important;background-color:var(--bs-form-invalid-bg)!important;box-shadow:0 0 0 .18rem rgba(220,53,69,.12)!important}
    input.is-valid:focus,select.is-valid:focus,textarea.is-valid:focus,.input.is-valid:focus,.form-control.is-valid:focus,.form-select.is-valid:focus{border-color:var(--bs-form-valid)!important;box-shadow:0 0 0 .24rem rgba(25,135,84,.18)!important}
    input.is-invalid:focus,select.is-invalid:focus,textarea.is-invalid:focus,.input.is-invalid:focus,.form-control.is-invalid:focus,.form-select.is-invalid:focus{border-color:var(--bs-form-invalid)!important;box-shadow:0 0 0 .24rem rgba(220,53,69,.18)!important}
    input[type="checkbox"].is-valid,input[type="radio"].is-valid{accent-color:var(--bs-form-valid);box-shadow:0 0 0 .16rem rgba(25,135,84,.12)!important}
    input[type="checkbox"].is-invalid,input[type="radio"].is-invalid{accent-color:var(--bs-form-invalid);box-shadow:0 0 0 .16rem rgba(220,53,69,.12)!important}
    label:has(> input.is-valid),label:has(> select.is-valid),label:has(> textarea.is-valid){color:#0f5132}
    label:has(> input.is-invalid),label:has(> select.is-invalid),label:has(> textarea.is-invalid){color:#842029}
    .was-validated input:invalid,.was-validated select:invalid,.was-validated textarea:invalid{border-color:var(--bs-form-invalid)!important;background-color:var(--bs-form-invalid-bg)!important}
  `;
  document.head.appendChild(style);
}

function isControl(node) {
  return node?.matches?.(CONTROL_SELECTOR);
}

function isSkippable(control) {
  if (!control || control.closest(SKIP_SELECTOR)) return true;
  if (control.disabled || control.readOnly) return true;
  if (control.type === "file") return true;
  return false;
}

function hasValue(control) {
  if (control.type === "checkbox" || control.type === "radio") return control.checked;
  return String(control.value ?? "").trim().length > 0;
}

function shouldShowValidation(control, force = false) {
  if (force) return true;
  if (control.dataset.validationTouched === "1") return true;
  return control.closest("form")?.classList.contains("was-validated") || false;
}

function shouldValidate(control) {
  if (control.required) return true;
  return hasValue(control);
}

function clearState(control) {
  control.classList.remove("is-valid", "is-invalid");
}

function updateControl(control, options = {}) {
  if (!isControl(control) || isSkippable(control)) return;
  const force = Boolean(options.force);
  clearState(control);
  if (!shouldShowValidation(control, force)) return;
  if (!shouldValidate(control)) return;
  if (control.checkValidity()) control.classList.add("is-valid");
  else control.classList.add("is-invalid");
}

function markTouched(control) {
  if (!isSkippable(control)) control.dataset.validationTouched = "1";
}

function bindControl(control) {
  if (!isControl(control) || isSkippable(control) || control.dataset[BOUND_KEY] === "1") return;
  control.dataset[BOUND_KEY] = "1";
  control.addEventListener("input", () => {
    markTouched(control);
    updateControl(control);
  });
  control.addEventListener("change", () => {
    markTouched(control);
    updateControl(control);
  });
  control.addEventListener("blur", () => {
    markTouched(control);
    updateControl(control);
  });
  updateControl(control);
}

function shouldSkipSubmitValidation(event) {
  const submitter = event.submitter;
  if (!submitter) return false;
  if (submitter.formNoValidate || submitter.dataset.skipValidation === "true") return true;
  const value = String(submitter.value || "").trim().toLowerCase();
  const label = String(submitter.textContent || "").trim();
  return value === "cancel" || /^(ยกเลิก|ปิด|ไม่ยกเลิก)$/i.test(label);
}

function bindForm(form) {
  if (!form || form.dataset[FORM_BOUND_KEY] === "1" || form.closest(SKIP_SELECTOR)) return;
  form.dataset[FORM_BOUND_KEY] = "1";
  form.addEventListener("submit", event => {
    if (shouldSkipSubmitValidation(event)) return;
    form.classList.add("was-validated");
    const controls = [...form.querySelectorAll(CONTROL_SELECTOR)].filter(control => !isSkippable(control));
    controls.forEach(control => {
      markTouched(control);
      updateControl(control, { force: true });
    });
    if (!form.checkValidity()) {
      event.preventDefault();
      event.stopPropagation();
      controls.find(control => !control.checkValidity())?.focus?.({ preventScroll: false });
    }
  }, true);
}

function scan(root = document) {
  ensureStyles();
  if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;
  const scope = root === document ? document : root;
  if (isControl(scope)) bindControl(scope);
  scope.querySelectorAll?.(CONTROL_SELECTOR).forEach(bindControl);
  if (scope.matches?.("form")) bindForm(scope);
  scope.querySelectorAll?.("form").forEach(bindForm);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => scan(), { once: true });
} else {
  scan();
}

new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) scan(node);
    });
  }
}).observe(document.documentElement, { childList: true, subtree: true });
