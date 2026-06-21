const categoryTabs = document.querySelector("#categoryTabs");

function removeAllCategoryTab() {
  if (!categoryTabs) return;

  const allButton = [...categoryTabs.querySelectorAll("[data-category]")]
    .find(button => button.dataset.category === "ทั้งหมด");

  if (allButton) allButton.remove();

  const buttons = [...categoryTabs.querySelectorAll("[data-category]")];
  if (!buttons.length) return;

  const hasActive = buttons.some(button => button.classList.contains("active"));
  if (!hasActive) {
    buttons[0].classList.add("active");
    buttons[0].setAttribute("aria-selected", "true");
  }
}

if (categoryTabs) {
  const observer = new MutationObserver(removeAllCategoryTab);
  observer.observe(categoryTabs, { childList: true });
  removeAllCategoryTab();
}
