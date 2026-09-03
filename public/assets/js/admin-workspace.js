import "./active-status-icons.js?v=20260701-031";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";
import { t } from "./i18n.js?v=20260903-202";

const STORAGE_KEY = "admin_collapsed_cards_v1";
const MODAL_TRANSITION_MS = 220;

try {
  localStorage.removeItem(STORAGE_KEY);
} catch {}

function icon(name) {
  return iconMarkup(name);
}

function headingText(card) {
  return card.querySelector(":scope > .section-title h2")?.textContent?.trim() || "";
}

function isNonCollapsibleCard(card) {
  return card.dataset.adminCardRole === "sales-report";
}

function cardKey(card, index = 0) {
  if (card.dataset.adminCardKey) return card.dataset.adminCardKey;
  const heading = headingText(card) || `card-${index}`;
  const key = heading.replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase() || `card-${index}`;
  card.dataset.adminCardKey = key;
  return key;
}

function ensureCardBody(card, title) {
  let body = card.querySelector(":scope > .admin-card-body");
  if (body) return body;
  body = document.createElement("div");
  body.className = "admin-card-body";
  [...card.childNodes].forEach(node => {
    if (node === title) return;
    body.appendChild(node);
  });
  card.appendChild(body);
  return body;
}

function setCardCollapsed(card, toggle, collapsed) {
  card.classList.toggle("admin-card-collapsed", collapsed);
  toggle.setAttribute("aria-expanded", String(!collapsed));
}

function decorateCard(card, index = 0) {
  if (!(card instanceof HTMLElement) || card.dataset.adminCollapsible === "true") return;
  const title = card.querySelector(":scope > .section-title");
  if (!title || card.matches("[data-admin-entity-form]") || card.closest(".admin-edit-modal") || isNonCollapsibleCard(card)) return;

  cardKey(card, index);
  const heading = document.createElement("div");
  heading.className = "admin-card-heading";

  while (title.firstChild) heading.appendChild(title.firstChild);
  title.appendChild(heading);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "btn admin-card-toggle";
  toggle.innerHTML = icon("chevron-down");
  toggle.setAttribute("aria-label", t("admin.workspace.toggle_card"));
  toggle.title = t("admin.workspace.toggle_title");
  title.appendChild(toggle);

  ensureCardBody(card, title);
  card.classList.add("admin-collapsible-card");
  card.dataset.adminCollapsible = "true";
  title.classList.add("admin-card-touch-target");

  setCardCollapsed(card, toggle, true);

  const toggleCard = () => {
    setCardCollapsed(card, toggle, !card.classList.contains("admin-card-collapsed"));
  };

  toggle.addEventListener("click", event => {
    event.stopPropagation();
    toggleCard();
  });

  title.addEventListener("click", event => {
    if (event.target.closest("button, a, input, select, textarea, label")) return;
    toggleCard();
  });
}

function decorateCards(root = document) {
  const cards = [
    ...root.querySelectorAll?.("main.container > section.card, main.container > .grid > section.card") || []
  ];
  cards.forEach(decorateCard);
}

function createModal() {
  const backdrop = document.createElement("div");
  backdrop.className = "admin-edit-modal-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.innerHTML = `
    <section class="admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="adminEditModalTitle">
      <header class="admin-edit-modal-head">
        <h2 id="adminEditModalTitle">${t("admin.workspace.modal_default_title")}</h2>
        <button type="button" class="btn admin-edit-modal-close" data-close-admin-modal aria-label="${t("admin.common.close")}">${icon("x-circle")}</button>
      </header>
      <div class="admin-edit-modal-body"></div>
    </section>`;
  document.body.appendChild(backdrop);
  return backdrop;
}

const modal = createModal();
const modalBody = modal.querySelector(".admin-edit-modal-body");
const modalTitle = modal.querySelector("#adminEditModalTitle");
let activeCard = null;
let placeholder = null;
let closeTimer = 0;
let modalOpen = false;

function restoreActiveCard() {
  if (activeCard && placeholder?.parentNode) {
    placeholder.parentNode.insertBefore(activeCard, placeholder);
    placeholder.remove();
    activeCard.classList.remove("admin-card-collapsed");
  }
  activeCard = null;
  placeholder = null;
  modalBody.replaceChildren();
}

function closeModal({ immediate = false } = {}) {
  if (!modalOpen && !activeCard) return;
  clearTimeout(closeTimer);
  modalOpen = false;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("admin-modal-open");

  const finish = () => restoreActiveCard();
  if (immediate) finish();
  else closeTimer = window.setTimeout(finish, MODAL_TRANSITION_MS);
}

function openModal(card, titleText) {
  closeModal({ immediate: true });
  placeholder = document.createElement("div");
  placeholder.className = "admin-edit-placeholder";
  card.parentNode.insertBefore(placeholder, card);
  activeCard = card;
  card.classList.remove("admin-card-collapsed");
  modalTitle.textContent = titleText;
  modalBody.appendChild(card);
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("admin-modal-open");
  modalOpen = true;

  requestAnimationFrame(() => {
    modal.classList.add("is-open");
    requestAnimationFrame(() => card.querySelector("input:not([type=hidden]), select, textarea")?.focus());
  });
}

modal.addEventListener("click", event => {
  if (event.target === modal || event.target.closest("[data-close-admin-modal]")) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && modalOpen) closeModal();
});

let savedScrollY = 0;
let originalScrollTo = null;

document.addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-menu], [data-edit-table]");
  const addButton = event.target.closest("[data-open-admin-modal]");
  if (!editButton && !addButton) return;
  savedScrollY = window.scrollY;
  if (!originalScrollTo) originalScrollTo = window.scrollTo;
  window.scrollTo = () => {};

  setTimeout(() => {
    window.scrollTo = originalScrollTo;
    originalScrollTo = null;
    const entity = addButton?.dataset.openAdminModal || (editButton?.hasAttribute("data-edit-menu") ? "menu" : "table");
    const isMenu = entity === "menu";
    const form = document.querySelector(isMenu ? "#menuForm" : "#tableForm");
    const card = form?.closest("section.card");
    if (card) openModal(card, addButton ? (isMenu ? t("admin.workspace.add_menu") : t("admin.workspace.add_table")) : (isMenu ? t("admin.workspace.edit_menu") : t("admin.workspace.edit_table")));
    window.scrollTo(0, savedScrollY);
  }, 0);
}, true);

document.querySelector("#menuForm")?.addEventListener("reset", () => {
  if (modalOpen && activeCard?.querySelector("#menuForm")) setTimeout(() => closeModal(), 0);
});

document.querySelector("#tableForm")?.addEventListener("reset", () => {
  if (modalOpen && activeCard?.querySelector("#tableForm")) setTimeout(() => closeModal(), 0);
});

decorateCards();

new MutationObserver(records => {
  if (records.some(record => [...record.addedNodes].some(node => node.nodeType === Node.ELEMENT_NODE))) decorateCards();
}).observe(document.querySelector("main.container"), { childList: true, subtree: true });