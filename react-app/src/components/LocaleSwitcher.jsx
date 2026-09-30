import { useRef } from "react";
import { useI18n } from "@/i18n/I18nProvider";

const META = {
  th: { label: "ไทย", htmlLang: "th" },
  en: { label: "English", htmlLang: "en" },
  my: { label: "မြန်မာ", htmlLang: "my" },
  lo: { label: "ລາວ", htmlLang: "lo" },
  km: { label: "ខ្មែរ", htmlLang: "km" },
};

export function LocaleSwitcher({ style }) {
  const { locale, supportedLocales, setLocale, t } = useI18n();
  const detailsRef = useRef(null);

  const choose = next => {
    setLocale(next);
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <form className="app-locale-switcher" data-locale-switcher style={style} onSubmit={event => event.preventDefault()}>
      <input type="hidden" name="locale" value={locale} data-locale-value readOnly />
      <details className="app-locale-menu" data-locale-menu ref={detailsRef}>
        <summary
          className="app-locale-trigger"
          aria-label={t("i18n.choose_language")}
          title={t("i18n.choose_language")}
        >
          <i className="bi bi-globe2" aria-hidden="true"></i>
          <span className="visually-hidden">{t("i18n.choose_language")}</span>
        </summary>
        <div className="app-locale-menu__panel" role="menu" aria-label={t("i18n.language")}>
          {supportedLocales.map(item => (
            <button
              key={item}
              type="button"
              className="app-locale-option"
              data-locale-option={item}
              lang={META[item]?.htmlLang || item}
              role="menuitemradio"
              aria-checked={locale === item ? "true" : "false"}
              onClick={() => choose(item)}
            >
              <span>{META[item]?.label || item.toUpperCase()}</span>
              <i className="bi bi-check-lg" aria-hidden="true"></i>
            </button>
          ))}
        </div>
      </details>
    </form>
  );
}
