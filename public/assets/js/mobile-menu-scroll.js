const mobileQuery = window.matchMedia("(max-width: 899px)");
const menuGrid = document.querySelector("#menuGrid");
const categoryTabs = document.querySelector("#categoryTabs");
const pagination = document.querySelector("#menuPagination");

let normalizing = false;
let scrollFrame = 0;
let browsingAll = true;
let userHasScrolled = false;
let lastWindowY = window.scrollY;

function categoryOf(card) {
  return card.dataset.menuCategory || card.querySelector(".menu-category")?.textContent?.trim() || "อื่น ๆ";
}

function centerTabHorizontally(target) {
  if (!categoryTabs || !target) return;
  const left = target.offsetLeft - (categoryTabs.clientWidth / 2) + (target.clientWidth / 2);
  categoryTabs.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
}

function setActiveTab(category, { center = true } = {}) {
  if (!categoryTabs || !category) return;
  const buttons = [...categoryTabs.querySelectorAll("[data-category]")];
  const target = buttons.find(button => button.dataset.category === category);
  if (!target) return;

  buttons.forEach(button => {
    const active = button === target;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  if (center) centerTabHorizontally(target);
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
  if (!mobileQuery.matches || !menuGrid || !categoryTabs || !browsingAll || !userHasScrolled) return;
  const anchors = categoryAnchors();
  if (!anchors.length) return;

  const stickyOffset = document.body.classList.contains("delivery-page") ? 160 : 170;
  const firstTop = anchors[0].card.getBoundingClientRect().top;

  if (firstTop > stickyOffset) {
    setActiveTab("ทั้งหมด");
    return;
  }

  let current = anchors[0];
  for (const anchor of anchors) {
    if (anchor.card.getBoundingClientRect().top <= stickyOffset) current = anchor;
    else break;
  }
  setActiveTab(current.category);
}

function scheduleScrollUpdate() {
  const currentY = window.scrollY;
  if (Math.abs(currentY - lastWindowY) > 2) userHasScrolled = true;
  lastWindowY = currentY;
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
    if (browsingAll && !userHasScrolled) setActiveTab("ทั้งหมด", { center: false });
    else updateActiveFromScroll();
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
  userHasScrolled = false;
  setActiveTab(button.dataset.category, { center: true });
  setTimeout(refreshMobileMenu, 0);
});

window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
window.addEventListener("resize", refreshMobileMenu);
mobileQuery.addEventListener?.("change", () => {
  userHasScrolled = false;
  browsingAll = true;
  refreshMobileMenu();
});

refreshMobileMenu();
