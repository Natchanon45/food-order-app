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

function topNativeModalHost() {
  try {
    const modalDialogs = [...document.querySelectorAll("dialog:modal")];
    if (modalDialogs.length) return modalDialogs.at(-1);
  } catch {}

  // Older Chromium builds may not support :modal reliably. An open native
  // dialog is the conservative fallback; ordinary pages return null.
  const openDialogs = [...document.querySelectorAll("dialog[open]")];
  return openDialogs.at(-1) || null;
}

function ensureManualPopover(element, host) {
  if (!(element instanceof HTMLElement) || typeof element.showPopover !== "function") return false;
  try {
    if (element.parentElement !== host) host.appendChild(element);
    if (element.getAttribute("popover") !== "manual") element.setAttribute("popover", "manual");
    return true;
  } catch {
    return false;
  }
}

function repromote(element) {
  const host = topNativeModalHost();

  // Only overlays that originate as direct children of <body> are portable.
  // React-owned overlays live under #root (or another component host); moving
  // those nodes manually would break React ownership and can leave a full-
  // screen orphan backdrop intercepting every click after unmount.
  if (element.parentElement === document.body) element.dataset.uiLayerPortable = "true";
  const portable = element.dataset.uiLayerPortable === "true";

  // Ordinary Cashier/Kitchen pages need only the z-index policy. Never
  // reparent React-owned nodes and never enter Chromium's Popover Top Layer.
  if (!host) {
    hidePopover(element);
    if (element.hasAttribute("popover")) element.removeAttribute("popover");
    if (portable && element.parentElement !== document.body) document.body.appendChild(element);
    return;
  }

  // A nested React-owned overlay is intentionally left where React rendered
  // it. Body-originating imperative overlays may be moved into a native modal
  // so they can remain above showModal()'s browser Top Layer.
  if (!portable) return;

  const hostChanged = element.parentElement !== host;
  if (hostChanged && isPopoverOpen(element)) hidePopover(element);
  if (!ensureManualPopover(element, host)) return;
  if (isPopoverOpen(element)) return;

  try {
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
     * Native showModal() can remain above a body-level popover in Chromium.
     * Mount overlays inside the topmost native modal first, then promote
     * Sweet Dialog followed by Toast so Toast remains the final UI layer.
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

// Class/open mutations and added nodes already cover every application-owned
// layer transition. Do not listen to the Popover "toggle" event here: that
// event is emitted by showPopover()/hidePopover() themselves and can create a
// self-scheduling browser Top Layer feedback loop.
window.__enforceUiLayerOrder = enforceLayerOrder;
