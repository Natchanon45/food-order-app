// ADMIN_MODAL_RETAIL_POS_PARITY_SAFE_20260805_088
import { t } from "./i18n.js?v=20260903-202";

const MODAL_PARITY_MARKER = "20260805-088";

function modalPresentation(titleText = "") {
  const isTable = [t("admin.workspace.add_table"), t("admin.workspace.edit_table")].includes(titleText);
  const isEdit = [t("admin.workspace.edit_menu"), t("admin.workspace.edit_table")].includes(titleText);

  return {
    entity: isTable ? "table" : "menu",
    icon: isTable ? "grid-3x3-gap" : "egg-fried",
    subtitle: isTable
      ? t("admin.workspace.table_subtitle")
      : t("admin.workspace.menu_subtitle"),
    actionIcon: isEdit ? "floppy" : "plus-lg",
    actionLabel: isEdit ? t("admin.common.save") : t("admin.common.create"),
  };
}

function findSourceSubmit(body) {
  const form = body?.querySelector("form");
  if (!form) return null;

  return form.querySelector(
    "#saveMenuButton, button[type='submit'], button:not([type])"
  );
}

function syncSubmitButton(modal) {
  const body = modal.querySelector(".admin-edit-modal-body");
  const title = modal.querySelector("#adminEditModalTitle");
  const submitButton = modal.querySelector(".admin-edit-modal-submit");
  const sourceSubmit = findSourceSubmit(body);

  if (!body || !title || !submitButton) return;

  body.querySelectorAll(".admin-edit-modal-source-submit").forEach(button => {
    if (button !== sourceSubmit) {
      button.classList.remove("admin-edit-modal-source-submit");
    }
  });

  sourceSubmit?.classList.add("admin-edit-modal-source-submit");

  const presentation = modalPresentation(title.textContent.trim());
  const busy = Boolean(sourceSubmit?.disabled);

  submitButton.disabled = busy;

  if (busy) {
    const busyText = sourceSubmit?.textContent?.trim() || t("admin.common.saving");
    submitButton.innerHTML = `
      <span class="admin-edit-modal-spinner" aria-hidden="true"></span>
      <span>${busyText}</span>
    `;
    return;
  }

  submitButton.innerHTML = `
    <i class="bi bi-${presentation.actionIcon}" aria-hidden="true"></i>
    <span>${presentation.actionLabel}</span>
  `;
}

// ADMIN_MODAL_ICON_DEDUP_HOTFIX_20260805_089
function removeDuplicateModalTitleIcons(title) {
  if (!title) return;

  title.querySelectorAll(
    ":scope > i, :scope > svg, :scope > .app-icon, " +
    ":scope > .admin-heading-icon, :scope > .admin-button-icon, " +
    ":scope > [aria-hidden='true']"
  ).forEach(node => node.remove());

  title.querySelectorAll(
    ".admin-heading-icon, .app-icon, .admin-button-icon"
  ).forEach(node => node.remove());

  title.removeAttribute("data-admin-icon");
  title.classList.add("admin-modal-title-icon-clean");
}

function syncModalPresentation(modal) {
  const title = modal.querySelector("#adminEditModalTitle");
  const subtitle = modal.querySelector("#adminEditModalSubtitle");
  const iconWrap = modal.querySelector(".admin-edit-modal-icon");

  if (!title || !subtitle || !iconWrap) return;

  removeDuplicateModalTitleIcons(title);

  const presentation = modalPresentation(title.textContent.trim());
  modal.dataset.adminModalEntity = presentation.entity;
  iconWrap.innerHTML =
    `<i class="bi bi-${presentation.icon}" aria-hidden="true"></i>`;
  subtitle.textContent = presentation.subtitle;

  syncSubmitButton(modal);
}

function ensureModalTemplate() {
  const modal = document.querySelector(".admin-edit-modal");
  if (!modal) return false;

  if (modal.dataset.adminRetailPosModalParity === MODAL_PARITY_MARKER) {
    syncModalPresentation(modal);
    return true;
  }

  const header = modal.querySelector(".admin-edit-modal-head");
  const body = modal.querySelector(".admin-edit-modal-body");
  const title = modal.querySelector("#adminEditModalTitle");
  const closeButton = modal.querySelector("[data-close-admin-modal]");

  if (!header || !body || !title || !closeButton) return false;

  let iconWrap = header.querySelector(".admin-edit-modal-icon");
  if (!iconWrap) {
    iconWrap = document.createElement("span");
    iconWrap.className = "admin-edit-modal-icon";
    iconWrap.setAttribute("aria-hidden", "true");
  }

  let copy = header.querySelector(".admin-edit-modal-copy");
  let subtitle = header.querySelector("#adminEditModalSubtitle");

  if (!copy) {
    copy = document.createElement("div");
    copy.className = "admin-edit-modal-copy";
  }

  if (!subtitle) {
    subtitle = document.createElement("p");
    subtitle.className = "admin-edit-modal-subtitle";
    subtitle.id = "adminEditModalSubtitle";
  }

  if (!copy.contains(title)) {
    copy.append(title);
  }
  if (!copy.contains(subtitle)) {
    copy.append(subtitle);
  }

  if (!header.contains(iconWrap)) {
    header.prepend(iconWrap);
  }
  if (!header.contains(copy)) {
    header.insertBefore(copy, closeButton);
  }

  closeButton.className = "admin-edit-modal-close";
  closeButton.innerHTML =
    '<i class="bi bi-x-lg" aria-hidden="true"></i>';
  closeButton.setAttribute("aria-label", t("admin.common.close"));
  modal.setAttribute("aria-describedby", subtitle.id);

  let footer = modal.querySelector(".admin-edit-modal-footer");
  if (!footer) {
    footer = document.createElement("footer");
    footer.className = "admin-edit-modal-footer";
    footer.innerHTML = `
      <button class="btn admin-edit-modal-cancel" type="button">
        <i class="bi bi-x-circle" aria-hidden="true"></i>
        <span>${t("admin.common.cancel")}</span>
      </button>
      <button class="btn btn-primary admin-edit-modal-submit" type="button">
        <i class="bi bi-plus-lg" aria-hidden="true"></i>
        <span>${t("admin.common.create")}</span>
      </button>
    `;
    body.insertAdjacentElement("afterend", footer);
  }

  const cancelButton = footer.querySelector(".admin-edit-modal-cancel");
  const submitButton = footer.querySelector(".admin-edit-modal-submit");

  if (!cancelButton.dataset.adminModalParityBound) {
    cancelButton.dataset.adminModalParityBound = "true";
    cancelButton.addEventListener("click", () => closeButton.click());
  }

  if (!submitButton.dataset.adminModalParityBound) {
    submitButton.dataset.adminModalParityBound = "true";
    submitButton.addEventListener("click", () => {
      const form = body.querySelector("form");
      const sourceSubmit = findSourceSubmit(body);

      if (!form || submitButton.disabled) return;

      if (typeof form.requestSubmit === "function") {
        if (sourceSubmit) form.requestSubmit(sourceSubmit);
        else form.requestSubmit();
        return;
      }

      sourceSubmit?.click();
    });
  }

  body.querySelectorAll("form").forEach(form => {
    if (form.dataset.adminModalParityBound) return;
    form.dataset.adminModalParityBound = "true";

    form.addEventListener("submit", () => {
      window.setTimeout(() => syncSubmitButton(modal), 0);
      window.setTimeout(() => syncSubmitButton(modal), 150);
    });

    form.addEventListener("reset", () => {
      window.setTimeout(() => syncSubmitButton(modal), 0);
    });
  });

  modal.dataset.adminRetailPosModalParity = MODAL_PARITY_MARKER;
  syncModalPresentation(modal);
  return true;
}

function scheduleModalSync() {
  ensureModalTemplate();
  requestAnimationFrame(ensureModalTemplate);
  window.setTimeout(ensureModalTemplate, 30);
  window.setTimeout(ensureModalTemplate, 120);
  window.setTimeout(ensureModalTemplate, 320);
}

document.addEventListener("click", event => {
  const trigger = event.target.closest(
    "[data-open-admin-modal], [data-edit-menu], [data-edit-table]"
  );
  if (!trigger) return;
  scheduleModalSync();
}, true);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    window.setTimeout(ensureModalTemplate, 0);
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleModalSync, {
    once: true,
  });
} else {
  scheduleModalSync();
}
