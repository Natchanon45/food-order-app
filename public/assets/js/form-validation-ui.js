const STYLE_ID = "bootstrapFormValidationUiStyles";
const BOUND_KEY = "bootstrapValidationUiBound";
const FORM_BOUND_KEY = "bootstrapValidationFormBound";
const CONTROL_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  "select",
  "textarea"
].join(",");
const SKIP_SELECTOR = [
  "#registerForm",
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
const FEEDBACK_CLASS = "bootstrap-invalid-feedback";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root{--bs-form-invalid:#dc3545}
    .${FEEDBACK_CLASS}{display:none;width:100%;margin:6px 0 0;color:var(--bs-form-invalid)!important;font-size:12px;font-weight:500;line-height:1.35}
    .${FEEDBACK_CLASS}.show{display:block}
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
  delete control.dataset.validationState;
}

function validationMessage(control) {
  const validity = control.validity;
  if (!validity) return "กรุณาตรวจสอบข้อมูลในช่องนี้";
  if (validity.valueMissing) return "กรุณากรอกข้อมูลในช่องนี้";
  if (validity.typeMismatch) {
    if (control.type === "email") return "กรุณากรอกอีเมลให้ถูกต้อง";
    if (control.type === "url") return "กรุณากรอก URL ให้ถูกต้อง";
    return "รูปแบบข้อมูลไม่ถูกต้อง";
  }
  if (validity.tooShort) return `กรุณากรอกอย่างน้อย ${control.minLength} ตัวอักษร`;
  if (validity.tooLong) return `กรุณากรอกไม่เกิน ${control.maxLength} ตัวอักษร`;
  if (validity.rangeUnderflow) return `กรุณากรอกค่าตั้งแต่ ${control.min} ขึ้นไป`;
  if (validity.rangeOverflow) return `กรุณากรอกค่าไม่เกิน ${control.max}`;
  if (validity.stepMismatch) return "กรุณากรอกตัวเลขตามรูปแบบที่กำหนด";
  if (validity.patternMismatch) return control.title || "รูปแบบข้อมูลไม่ถูกต้อง";
  if (validity.badInput) return "กรุณากรอกข้อมูลให้ถูกต้อง";
  return "กรุณาตรวจสอบข้อมูลในช่องนี้";
}

function feedbackHost(control) {
  if (control.closest("#registerForm")) return null;
  if (control.type === "checkbox" || control.type === "radio") {
    return control.closest("label") || control.parentElement;
  }
  return control.closest("label") || control.parentElement;
}

function feedbackForControl(control) {
  const host = feedbackHost(control);
  if (!host) return null;
  let feedback = control.dataset.validationFeedbackId
    ? document.getElementById(control.dataset.validationFeedbackId)
    : null;
  if (feedback) return feedback;
  feedback = document.createElement("div");
  feedback.className = FEEDBACK_CLASS;
  feedback.id = `validation-feedback-${Math.random().toString(36).slice(2, 10)}`;
  feedback.setAttribute("role", "alert");
  feedback.setAttribute("aria-live", "polite");
  control.insertAdjacentElement("afterend", feedback);
  control.dataset.validationFeedbackId = feedback.id;
  const describedBy = new Set(String(control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  describedBy.add(feedback.id);
  control.setAttribute("aria-describedby", [...describedBy].join(" "));
  return feedback;
}

function setFeedback(control, message = "") {
  const feedback = feedbackForControl(control);
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle("show", Boolean(message));
}

function updateControl(control, options = {}) {
  if (!isControl(control) || isSkippable(control)) return;
  const force = Boolean(options.force);
  clearState(control);
  setFeedback(control);
  if (!shouldShowValidation(control, force)) return;
  if (!shouldValidate(control)) return;
  if (control.checkValidity()) control.dataset.validationState = "valid";
  else {
    control.dataset.validationState = "invalid";
    setFeedback(control, validationMessage(control));
  }
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
  form.noValidate = true;
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
