import translations from "./admin-tenants-translations.js?v=20260903-211";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";

configureI18n(translations);
applyTranslations();
document.title = t("admin_tenants.meta.title");
