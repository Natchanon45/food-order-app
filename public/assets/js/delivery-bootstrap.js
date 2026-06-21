async function startDeliveryStorefront() {
  await import("./public-tenant-resolver.js?v=20260621-3");
  await import("./delivery-addresses.js?v=20260621-28");
  await import("./delivery-address-status-sync.js?v=20260621-28");
  await import("./delivery.js?v=20260621-28");
  await import("./dom-menu-pagination.js?v=20260621-28");
  await import("./mobile-menu-scroll.js?v=20260621-28");
}

startDeliveryStorefront().catch(error => {
  console.error("Delivery storefront failed to start", error);
  const menuGrid = document.querySelector("#menuGrid");
  if (menuGrid) menuGrid.innerHTML = '<div class="card empty">ไม่สามารถโหลดรายการอาหารได้ กรุณารีเฟรชหน้าอีกครั้ง</div>';
});
