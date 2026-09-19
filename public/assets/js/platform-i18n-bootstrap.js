import translations from "./platform-translations.js?v=20260920-001";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";
configureI18n(translations);
applyTranslations();
document.title = t("platform.meta.title");
