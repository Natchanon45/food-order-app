import { dataService } from "./data-service.js";

if (!document.querySelector('link[href="/assets/css/pos-refresh.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/pos-refresh.css";
  document.head.appendChild(link);
}

let menuMap = new Map();

function menuKey(value = "") {
  return String(value).trim().toLocaleLowerCase("th");
}

function applyPositions(root = document) {
  root.querySelectorAll?.(".menu-image img").forEach(image => {
    const menu = menuMap.get(menuKey(image.alt)) || [...menuMap.values()].find(item => item.image && item.image === image.src);
    if (!menu) return;
    const x = Math.max(0, Math.min(100, Number(menu.imagePositionX ?? 50)));
    const y = Math.max(0, Math.min(100, Number(menu.imagePositionY ?? 50)));
    image.style.objectPosition = `${x}% ${y}%`;
  });
}

if (location.pathname.startsWith("/delivery") && document.querySelector("#menuGrid")) import("./delivery-pos-layout.js");

try {
  const menus = await dataService.listMenus();
  menuMap = new Map(menus.map(item => [menuKey(item.name), item]));
  applyPositions();
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) applyPositions(node);
    }));
  }).observe(document.body, { childList: true, subtree: true });
} catch (error) {
  console.error("Unable to apply menu image position", error);
}