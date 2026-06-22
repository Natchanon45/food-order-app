const menuGrid = document.querySelector("#menuGrid");
const categoryTabs = document.querySelector("#categoryTabs");
const filterArea = document.querySelector("#menuListStart");

let frame = 0;
let lastCategory = "";

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
  if (!menuGrid || !categoryTabs || !filterArea) return;

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
  if (frame) return;
  frame = requestAnimationFrame(updateFromScroll);
}

window.addEventListener("scroll", scheduleUpdate, { passive: true });
window.addEventListener("resize", scheduleUpdate);
categoryTabs?.addEventListener("click", () => {
  lastCategory = "";
  requestAnimationFrame(updateFromScroll);
});

if (menuGrid) {
  new MutationObserver(() => {
    lastCategory = "";
    requestAnimationFrame(updateFromScroll);
  }).observe(menuGrid, { childList: true });
}

requestAnimationFrame(updateFromScroll);
