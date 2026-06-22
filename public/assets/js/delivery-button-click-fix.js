document.addEventListener("click", event => {
  const actionButton = event.target.closest?.("#menuGrid [data-add], #cartList [data-inc], #cartList [data-dec]");
  if (!actionButton || event.target === actionButton) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  actionButton.click();
}, true);
