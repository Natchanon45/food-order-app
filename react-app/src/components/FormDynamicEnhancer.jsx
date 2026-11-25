import { useEffect } from "react";

// Safe, non-structural enhancement for legacy React forms. This decorates
// existing native inputs/selects/textareas without replacing/moving them, so
// their React state, validation handlers, and label associations stay intact.
// Complex controls are deliberately excluded and must be migrated individually.
const ELIGIBLE_TYPES = new Set(["text", "email", "password", "tel", "url", "number", "search"]);
const SKIPPED_CONTAINERS = [
  ".lk-dynamic-field", "[data-lk-no-dynamic]", "[data-lk-auto-field]",
  ".category-combobox", "[role='combobox']", "[role='gridcell']",
  ".delivery-fee-row", ".pos-catalog-search",
  ".staff-search", ".input-group", ".input-with-action",
].join(",");

function simpleTitle(label, control) {
  const preceding = [...label.childNodes].slice(0, [...label.childNodes].indexOf(control));
  const tokens = preceding.filter(node => node.nodeType !== Node.TEXT_NODE || node.textContent.trim());
  if (tokens.length !== 1) return null;
  const node = tokens[0];
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.replace(/\s+/g, " ").trim();
    return text && !/[\n\r]/.test(text) ? { text, titleElement: null } : null;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || node.tagName !== "SPAN") return null;
  if (node.querySelector("i,svg,button,input,select,textarea,strong,small")) return null;
  const text = node.textContent.replace(/\s+/g, " ").trim();
  return text ? { text, titleElement: node } : null;
}

function candidate(control) {
  if (!control || !control.isConnected || !control.matches("input,select,textarea")) return null;
  if (control.tagName === "INPUT" && !ELIGIBLE_TYPES.has(control.type || "text")) return null;
  if (control.multiple || control.closest(SKIPPED_CONTAINERS) || control.getAttribute("aria-hidden") === "true") return null;
  const parent = control.parentElement;
  if (!parent || parent.matches("table,td,th,[role='row'],[role='cell']")) return null;
  // Inline labels have no stable containing box for the caption. Do not
  // silently alter their display/layout (e.g. compact POS table rows).
  if (getComputedStyle(parent).display === "inline") return null;
  if (parent.tagName === "LABEL") {
    if (parent.querySelectorAll("input,select,textarea").length !== 1) return null;
    const info = simpleTitle(parent, control);
    if (!info) return null;
    // A help message after the control may remain. Avoid mixed, interactive or
    // icon-bearing labels that have a page-specific structure.
    const post = [...parent.childNodes].slice([...parent.childNodes].indexOf(control) + 1);
    if (post.some(n => n.nodeType === Node.ELEMENT_NODE &&
      (n.matches("button,a,svg") || n.querySelector("button,a,input,select,textarea")))) return null;
    if (parent.matches(".terms-box,.business-option,.cycle-option,.toggle,.switch")) return null;
    return { field: parent, info, mode: "wrapping-label" };
  }
  if (!parent.matches(".field,.form-field,.form-group,.settings-field,.staff-user-field")) return null;
  if (parent.querySelectorAll("input,select,textarea").length !== 1) return null;
  const label = [...parent.children].find(el => el.tagName === "LABEL" &&
    (!el.htmlFor || el.htmlFor === control.id));
  if (!label || label.querySelector("input,select,textarea,button,a,svg")) return null;
  const text = label.textContent.replace(/\s+/g, " ").trim();
  if (!text || text.length > 80) return null;
  return { field: parent, info: { text, titleElement: label }, mode: "sibling-label" };
}

export function enhanceFormField(control) {
  const match = candidate(control);
  if (!match || match.info.text.length > 80) return false;
  const { field, info, mode } = match;
  const rect = control.getBoundingClientRect();
  const font = getComputedStyle(control).fontSize;
  if (rect.height < 34 || rect.width < 65) return false;
  field.dataset.lkAutoField = mode;
  field.dataset.lkCaption = info.text;
  field.dataset.lkFilled = String(Boolean(control.value && String(control.value).length));
  field.style.setProperty("--lk-auto-native-font", font);
  if (info.titleElement) info.titleElement.dataset.lkAutoTitle = "";
  const measure = () => {
    if (!field.isConnected || !control.isConnected) return;
    const f = field.getBoundingClientRect();
    const c = control.getBoundingClientRect();
    field.style.setProperty("--lk-auto-top", Math.round(c.top - f.top) + "px");
    field.style.setProperty("--lk-auto-left", Math.round(c.left - f.left) + "px");
    field.style.setProperty("--lk-auto-height", Math.round(c.height) + "px");
    field.style.setProperty("--lk-auto-width", Math.round(c.width) + "px");
  };
  measure();
  requestAnimationFrame(measure);
  return true;
}

export function FormDynamicEnhancer() {
  useEffect(() => {
    const enhanceTree = root => {
      if (!root || root.nodeType !== 1) return;
      if (root.matches("input,select,textarea")) enhanceFormField(root);
      root.querySelectorAll?.("input,select,textarea").forEach(enhanceFormField);
    };
    enhanceTree(document.body);

    let pending = new Set();
    let scheduled = false;
    const refreshAll = () => {
      document.querySelectorAll("[data-lk-auto-field]").forEach(field => {
        const input = field.querySelector("input,select,textarea");
        if (!input) return;
        field.dataset.lkFilled = String(Boolean(input.value && String(input.value).length));
        const title = field.dataset.lkAutoField === "wrapping-label"
          ? simpleTitle(field, input)?.text
          : field.querySelector("label[data-lk-auto-title]")?.textContent.replace(/\s+/g, " ").trim();
        if (title && title.length <= 80 && field.dataset.lkCaption !== title) {
          field.dataset.lkCaption = title;
        }
      });
    };
    const drain = () => {
      scheduled = false;
      const nodes = pending;
      pending = new Set();
      nodes.forEach(enhanceTree);
      refreshAll();
    };
    const observer = new MutationObserver(mutations => {
      let needsRefresh = false;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") needsRefresh = true;
        for (const node of mutation.addedNodes) if (node.nodeType === 1) pending.add(node);
      }
      if ((pending.size || needsRefresh) && !scheduled) {
        scheduled = true;
        requestAnimationFrame(drain);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    const update = event => {
      const control = event.target;
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement ||
            control instanceof HTMLTextAreaElement)) return;
      const field = control.closest("[data-lk-auto-field]");
      if (field) field.dataset.lkFilled = String(Boolean(control.value && String(control.value).length));
    };
    const remeasure = () => {
      document.querySelectorAll("[data-lk-auto-field]").forEach(field => {
        const el = field.querySelector("input,select,textarea");
        if (!el) return;
        const f = field.getBoundingClientRect(), c = el.getBoundingClientRect();
        field.style.setProperty("--lk-auto-top", Math.round(c.top - f.top) + "px");
        field.style.setProperty("--lk-auto-left", Math.round(c.left - f.left) + "px");
        field.style.setProperty("--lk-auto-height", Math.round(c.height) + "px");
        field.style.setProperty("--lk-auto-width", Math.round(c.width) + "px");
      });
    };
    document.addEventListener("input", update, true);
    document.addEventListener("change", update, true);
    window.addEventListener("resize", remeasure);
    return () => {
      observer.disconnect();
      document.removeEventListener("input", update, true);
      document.removeEventListener("change", update, true);
      window.removeEventListener("resize", remeasure);
    };
  }, []);
  return null;
}
