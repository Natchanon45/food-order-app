import { useI18n } from "@/i18n/I18nProvider";

export function PageReadyOverlay({
  title,
  message,
  error = false,
  onRetry = null,
}) {
  const { t } = useI18n();

  if (error) {
    return (
      <div
        className="page-ready-overlay is-error"
        id="pageReadyOverlay"
        role="alert"
        aria-live="assertive"
        aria-busy="false"
        aria-hidden="false"
      >
        <div className="page-ready-error-state">
          <h2 id="pageReadyTitle">{title || t("auth.failed")}</h2>
          <p>{message || t("auth.login.errors.failed")}</p>
          {onRetry ? (
            <button className="btn btn-primary page-ready-retry" type="button" data-page-ready-retry onClick={onRetry}>
              {t("shared.actions.retry")}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-ready-overlay"
      id="pageReadyOverlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-hidden="false"
    >
      <div className="page-ready-simple" aria-labelledby="pageReadyTitle">
        <span className="page-ready-spinner" aria-hidden="true"></span>
        <div className="page-ready-copy">
          <h2 id="pageReadyTitle" data-page-ready-title>{t("shared.state.loading")}</h2>
          <p data-page-ready-message>{t("shared.state.please_wait")}</p>
        </div>
      </div>
    </div>
  );
}
