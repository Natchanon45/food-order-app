/*
 * LUKKAJA modal design system: decorate React-owned dialogs only.
 * Never reparent DOM nodes, inject buttons or change form event handlers.
 * SweetAlert is intentionally excluded from this visual design system.
 */
const MODAL_SELECTOR = 'dialog, [role="dialog"][aria-modal="true"]';
const HEADER = [
  ':scope > [class*="dialog-head"]',
  ':scope > [class*="modal-head"]',
  ':scope > header',
  ':scope > .app-modal__header',
  ':scope > .section-title',
  ':scope > .app-dev-head',
].join(",");
const BODY = [
  ':scope > [class*="dialog-body"]',
  ':scope > [class*="modal-body"]',
  ':scope > .app-modal__body',
].join(",");
const FOOTER = [
  ':scope > [class*="dialog-actions"]',
  ':scope > [class*="dialog-footer"]',
  ':scope > [class*="modal-actions"]',
  ':scope > [class*="modal-footer"]',
  ':scope > .payment-actions',
  ':scope > .receipt-actions',
  ':scope > .return-actions',
  ':scope > .app-modal__footer',
  ':scope > .admin-store-settings-actions',
  ':scope > .editor-actions',
  ':scope > .order-actions',
  ':scope > .app-dev-actions',
  ':scope > .quick-payment-result-actions',
  ':scope > footer',
].join(",");

function excluded(node) {
  return Boolean(node.closest(
    '.sweet-dialog-backdrop, .sweet-dialog, .mobile-cart-drawer, [data-ui-layer="dialog"],' +
    ' [data-sweet-alert], .swal2-container, .swal2-popup'
  ));
}

function getFrame(dialog) {
  const children = [...dialog.children].filter(element =>
    element instanceof HTMLElement && element.tagName !== "SCRIPT");
  if (children.length === 1 &&
      children[0].matches("form,div,section,article")) return children[0];
  return dialog;
}

function fallbackHeading(container) {
  if (!container) return null;
  // Older tax/receipt/payment modals place title and explanation in a plain
  // <div> instead of an aptly named .dialog-head. Only mark a compact title
  // block that contains NO form controls, never a form/whole body.
  return [...container.children].slice(0,4).find(child =>
    child.matches("h1,h2,h3") ||
    (child.matches("div,header,section") &&
      child.querySelector("h1,h2,h3") &&
      !child.querySelector("input,textarea,select,form,table,article") &&
      child.querySelectorAll("button").length<=1)) || null;
}

function fallbackFooter(container) {
  if (!container) return null;
  const children=[...container.children];
  const last=children.at(-1);
  if (!last || !last.matches("div,footer,nav")) return null;
  if (last.querySelector("input,textarea,select,form,table,article,section")) return null;
  const buttons=last.querySelectorAll("button");
  return buttons.length>=1 && buttons.length<=4 ? last : null;
}

function identify(dialog) {
  if (!(dialog instanceof HTMLElement) || excluded(dialog)) return;
  if (dialog.dataset.appModal === "standard") return;
  const frame = getFrame(dialog);
  dialog.dataset.appModal = "standard";
  if (frame !== dialog) frame.dataset.appModalFrame = "true";
  // React's original JSX may use an outer header and an inner form.
  const directForm=frame.querySelector(":scope > form");
  const header=frame.querySelector(HEADER) ||
    directForm?.querySelector(HEADER) ||
    fallbackHeading(frame) ||
    fallbackHeading(directForm);
  if (header) header.dataset.appModalHeader = "true";
  const body = frame.querySelector(BODY) || directForm?.querySelector(BODY);
  if (body) body.dataset.appModalBody = "true";
  const footer=frame.querySelector(FOOTER) ||
    directForm?.querySelector(FOOTER) ||
    fallbackFooter(directForm) ||
    fallbackFooter(frame);
  if (footer && footer !== header) footer.dataset.appModalFooter = "true";
  if (!header || !footer) dialog.dataset.appModalStructure = "legacy";
}

function scan() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(MODAL_SELECTOR).forEach(identify);
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    scan();
  });
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  scan();
  const observe = () => {
    if (!document.body) return;
    new MutationObserver(changes => {
      if (changes.some(change =>
        change.type === "childList" ||
        ["open","aria-modal","hidden"].includes(change.attributeName))) schedule();
    }).observe(document.body, {
      childList:true, subtree:true,
      attributes:true, attributeFilter:["open","aria-modal","hidden"]
    });
    schedule();
  };
  if (document.body) observe();
  else document.addEventListener("DOMContentLoaded",observe,{once:true});
}
