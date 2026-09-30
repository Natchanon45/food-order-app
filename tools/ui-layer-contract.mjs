import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const css = read("react-app/public/parity/css/ui-layer-stack.css");
const toastCss = read("react-app/public/parity/css/toast-system.css");
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
assert(sweetCss.includes("--ui-layer-dialog-z"), "Sweet Dialog CSS must use the global dialog layer token");
assert(css.includes('.sweet-dialog-backdrop[popover]') && css.includes('width: 100vw !important;') && css.includes('height: 100dvh !important;') && css.includes('border: 0 !important;') && css.includes('margin: 0 !important;'), "Promoted Sweet Dialog popovers must reset browser UA frame and remain full viewport");
assert(css.includes('.app-toast[popover]') && css.includes('outline: 0 !important;'), "Promoted Toast popovers must reset browser UA frame");
assert(manager.includes("function topModalHost()") && manager.includes('document.querySelectorAll("dialog:modal")'), "Top Layer manager must detect the topmost native modal host");
assert(manager.includes('activeElements(SWEET_SELECTOR, "sweet").forEach(repromote)') && manager.includes('activeElements(TOAST_SELECTOR, "toast").forEach(repromote)'), "Top Layer manager must promote Sweet Dialog before Toast");
assert(manager.includes('attributeFilter: ["class", "hidden", "open"]'), "Top Layer manager must react to native dialog open/close changes");
assert(index.includes("/react/parity/css/ui-layer-stack.css") && main.includes('import "@/ui/toast-top-layer"'), "React must load global layer CSS and Top Layer manager");
assert(sync.includes('"ui-layer-stack.css"') && sync.includes('"toast-top-layer.js"'), "Parity sync must include global layer assets");
assert(policy.includes("Toast > Sweet Dialog > Modal"), "UI layer policy documentation missing required order");

console.log("UI layer contract: PASS");
console.log(`Toast ${toast} > Dialog ${dialog} > Modal ${modal}`);
