import { getLocale, setLocale } from "./i18n.js?v=20260903-202";

function sync(root = document) {
  const locale = getLocale();
  root.querySelectorAll("[data-locale-option]").forEach(option => option.setAttribute("aria-checked", option.dataset.localeOption === locale ? "true" : "false"));
}

document.querySelectorAll("[data-static-locale-switcher]").forEach(root => {
  sync(root);
  root.querySelectorAll("[data-locale-option]").forEach(option => option.addEventListener("click", () => {
    setLocale(option.dataset.localeOption);
    const details = option.closest("[data-locale-menu]");
    if (details?.open) details.open = false;
    location.reload();
  }));
});

document.addEventListener("click", event => {
  document.querySelectorAll("[data-locale-menu][open]").forEach(details => { if (!details.contains(event.target)) details.open = false; });
});
