const TOAST_SELECTOR = ".app-toast, .toast, [data-app-toast], [data-ui-layer='toast']";
const SWEET_SELECTOR = ".sweet-dialog-backdrop, [data-ui-layer='dialog']";
const NATIVE_MODAL_SELECTOR = "dialog[open]";

let scheduled = false;
let enforcing = false;

function visible(element, kind) {
  if (!(element instanceof HTMLElement) || element.hidden) return false;
  if (kind === "toast") return element.classList.contains("show");
  if (kind === "sweet") return element.classList.contains("show");
  return true;
}

function isPopoverOpen(element) {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}

function hidePopover(element) {
  if (!(element instanceof HTMLElement) || typeof element.hidePopover !== "function") return;
  try {
    if (isPopoverOpen(element)) element.hidePopover();
  } catch {}
}

function ensureManualPopover(element) {
  if (!(element instanceof HTMLElement) || typeof element.showPopover !== "function") return false;
  try {
    if (element.parentElement !== document.body) document.body.appendChild(element);
    if (element.getAttribute("popover") !== "manual") element.setAttribute("popover", "manual");
    return true;
  } catch {
    return false;
  }
}

function repromote(element) {
  if (!ensureManualPopover(element)) return;
  try {
    if (isPopoverOpen(element)) element.hidePopover();
    element.showPopover();
  } catch {
    try { element.removeAttribute("popover"); } catch {}
  }
}

function activeElements(selector, kind) {
  return [...document.querySelectorAll(selector)].filter(element => visible(element, kind));
}

function enforceLayerOrder() {
  if (enforcing) return;
  enforcing = true;
  try {
    document.querySelectorAll(SWEET_SELECTOR).forEach(element => {
      if (!visible(element, "sweet")) hidePopover(element);
    });
    document.querySelectorAll(TOAST_SELECTOR).forEach(element => {
      if (!visible(element, "toast")) hidePopover(element);
    });

    /*
     * Browser Top Layer is ordered by promotion time.
     * Native modal is already there. Re-promote Sweet Dialog next, Toast last.
     */
    activeElements(SWEET_SELECTOR, "sweet").forEach(repromote);
    activeElements(TOAST_SELECTOR, "toast").forEach(repromote);
  } finally {
    enforcing = false;
  }
}

function scheduleEnforce() {
  if (scheduled || enforcing) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    enforceLayerOrder();
  });
}

function relevantNode(node) {
  if (!(node instanceof HTMLElement)) return false;
  if (node.matches?.(TOAST_SELECTOR) || node.matches?.(SWEET_SELECTOR) || node.matches?.(NATIVE_MODAL_SELECTOR)) return true;
  return Boolean(node.querySelector?.(`${TOAST_SELECTOR}, ${SWEET_SELECTOR}, dialog[open]`));
}

scheduleEnforce();

new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.type === "attributes") {
      const target = mutation.target;
      if (
        target instanceof HTMLElement
        && (
          target.matches(TOAST_SELECTOR)
          || target.matches(SWEET_SELECTOR)
          || target.matches("dialog")
        )
      ) {
        scheduleEnforce();
        return;
      }
      continue;
    }

    for (const node of mutation.addedNodes) {
      if (relevantNode(node)) {
        scheduleEnforce();
        return;
      }
    }
  }
}).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "hidden", "open"],
});

document.addEventListener("toggle", event => {
  const target = event.target;
  if (target instanceof HTMLElement && (target.matches(TOAST_SELECTOR) || target.matches(SWEET_SELECTOR))) {
    scheduleEnforce();
  }
}, true);

window.__enforceUiLayerOrder = enforceLayerOrder;
