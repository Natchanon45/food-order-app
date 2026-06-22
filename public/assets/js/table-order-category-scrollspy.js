const menuGrid = document.querySelector("#menuGrid");
const categoryTabs = document.querySelector("#categoryTabs");
const filterArea = document.querySelector("#menuListStart");
const mobileQuery = window.matchMedia("(max-width: 899px)");

let frame = 0;
let lastCategory = "";
let browsingAll = true;
let userHasScrolled = false;
let lastWindowY = window.scrollY;
let suppressUntil = 0;

function cardCategory(card) {
  return card.querySelector(".menu-category")?.textContent?.trim() || "อื่น ๆ";
}

function setActiveCategory(category) {
  if (!categoryTabs || !category || category === lastCategory) return;
  const buttons = [...categoryTabs.querySelectorAll("[data-category]")];
  const target = buttons.find(button => button.dataset.category === category);
  if (!target) return;

  buttons.forEach(button => {
    const active = button === target;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  const left = target.offsetLeft - (categoryTabs.clientWidth / 2) + (target.clientWidth / 2);
  categoryTabs.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  lastCategory = category;
}

function updateFromScroll() {
  frame = 0;
  if (!mobileQuery.matches || !menuGrid || !categoryTabs || !filterArea) return;
  if (!browsingAll || !userHasScrolled || performance.now() < suppressUntil) return;

  const cards = [...menuGrid.querySelectorAll(":scope > .menu-card")].filter(card => !card.hidden);
  if (!cards.length) return;

  const gridTop = menuGrid.getBoundingClientRect().top;
  const stickyBottom = filterArea.getBoundingClientRect().bottom + 12;

  if (gridTop > stickyBottom) {
    setActiveCategory("ทั้งหมด");
    return;
  }

  const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
  if (nearBottom) {
    setActiveCategory(cardCategory(cards[cards.length - 1]));
    return;
  }

  let current = cards[0];
  for (const card of cards) {
    if (card.getBoundingClientRect().top <= stickyBottom) current = card;
    else break;
  }
  setActiveCategory(cardCategory(current));
}

function scheduleUpdate() {
  if (!mobileQuery.matches) return;
  const currentY = window.scrollY;
  if (Math.abs(currentY - lastWindowY) > 3) userHasScrolled = true;
  lastWindowY = currentY;
  if (frame) return;
  frame = requestAnimationFrame(updateFromScroll);
}

window.addEventListener("scroll", scheduleUpdate, { passive: true });
window.addEventListener("resize", () => {
  if (!mobileQuery.matches) {
    userHasScrolled = false;
    browsingAll = true;
    lastCategory = "";
    requestAnimationFrame(() => setActiveCategory("ทั้งหมด"));
    return;
  }
  scheduleUpdate();
});

mobileQuery.addEventListener?.("change", event => {
  userHasScrolled = false;
  browsingAll = true;
  lastWindowY = window.scrollY;
  lastCategory = "";
  if (!event.matches) requestAnimationFrame(() => setActiveCategory("ทั้งหมด"));
});

categoryTabs?.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  const category = button.dataset.category;
  browsingAll = category === "ทั้งหมด";
  userHasScrolled = false;
  suppressUntil = performance.now() + 350;
  lastWindowY = window.scrollY;
  lastCategory = "";
  setActiveCategory(category);
});

if (menuGrid) {
  new MutationObserver(() => {
    if (!browsingAll) return;
    suppressUntil = performance.now() + 250;
    lastWindowY = window.scrollY;
    if (mobileQuery.matches) requestAnimationFrame(() => setActiveCategory("ทั้งหมด"));
  }).observe(menuGrid, { childList: true });
}

requestAnimationFrame(() => setActiveCategory("ทั้งหมด"));
