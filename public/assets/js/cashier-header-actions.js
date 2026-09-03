const header = document.querySelector(".app-header");

function alignCashierHeaderActions() {
  if (!header) return;
  const actions = header.querySelector(":scope > [data-header-actions]");
  if (!actions) return;

  const localeSwitcher = header.querySelector(":scope > .app-locale-switcher")
    || actions.querySelector(":scope > .app-locale-switcher");
  if (localeSwitcher) actions.prepend(localeSwitcher);

  const userMenu = header.querySelector(":scope > [data-user-menu]")
    || actions.querySelector(":scope > [data-user-menu]");
  if (userMenu) actions.appendChild(userMenu);
}

if (header) {
  alignCashierHeaderActions();
  const observer = new MutationObserver(alignCashierHeaderActions);
  observer.observe(header, { childList: true });
}
