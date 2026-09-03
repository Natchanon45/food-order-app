import translations from "./cashier-documents-translations.js?v=20260903-224";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";
configureI18n(translations);
applyTranslations();
document.title = t("cashier_documents.receipt.meta_title");
