const main = document.querySelector("main.container");
const menuGrid = document.querySelector("#menuGrid");
const cartList = document.querySelector("#cartList");

if (main && menuGrid && cartList && !main.querySelector(".delivery-pos")) {
  const hero = main.querySelector(".hero");
  const filter = document.querySelector("#menuListStart");
  const pagination = document.querySelector("#menuPagination");
  const cartSection = cartList.closest("section.card");
  const allSections = [...main.children].filter(node => node.tagName === "SECTION");
  const cartIndex = allSections.indexOf(cartSection);
  const sideSections = cartIndex >= 0 ? allSections.slice(cartIndex) : [];

  const shell = document.createElement("div");
  shell.className = "delivery-pos";
  const menuColumn = document.createElement("div");
  menuColumn.className = "delivery-menu-column";
  const sideColumn = document.createElement("div");
  sideColumn.className = "delivery-side-column";

  [hero, filter, menuGrid, pagination].filter(Boolean).forEach(node => menuColumn.appendChild(node));
  sideSections.forEach(node => sideColumn.appendChild(node));
  shell.append(menuColumn, sideColumn);
  main.appendChild(shell);
}