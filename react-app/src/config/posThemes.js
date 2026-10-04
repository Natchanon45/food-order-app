import { REACT_RELEASE } from "@/config/release";

export const DEFAULT_POS_THEME = "modern-card";
export const POS_THEME_OPTIONS = [
  { id: "minimal-clean", option: 1, nameKey: "pos_theme.options.minimal_clean.name", descriptionKey: "pos_theme.options.minimal_clean.description" },
  { id: "modern-card", option: 2, nameKey: "pos_theme.options.modern_card.name", descriptionKey: "pos_theme.options.modern_card.description" },
  { id: "section-sidebar", option: 3, nameKey: "pos_theme.options.section_sidebar.name", descriptionKey: "pos_theme.options.section_sidebar.description" },
  { id: "summary", option: 4, nameKey: "pos_theme.options.summary.name", descriptionKey: "pos_theme.options.summary.description" },
  { id: "dark-hitech", option: 5, nameKey: "pos_theme.options.dark_hitech.name", descriptionKey: "pos_theme.options.dark_hitech.description" },
];

const THEME_IDS = new Set(POS_THEME_OPTIONS.map(item => item.id));
const CACHE_PREFIX = "retail_pos_theme_v1_";
const STYLE_ID = "retail-pos-theme-styles";

const tenantKey = tenantId => CACHE_PREFIX + String(tenantId || "default");

export function normalizePosTheme(value) {
  const theme = String(value || "").trim().toLowerCase();
  return THEME_IDS.has(theme) ? theme : DEFAULT_POS_THEME;
}

export function readCachedPosTheme(tenantId) {
  try {
    return normalizePosTheme(localStorage.getItem(tenantKey(tenantId)) || DEFAULT_POS_THEME);
  } catch {
    return DEFAULT_POS_THEME;
  }
}

export function cachePosTheme(tenantId, theme) {
  const normalized = normalizePosTheme(theme);
  try { localStorage.setItem(tenantKey(tenantId), normalized); } catch {}
  return normalized;
}

export function ensurePosThemeStyles() {
  if (typeof document === "undefined") return null;
  let link = document.getElementById(STYLE_ID);
  if (link) return link;
  link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = `/react/parity/css/retail-pos-themes.css?v=${encodeURIComponent(REACT_RELEASE.build)}`;
  document.head.appendChild(link);
  return link;
}

export function applyPosTheme(theme, tenantId = "", { cache = true } = {}) {
  const normalized = normalizePosTheme(theme);
  if (typeof document !== "undefined") {
    ensurePosThemeStyles();
    document.documentElement.dataset.posTheme = normalized;
    if (document.body) document.body.dataset.posTheme = normalized;
  }
  if (cache) cachePosTheme(tenantId, normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pos-theme-applied", {
      detail: { theme: normalized, tenantId: String(tenantId || "") },
    }));
  }
  return normalized;
}
