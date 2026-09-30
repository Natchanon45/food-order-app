import { useI18n } from "@/i18n/I18nProvider";
import { REACT_RELEASE } from "@/config/release";

export function ParityFooter() {
  const { t } = useI18n();

  return (
    <footer className="app-version" data-shared-app-footer>
      <span>{t("shared.footer.product")}</span>
      <span aria-hidden="true"> • </span>
      <span>{t("shared.footer.version", { version: REACT_RELEASE.version })}</span>
      <span aria-hidden="true"> • </span>
      <span>{t("shared.footer.build", { build: REACT_RELEASE.build })}</span>
      <span aria-hidden="true"> • </span>
      <a
        className="icon-library-credit"
        href="https://www.flaticon.com/uicons"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("shared.footer.icon_credit")}
      </a>
    </footer>
  );
}
