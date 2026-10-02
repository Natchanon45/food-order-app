import { APP_INFO } from "./app-info.js?v=20260920-003";

export function mountAppFooter() {
  if (document.querySelector(".app-version")) return;
  const footer = document.createElement("footer");
  footer.className = "app-version";
  footer.textContent = `PENGUIN • Version ${APP_INFO.version} • Build ${APP_INFO.build}`;
  document.body.appendChild(footer);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAppFooter, { once: true });
} else {
  mountAppFooter();
}
