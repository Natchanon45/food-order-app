import { getIntlLocale, getLocale } from "./i18n.js?v=20260812-099";

const isEnglish = getLocale() === "en";
const intlLocale = getIntlLocale();
const fallback = globalThis.APP_I18N?.fallbackMessages?.pos_operations || {};
const current = globalThis.APP_I18N?.messages?.pos_operations || {};
const exact = new Map();
const templates = [];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collect(source, target) {
  for (const [key, value] of Object.entries(source || {})) {
    const translated = target?.[key];
    if (value && typeof value === "object") {
      collect(value, translated);
      continue;
    }
    if (typeof value !== "string" || typeof translated !== "string") continue;
    const names = [...value.matchAll(/:([a-z_]+)/gi)].map(match => match[1]);
    if (!names.length) {
      exact.set(value, translated);
      continue;
    }
    let cursor = 0;
    let pattern = "^";
    for (const match of value.matchAll(/:([a-z_]+)/gi)) {
      pattern += escapeRegExp(value.slice(cursor, match.index)) + "(.+?)";
      cursor = match.index + match[0].length;
    }
    pattern += escapeRegExp(value.slice(cursor)) + "$";
    templates.push({ pattern: new RegExp(pattern), names, translated });
  }
}

collect(fallback, current);

function localizeDate(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;
  const sourceYear = Number(match[3]);
  const year = sourceYear > 2400 ? sourceYear - 543 : sourceYear;
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
  if (Number.isNaN(date.getTime())) return null;
  const options = match[4] ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return new Intl.DateTimeFormat(intlLocale, options).format(date);
}

function translateUnit(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (exact.has(text)) return exact.get(text);
  for (const entry of templates) {
    const match = text.match(entry.pattern);
    if (!match) continue;
    let output = entry.translated;
    entry.names.forEach((name, index) => {
      let replacement = match[index + 1];
      if (name === "date") replacement = localizeDate(replacement) || replacement;
      output = output.replace(`:${name}`, replacement);
    });
    return output;
  }
  return localizeDate(text);
}

function translateText(value, element) {
  const text = String(value || "").trim();
  const direct = translateUnit(text);
  if (direct) return direct;
  if (!text.includes(" • ")) return null;
  const parts = text.split(" • ");
  if (element?.id === "activeShiftMeta") {
    const last = translateUnit(parts.at(-1));
    if (!last) return null;
    return [...parts.slice(0, -1), last].join(" • ");
  }
  let changed = false;
  const translated = parts.map(part => {
    const next = translateUnit(part);
    if (next && next !== part) changed = true;
    return next || part;
  });
  return changed ? translated.join(" • ") : null;
}

const protectedSelectors = [
  ".customer-card-head h3",
  ".customer-contact span:nth-child(2)",
  ".customer-contact span:nth-child(3)",
  ".customer-history-item > div:first-child > strong",
  ".shift-table tbody td:first-child strong",
  ".shift-table tbody td:first-child .product-sub",
];

function translateNode(node) {
  const element = node?.parentElement;
  if (!isEnglish || node?.nodeType !== Node.TEXT_NODE || !element) return;
  if (protectedSelectors.some(selector => element.matches(selector))) return;
  const raw = node.nodeValue || "";
  const translated = translateText(raw, element);
  if (!translated || translated === raw.trim()) return;
  const left = raw.match(/^\s*/)?.[0] || "";
  const right = raw.match(/\s*$/)?.[0] || "";
  node.nodeValue = `${left}${translated}${right}`;
}

function translateTree(root) {
  if (!isEnglish || !root) return;
  if (root.nodeType === Node.TEXT_NODE) return translateNode(root);
  if (!(root instanceof Element) && root !== document.body) return;
  if (root instanceof Element && root.matches("script,style,textarea,input,option")) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) translateNode(node);
}

if (isEnglish) {
  translateTree(document.body);
  new MutationObserver(mutations => mutations.forEach(mutation => {
    if (mutation.type === "characterData") translateNode(mutation.target);
    mutation.addedNodes.forEach(translateTree);
  })).observe(document.body, { childList: true, subtree: true, characterData: true });
}
