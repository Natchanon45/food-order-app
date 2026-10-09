// Percentage coordinates shared by the Admin cover crop preview and every
// branded ordering Hero. Missing/invalid historical values default to centre.
export function normalizeHeroFocus(value) {
  if (value === null || value === undefined || value === "") return 50;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 10) / 10)) : 50;
}
export function heroFocusPosition(settings = {}) {
  const x = normalizeHeroFocus(settings.shopHeroFocusX);
  const y = normalizeHeroFocus(settings.shopHeroFocusY);
  return { x, y, css: `${x}% ${y}%` };
}
export function pointerHeroFocus(event, element) {
  const rectangle = element.getBoundingClientRect();
  if (!rectangle.width || !rectangle.height) return { x: 50, y: 50 };
  return {
    x: normalizeHeroFocus((event.clientX - rectangle.left) * 100 / rectangle.width),
    y: normalizeHeroFocus((event.clientY - rectangle.top) * 100 / rectangle.height),
  };
}
