import "./active-status-icons.js?v=20260701-031";
import { iconMarkup } from "./bootstrap-icons.js?v=20260701-001";

const STORAGE_KEY = "admin_collapsed_cards_v1";
const MODAL_TRANSITION_MS = 220;

function icon(name) {
  return iconMarkup(name);
}

function headingText(card) {
  return card.querySelector(":scope > .section-title h2")?.textContent?.trim() || "";
}

function isNonCollapsibleCard(card) {
  return headingText(card) === "รายงานยอดขาย";
}

function cardKey(card, index = 0) {
  if (card.dataset.adminCardKey) return card.dataset.adminCardKey;
  const heading = headingText(card) || `card-${index}`;
  const key = heading.replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase() || `card-${index}`;
  card.dataset.adminCardKey = key;
  return key;
}

function collapsedState() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveCollapsed(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...state]));
}

function defaultCollapsed(card) {
  return Boolean(card.querySelector("#storeForm, #menuForm, #tableForm, .sort-manager")) || /QR สำหรับสั่ง Delivery/i.test(card.textContent || "");
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

function decorateCard(card, index = 0) {
  if (!(card instanceof HTMLElement) || card.dataset.adminCollapsible === "true") return;
  const title = card.querySelector(":scope > .section-title");
  if (!title || card.closest(".admin-edit-modal") || isNonCollapsibleCard(card)) return;

  const key = cardKey(card, index);
  const state = collapsedState();
  const heading = document.createElement("div");
  heading.className = "admin-card-heading";

  while (title.firstChild) heading.appendChild(title.firstChild);
  title.appendChild(heading);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "btn admin-card-toggle";
  toggle.innerHTML = icon("chevron-down");
  toggle.setAttribute("aria-label", "แสดงหรือซ่อนการ์ด");
  toggle.title = "แสดงหรือซ่อน";
  title.appendChild(toggle);

  ensureCardBody(card, title);
  card.classList.add("admin-collapsible-card");
  card.dataset.adminCollapsible = "true";

  const shouldCollapse = state.has(key) || (!localStorage.getItem(STORAGE_KEY) && defaultCollapsed(card));
  card.classList.toggle("admin-card-collapsed", shouldCollapse);
  toggle.setAttribute("aria-expanded", String(!shouldCollapse));

  toggle.addEventListener("click", () => {
    const collapsed = card.classList.toggle("admin-card-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    const nextState = collapsedState();
    if (collapsed) nextState.add(key);
    else nextState.delete(key);
    saveCollapsed(nextState);
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
        <h2 id="adminEditModalTitle">แก้ไขข้อมูล</h2>
        <button type="button" class="btn admin-edit-modal-close" data-close-admin-modal aria-label="ปิด">${icon("x-circle")}</button>
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
  if (!editButton) return;
  savedScrollY = window.scrollY;
  if (!originalScrollTo) originalScrollTo = window.scrollTo;
  window.scrollTo = () => {};

  setTimeout(() => {
    window.scrollTo = originalScrollTo;
    originalScrollTo = null;
    const isMenu = editButton.hasAttribute("data-edit-menu");
    const form = document.querySelector(isMenu ? "#menuForm" : "#tableForm");
    const card = form?.closest("section.card");
    if (card) openModal(card, isMenu ? "แก้ไขเมนูอาหาร" : "แก้ไขโต๊ะ");
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
