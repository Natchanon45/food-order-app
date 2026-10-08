import { useI18n } from "@/i18n/I18nProvider";

export function PageReadyOverlay({
  title,
  message,
  error = false,
  onRetry = null,
  progressPercent = null,
}) {
  const { t } = useI18n();
  const numericProgress = progressPercent === null || progressPercent === undefined
    ? null
    : Number(progressPercent);
  const hasRealProgress = Number.isFinite(numericProgress);
  const clampedProgress = hasRealProgress ? Math.max(0, Math.min(100, numericProgress)) : null;
  const roundedProgress = hasRealProgress ? Math.round(clampedProgress) : null;

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
              <i className="bi bi-arrow-clockwise app-icon" aria-hidden="true"></i>
              <span>{t("shared.actions.retry")}</span>
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
        {hasRealProgress ? (
          <div className="page-ready-progress-block" data-page-ready-real-progress>
            <div
              className="page-ready-progress page-ready-progress-determinate"
              role="progressbar"
              aria-label={t("shared.state.loading")}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={roundedProgress}
            >
              <span style={{ width: clampedProgress + "%" }}></span>
            </div>
            <strong className="page-ready-progress-percent">{roundedProgress}%</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
