const mobileQuery = window.matchMedia("(max-width: 768px)");
const menuGrid = document.querySelector("#menuGrid");
const categoryTabs = document.querySelector("#categoryTabs");
const pagination = document.querySelector("#menuPagination");

let grouping = false;
let scrollFrame = 0;

function isAllSelected() {
  const selected = categoryTabs?.querySelector('.category-tab[aria-selected="true"], .category-tab.active');
  return !selected || selected.dataset.category === "ทั้งหมด";
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

function groupDeliveryCards() {
  if (!mobileQuery.matches || !menuGrid || grouping || !document.body.classList.contains("delivery-page")) return;
  if (!isAllSelected()) return;
  if (menuGrid.querySelector("[data-menu-category-section]")) return;

  const cards = [...menuGrid.querySelectorAll(":scope > .menu-card")];
  if (!cards.length) return;

  grouping = true;
  const groups = new Map();
  cards.forEach(card => {
    const category = card.querySelector(".menu-category")?.textContent?.trim() || "อื่น ๆ";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(card);
  });

  const fragment = document.createDocumentFragment();
  groups.forEach((items, category) => {
    const section = document.createElement("section");
    section.dataset.menuCategorySection = category;
    section.className = "mobile-menu-category-section";
    section.innerHTML = `<div class="section-title mobile-category-heading"><h2>${category}</h2><span class="badge">${items.length} เมนู</span></div>`;
    const grid = document.createElement("div");
    grid.className = "grid grid-3";
    items.forEach(card => {
      card.hidden = false;
      grid.appendChild(card);
    });
    section.appendChild(grid);
    fragment.appendChild(section);
  });

  menuGrid.replaceChildren(fragment);
  grouping = false;
  updateActiveFromScroll();
}

function updateActiveFromScroll() {
  if (!mobileQuery.matches || !menuGrid || !categoryTabs || !isAllSelected()) return;
  const sections = [...menuGrid.querySelectorAll("[data-menu-category-section]")];
  if (!sections.length) return;

  const stickyOffset = document.body.classList.contains("delivery-page") ? 150 : 165;
  let current = sections[0];
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= stickyOffset) current = section;
    else break;
  }
  setActiveTab(current.dataset.menuCategorySection);
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
    groupDeliveryCards();
    updateActiveFromScroll();
  });
}

if (menuGrid) {
  new MutationObserver(() => {
    if (grouping) return;
    refreshMobileMenu();
  }).observe(menuGrid, { childList: true });
}

categoryTabs?.addEventListener("click", () => {
  setTimeout(refreshMobileMenu, 0);
});

window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
window.addEventListener("resize", refreshMobileMenu);
mobileQuery.addEventListener?.("change", refreshMobileMenu);

refreshMobileMenu();
