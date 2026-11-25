/*
 * M2.149 — Display-only Quick Order ordering from Admin's persisted settings.
 * Go's signed GET /api/menus deliberately returns rows in name order, while
 * Admin saves the categoryOrder array and each menu's sortOrder separately.
 * Keep both sources read-only, and never sort the server data/state in place.
 */
const categoryName = value => String(value || "").trim() || "อื่น ๆ";
const compareName = (left, right) => {
  const a = String(left || "");
  const b = String(right || "");
  return a < b ? -1 : a > b ? 1 : 0;
};
const menuRank = value => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : 9999;
};

export function orderQuickOrderMenus(menus, categoryOrder = []) {
  const source = Array.isArray(menus) ? menus : [];
  const configured = Array.isArray(categoryOrder) ? categoryOrder : [];
  const ranks = new Map();
  for (const item of configured) {
    const name = categoryName(item);
    if (!ranks.has(name)) ranks.set(name, ranks.size);
  }
  return [...source].sort((a, b) => {
    const ca = categoryName(a?.category);
    const cb = categoryName(b?.category);
    const rankA = ranks.get(ca) ?? 9999;
    const rankB = ranks.get(cb) ?? 9999;
    return rankA - rankB
      || compareName(ca, cb)
      || menuRank(a?.sortOrder) - menuRank(b?.sortOrder)
      || compareName(a?.name, b?.name)
      || compareName(a?.id, b?.id);
  });
}

export function quickOrderCategoryNames(orderedMenus) {
  const names = [];
  const seen = new Set();
  for (const menu of Array.isArray(orderedMenus) ? orderedMenus : []) {
    if (menu?.active === false) continue;
    const name = categoryName(menu?.category);
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}
