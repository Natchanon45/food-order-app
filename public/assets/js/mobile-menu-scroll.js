const mobileQuery = window.matchMedia("(max-width: 768px)");
const menuGrid = document.querySelector("#menuGrid");
const categoryTabs = document.querySelector("#categoryTabs");
const pagination = document.querySelector("#menuPagination");

let normalizing = false;
let scrollFrame = 0;
let browsingAll = true;

function categoryOf(card) {
  return card.dataset.menuCategory || card.querySelector(".menu-category")?.textContent?.trim() || "อื่น ๆ";
}

function setActiveTab(category) {
  if (!categoryTabs || !category) return;
  const buttons = [...categoryTabs.querySelectorAll("[data-category]")];
  const target = buttons.find(button => button.dataset.category === category);
  if (!target) return;

  buttons.forEach(button => {
    const active = button === target;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  target.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
}

function flattenMenuCards() {
  if (!mobileQuery.matches || !menuGrid || normalizing) return;

  const sections = [...menuGrid.querySelectorAll(":scope > [data-menu-category-section]")];
  if (!sections.length) {
    [...menuGrid.querySelectorAll(":scope > .menu-card")].forEach(card => {
      card.hidden = false;
      card.dataset.menuCategory = categoryOf(card);
    });
    return;
  }

  normalizing = true;
  const fragment = document.createDocumentFragment();
  sections.forEach(section => {
    const sectionCategory = section.dataset.menuCategorySection || "อื่น ๆ";
    section.querySelectorAll(".menu-card").forEach(card => {
      card.hidden = false;
      card.dataset.menuCategory = sectionCategory || categoryOf(card);
      fragment.appendChild(card);
    });
  });
  menuGrid.replaceChildren(fragment);
  normalizing = false;
}

function categoryAnchors() {
  const cards = [...menuGrid.querySelectorAll(":scope > .menu-card")];
  const firstByCategory = new Map();
  cards.forEach(card => {
    const category = categoryOf(card);
    card.dataset.menuCategory = category;
    if (!firstByCategory.has(category)) firstByCategory.set(category, card);
  });
  return [...firstByCategory.entries()].map(([category, card]) => ({ category, card }));
}

function updateActiveFromScroll() {
  if (!mobileQuery.matches || !menuGrid || !categoryTabs || !browsingAll) return;
  const anchors = categoryAnchors();
  if (!anchors.length) return;

  const stickyOffset = document.body.classList.contains("delivery-page") ? 160 : 170;
  let current = anchors[0];
  for (const anchor of anchors) {
    if (anchor.card.getBoundingClientRect().top <= stickyOffset) current = anchor;
    else break;
  }
  setActiveTab(current.category);
}

function scheduleScrollUpdate() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(updateActiveFromScroll);
}

function refreshMobileMenu() {
  if (pagination) {
    pagination.hidden = mobileQuery.matches;
    if (mobileQuery.matches) pagination.style.setProperty("display", "none", "important");
    else pagination.style.removeProperty("display");
  }

  if (!mobileQuery.matches) return;
  requestAnimationFrame(() => {
    flattenMenuCards();
    updateActiveFromScroll();
  });
}

if (menuGrid) {
  new MutationObserver(() => {
    if (normalizing) return;
    refreshMobileMenu();
  }).observe(menuGrid, { childList: true, subtree: false });
}

categoryTabs?.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  browsingAll = button.dataset.category === "ทั้งหมด";
  setTimeout(refreshMobileMenu, 0);
});

window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
window.addEventListener("resize", refreshMobileMenu);
mobileQuery.addEventListener?.("change", refreshMobileMenu);

refreshMobileMenu();
