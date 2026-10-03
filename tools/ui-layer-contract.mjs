import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const css = read("react-app/public/parity/css/ui-layer-stack.css");
const toastCss = read("react-app/public/parity/css/toast-system.css");
const toastPolicy = read("react-app/public/parity/css/toast-global-policy.css");
const sweetCss = read("react-app/public/parity/css/sweet-dialog.css");
const manager = read("react-app/src/ui/toast-top-layer.js");
const index = read("react-app/index.html");
const main = read("react-app/src/main.jsx");
const sync = read("tools/sync-react-parity-assets.py");
const policy = read("docs/UI_LAYER_POLICY.md");

function token(name) {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*(\\d+)`));
  return match ? Number(match[1]) : NaN;
}

const modal = token("ui-layer-modal-z");
const dialog = token("ui-layer-dialog-z");
const toast = token("ui-layer-toast-z");

assert(Number.isFinite(modal) && Number.isFinite(dialog) && Number.isFinite(toast), "UI layer numeric tokens missing");
assert(toast > dialog && dialog > modal, "Required UI layer order must be Toast > Sweet Dialog > Modal");
assert(toastCss.includes("--ui-layer-toast-z"), "Toast CSS must use the global Toast layer token");
assert(toastPolicy.includes("top: 75vh !important;") && toastPolicy.includes("left: 50% !important;") && toastPolicy.includes("translate(-50%, -50%)"), "Global React Toast policy must center Toast at 75vh");
assert(toastPolicy.includes(".success .app-toast-icon") && toastPolicy.includes("color: #22c55e !important;") && toastPolicy.includes(".error .app-toast-icon") && toastPolicy.includes("color: #ef4444 !important;"), "Global React Toast policy must use green success and red error icons");
assert(toastPolicy.includes("bi-check-circle") === false && toastPolicy.includes("bi-x-circle") === false, "Toast icon glyph selection belongs in Toast markup/runtime, not CSS");
assert(sweetCss.includes("--ui-layer-dialog-z"), "Sweet Dialog CSS must use the global dialog layer token");
assert(css.includes('.sweet-dialog-backdrop[popover]') && css.includes('width: 100vw !important;') && css.includes('height: 100dvh !important;') && css.includes('border: 0 !important;') && css.includes('margin: 0 !important;'), "Promoted Sweet Dialog popovers must reset browser UA frame and remain full viewport");
assert(css.includes('.app-toast[popover]') && css.includes('outline: 0 !important;'), "Promoted Toast popovers must reset browser UA frame");
assert(manager.includes("function topNativeModalHost()") && manager.includes('document.querySelectorAll("dialog:modal")'), "Top Layer manager must detect the topmost native modal host");
assert(manager.includes('activeElements(SWEET_SELECTOR, "sweet").forEach(repromote)') && manager.includes('activeElements(TOAST_SELECTOR, "toast").forEach(repromote)'), "Top Layer manager must promote Sweet Dialog before Toast");
assert(
  manager.includes('if (element.parentElement === document.body) element.dataset.uiLayerPortable = "true"')
  && manager.includes('const portable = element.dataset.uiLayerPortable === "true"')
  && manager.includes("if (!portable) return;"),
  "Top Layer manager must never reparent React-owned overlays"
);
assert(
  manager.includes("if (!host) {")
  && manager.includes('element.removeAttribute("popover")')
  && manager.includes("if (portable && element.parentElement !== document.body) document.body.appendChild(element)"),
  "Ordinary pages must avoid Popover and only restore previously portable overlays"
);
assert(
  manager.includes("const hostChanged = element.parentElement !== host")
  && manager.includes("if (hostChanged && isPopoverOpen(element)) hidePopover(element)")
  && manager.includes("if (isPopoverOpen(element)) return;"),
  "Native-dialog promotion must remain idempotent"
);
assert(!manager.includes('document.addEventListener("toggle"'), "Top Layer manager must not self-schedule from Popover toggle events");
assert(manager.includes('attributeFilter: ["class", "hidden", "open"]'), "Top Layer manager must react to native dialog open/close changes");
assert(index.includes("/react/parity/css/ui-layer-stack.css") && index.includes("/react/parity/css/toast-global-policy.css") && main.includes('import "@/ui/toast-top-layer"'), "React must load global layer CSS, Toast presentation policy, and Top Layer manager");
assert(sync.includes('"ui-layer-stack.css"'), "Parity sync must include global layer CSS");
assert(!sync.includes('for name in ["toast-top-layer.js"]'), "Laravel parity sync must never overwrite the React Top Layer runtime manager");
assert(policy.includes("Toast > Sweet Dialog > Modal"), "UI layer policy documentation missing required order");

console.log("UI layer contract: PASS");
console.log(`Toast ${toast} > Dialog ${dialog} > Modal ${modal}`);
