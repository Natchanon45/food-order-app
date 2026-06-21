function icon(name) {
  return `<svg class="app-icon" aria-hidden="true"><use href="/assets/images/app-icons.svg?v=20260621-2#icon-${name}"></use></svg>`;
}

function fixCancelEditButton() {
  const button = document.querySelector(".tenant-cancel-edit");
  if (!button) return;
  button.innerHTML = `${icon("close")}<span>ยกเลิกแก้ไข</span>`;
  button.style.setProperty("align-items", "center", "important");
  button.style.setProperty("justify-content", "center", "important");
  button.style.setProperty("gap", "8px", "important");
}

fixCancelEditButton();
new MutationObserver(fixCancelEditButton).observe(document.body, { childList: true, subtree: true });
