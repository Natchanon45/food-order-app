import translations from "./cashier-translations.js?v=20260916-011";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";
configureI18n(translations);
applyTranslations();
document.title = t("cashier.meta.title");
