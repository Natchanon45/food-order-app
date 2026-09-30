import translations from "./waiting-queue-translations";
import masterTranslations from "./waiting-queue-master-translations.json";

function nested(source, key) {
  return String(key || "").split(".").filter(Boolean).reduce(
    (value, part) => value && Object.prototype.hasOwnProperty.call(value, part) ? value[part] : undefined,
    source,
  );
}

function interpolate(value, replacements = {}) {
  return String(value ?? "").replace(/:([A-Za-z0-9_]+)/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(replacements, key) ? String(replacements[key]) : match,
  );
}

export function waitingQueueTranslator(locale = "th") {
  const localeRoot = translations?.[locale] || translations?.th || {};
  const fallbackRoot = translations?.th || {};
  const selected = localeRoot.waiting_queue || fallbackRoot.waiting_queue || {};
  const fallback = fallbackRoot.waiting_queue || {};
  const masterSelected = masterTranslations?.[locale] || masterTranslations?.th || {};
  const masterFallback = masterTranslations?.th || {};
  return (key, replacements = {}) => {
    const rawKey = String(key || "");
    const actionKey = rawKey.startsWith("actions.") ? rawKey.slice(8) : "";
    const value = actionKey
      ? (
          nested(localeRoot.waiting_queue_actions, actionKey)
          ?? nested(fallbackRoot.waiting_queue_actions, actionKey)
        )
      : (
          nested(masterSelected, rawKey)
          ?? nested(selected, rawKey)
          ?? nested(masterFallback, rawKey)
          ?? nested(fallback, rawKey)
        );
    return interpolate(value ?? rawKey, replacements);
  };
}

export function waitingQueueNamespaceTranslator(locale = "th", namespace = "waiting_queue") {
  const localeRoot = translations?.[locale] || translations?.th || {};
  const fallbackRoot = translations?.th || {};
  const selected = localeRoot?.[namespace] || fallbackRoot?.[namespace] || {};
  const fallback = fallbackRoot?.[namespace] || {};
  return (key, replacements = {}) =>
    interpolate(nested(selected, key) ?? nested(fallback, key) ?? key, replacements);
}
