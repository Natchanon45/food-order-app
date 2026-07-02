function alignCartRows(root = document) {
  root.querySelectorAll(".cart-row").forEach(row => {
    const note = row.querySelector("[data-note]");
    const info = row.firstElementChild;
    const quantity = row.querySelector(":scope > .qty");
    if (!note || !info || !quantity) return;
    info.classList.add("cart-item-info");
    row.classList.add("cart-row-aligned");
    if (note.parentElement !== row) row.appendChild(note);
  });
}

alignCartRows();

new MutationObserver(mutations => {
  mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    alignCartRows(node.matches?.(".cart-row") ? node.parentElement : node);
  }));
}).observe(document.body, { childList: true, subtree: true });

setInterval(() => alignCartRows(), 500);
