import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

function icon(name) {
  return iconMarkup(name);
}

function fixCancelEditButton() {
  const button = document.querySelector(".tenant-cancel-edit");
  if (!button || button.dataset.iconFixed === "true") return Boolean(button);

  button.dataset.iconFixed = "true";
  button.innerHTML = `${icon("close")}<span>ยกเลิกแก้ไข</span>`;
  button.style.setProperty("align-items", "center", "important");
  button.style.setProperty("justify-content", "center", "important");
  button.style.setProperty("gap", "8px", "important");
  return true;
}

if (!fixCancelEditButton()) {
  const observer = new MutationObserver(() => {
    if (fixCancelEditButton()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
