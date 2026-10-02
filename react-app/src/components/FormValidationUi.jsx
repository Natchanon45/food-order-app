import { useEffect } from "react";
import { useI18n } from "@/i18n/I18nProvider";

const STYLE_ID = "bootstrapFormValidationUiStyles";
const BOUND_KEY = "bootstrapValidationUiBound";
const FORM_BOUND_KEY = "bootstrapValidationFormBound";
const CONTROL_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
  "select",
  "textarea",
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
  ".qr-ticket",
].join(",");
const FEEDBACK_CLASS = "bootstrap-invalid-feedback";
const FEEDBACK_HOST_SELECTOR = [
  "[data-validation-feedback-host]",
  ".barcode-input-group",
  ".tax-id-control",
  ".loyalty-controls",
  ".payment-customer-control",
  ".input-with-action",
  ".input-action",
  ".login-input-wrap",
  ".field-control",
].join(",");

let translate = (key, vars) => key;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root{--bs-form-invalid:#dc2626;--bs-form-valid:#15803d}
    :where(input,select,textarea)[data-validation-state]{box-sizing:border-box!important;transition:border-color .16s ease,box-shadow .16s ease,background-color .16s ease}
    :where(input,select,textarea)[data-validation-state="invalid"]{border-color:var(--bs-form-invalid)!important;background-color:#fff7f7!important;box-shadow:0 0 0 3px rgba(220,38,38,.12)!important}
    :where(input,select,textarea)[data-validation-state="valid"]{border-color:var(--bs-form-valid)!important;background-color:#f4fcf6!important;box-shadow:0 0 0 3px rgba(21,128,61,.1)!important}
    :where(input,select,textarea)[data-validation-state]:focus{outline:0!important}
    .${FEEDBACK_CLASS}{display:none;width:100%;min-height:16px;margin:6px 0 0;color:var(--bs-form-invalid)!important;font-size:12px;font-weight:500;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
  if (!validity) return translate("shared.validation.check_field");
  if (validity.valueMissing) return translate("shared.validation.required");
  if (validity.typeMismatch) {
    if (control.type === "email") return translate("shared.validation.email");
    if (control.type === "url") return translate("shared.validation.url");
    return translate("shared.validation.invalid_format");
  }
  if (validity.tooShort) return translate("shared.validation.min_length", { min: control.minLength });
  if (validity.tooLong) return translate("shared.validation.max_length", { max: control.maxLength });
  if (validity.rangeUnderflow) return translate("shared.validation.min_value", { min: control.min });
  if (validity.rangeOverflow) return translate("shared.validation.max_value", { max: control.max });
  if (validity.stepMismatch) return translate("shared.validation.step");
  if (validity.patternMismatch) return control.title || translate("shared.validation.invalid_format");
  if (validity.badInput) return translate("shared.validation.bad_input");
  return translate("shared.validation.check_field");
}
function feedbackHost(control) {
  if (control.closest("#registerForm")) return null;
  if (control.type === "checkbox" || control.type === "radio") return control.closest("label") || control.parentElement;
  return control.closest("label") || control.parentElement;
}
function feedbackInsertionTarget(control) {
  if (control.type === "checkbox" || control.type === "radio") return feedbackHost(control);
  return control.closest(FEEDBACK_HOST_SELECTOR) || control;
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
  feedbackInsertionTarget(control)?.insertAdjacentElement("afterend", feedback);
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
function updateControl(control, { force = false } = {}) {
  if (!isControl(control) || isSkippable(control)) return;
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
  const refresh = () => {
    markTouched(control);
    updateControl(control);
  };
  control.addEventListener("input", refresh);
  control.addEventListener("change", refresh);
  control.addEventListener("blur", refresh);
  updateControl(control);
}
function shouldSkipSubmitValidation(event) {
  const submitter = event.submitter;
  if (!submitter) return false;
  if (submitter.formNoValidate || submitter.dataset.skipValidation === "true") return true;
  const value = String(submitter.value || "").trim().toLowerCase();
  const label = String(submitter.textContent || "").trim();
  const cancelLabels = [
    translate("shared.actions.cancel"),
    translate("shared.actions.close"),
    "ยกเลิก",
    "ปิด",
    "ไม่ยกเลิก",
    "cancel",
    "close",
  ].filter(Boolean);
  return value === "cancel"
    || cancelLabels.some(candidate => label.toLocaleLowerCase() === String(candidate).toLocaleLowerCase());
}
function validateForm(form) {
  form.classList.add("was-validated");
  const controls = [...form.querySelectorAll(CONTROL_SELECTOR)].filter(control => !isSkippable(control));
  controls.forEach(control => {
    markTouched(control);
    updateControl(control, { force: true });
  });
  const firstInvalid = controls.find(control => !control.checkValidity());
  if (firstInvalid) {
    firstInvalid.focus?.({ preventScroll: false });
    return false;
  }
  return true;
}
function bindForm(form) {
  if (!form || form.dataset[FORM_BOUND_KEY] === "1" || form.closest(SKIP_SELECTOR)) return;
  form.dataset[FORM_BOUND_KEY] = "1";
  form.noValidate = true;
  form.addEventListener("submit", event => {
    if (shouldSkipSubmitValidation(event)) return;
    if (!validateForm(form)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  form.addEventListener("reset", () => window.setTimeout(() => resetFormValidationUi(form), 0));
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

function containsValidationTarget(node) {
  if (!(node instanceof Element)) return false;
  return isControl(node)
    || node.matches?.("form")
    || Boolean(node.querySelector?.(CONTROL_SELECTOR))
    || Boolean(node.querySelector?.("form"));
}

export function resetFormValidationUi(form) {
  if (!form) return;
  form.classList.remove("was-validated");
  form.querySelectorAll?.(CONTROL_SELECTOR).forEach(control => {
    delete control.dataset.validationTouched;
    clearState(control);
    setFeedback(control);
  });
  form.querySelectorAll?.(`.${FEEDBACK_CLASS}`).forEach(feedback => {
    feedback.textContent = "";
    feedback.classList.remove("show");
  });
}

export function FormValidationUi() {
  const { t, locale } = useI18n();
  translate = t;

  useEffect(() => {
    translate = t;
    scan(document);
    document.querySelectorAll("form.was-validated").forEach(form => {
      form.querySelectorAll(CONTROL_SELECTOR).forEach(control => updateControl(control, { force: true }));
    });
  }, [t, locale]);

  useEffect(() => {
    scan(document);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (containsValidationTarget(node)) scan(node);
        });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
