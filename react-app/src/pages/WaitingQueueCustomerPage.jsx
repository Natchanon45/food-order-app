import { useEffect, useMemo, useRef, useState } from "react";
import { sweetAlert, sweetConfirm } from "@/components/sweetDialog";
import {
  callCountdownSeconds,
  updatePublicCustomerResponse,
  watchPublicQueue,
} from "@/data/waitingQueueCore";
import { useI18n } from "@/i18n/I18nProvider";
import { waitingQueueTranslator } from "@/i18n/waitingQueueI18n";
import { useParityPage } from "@/hooks/useParityPage";

const STATUS_STEP = Object.freeze({
  waiting: 1,
  deferred: 1,
  called: 2,
  acknowledged: 3,
  preparing_table: 4,
  seated: 5,
  no_show: 5,
  cancelled: 5,
});

function pad(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
}

export function WaitingQueueCustomerPage() {
  const { locale, intlLocale } = useI18n();
  const t = useMemo(() => waitingQueueTranslator(locale), [locale]);
  const stylesReady = useParityPage({
    title: t("customer.meta_title"),
    styles: ["retail-pos.css", "sweet-dialog.css", "waiting-queue-customer.css"],
  });
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const tenantId = String(params.get("tenantId") || "").trim();
  const token = String(params.get("token") || "").trim();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState(Date.now());
  const [notificationEnabled, setNotificationEnabled] = useState(
    () => typeof Notification !== "undefined" && Notification.permission === "granted",
  );
  const lastStatus = useRef("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token || token.length < 12) {
      setLoading(false);
      setErrorText(t("customer.invalid_link"));
      return undefined;
    }
    setLoading(true);
    setErrorText("");
    return watchPublicQueue(token, next => {
      if (!next || (tenantId && next.tenantId !== tenantId)) {
        setLoading(false);
        setRow(null);
        setErrorText(t("customer.not_found"));
        return;
      }
      setLoading(false);
      setErrorText("");
      setRow(next);
    }, error => {
      console.error("WAITING_QUEUE_CUSTOMER_WATCH_FAILED", error);
      setLoading(false);
      setErrorText(navigator.onLine ? t("customer.load_failed") : t("customer.offline"));
    });
  }, [token, tenantId, locale]);

  useEffect(() => {
    if (!row) return;
    if (lastStatus.current === row.status || row.status !== "called") {
      lastStatus.current = row.status || "";
      return;
    }
    try {
      navigator.vibrate?.([150, 80, 150]);
    } catch {}
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(t("customer.notification_call_title", { queue: row.queueNumber || "" }), {
          body: t("customer.calling_body"),
          icon: "/assets/images/icon-192.png",
          tag: `waiting-${row.waitingQueueId || row.id || token}`,
          renotify: true,
        });
      } catch {}
    }
    lastStatus.current = row.status || "";
  }, [row?.status, row?.queueNumber, row?.waitingQueueId, locale]);
  const step = STATUS_STEP[row?.status] || 1;
  const remaining = row?.status === "called" ? callCountdownSeconds(row, now) : null;
  const countdownText = row?.status !== "called"
    ? ""
    : remaining === null
      ? t("customer.countdown_wait")
      : remaining <= 0
        ? t("customer.countdown_overdue")
        : `${pad(Math.floor(remaining / 60))}:${pad(remaining % 60)}`;

  const statusLabel = row ? t(`queue.status.${row.status}`) : "";
  const estimateText = row?.status === "seated"
    ? t(row.tableLabel ? "customer.estimate_seated" : "customer.estimate_ready", { table: row.tableLabel || "" })
    : t("common.minute_range", {
        from: Number(row?.estimatedWaitMin || 0),
        to: Math.max(Number(row?.estimatedWaitMin || 0), Number(row?.estimatedWaitMax || 0)),
      });
  const updatedText = row?.updatedAtMs
    ? t("customer.updated", {
        time: new Date(Number(row.updatedAtMs)).toLocaleString(intlLocale, {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "short",
        }),
      })
    : "";
  const orderReady = row?.status === "seated" && /^\/s\/[^/]+\/order\/\?/.test(String(row?.orderUrl || ""));

  const confirmArrival = async () => {
    if (!row || busy) return;
    setBusy("arrival");
    try {
      await updatePublicCustomerResponse(token, "on_the_way");
    } catch (error) {
      await sweetAlert(error?.message || t("customer.response_failed"), {
        title: t("customer.response_failed"),
        type: "error",
      });
    } finally {
      setBusy("");
    }
  };

  const cancelQueue = async () => {
    if (!row || busy) return;
    const confirmed = await sweetConfirm(t("customer.cancel_confirm"), {
      title: t("customer.cancel_title", { queue: row.queueNumber || "" }),
      confirmText: t("customer.cancel_queue"),
      cancelText: t("customer.back"),
      confirmIcon: "check-circle",
      cancelIcon: "arrow-left",
      type: "warning",
    });
    if (!confirmed) return;
    setBusy("cancel");
    try {
      await updatePublicCustomerResponse(token, "cancel_requested");
    } catch (error) {
      await sweetAlert(error?.message || t("customer.cancel_failed"), {
        title: t("customer.cancel_failed_title"),
        type: "error",
      });
    } finally {
      setBusy("");
    }
  };

  const enableNotifications = async () => {
    if (busy) return;
    if (typeof Notification === "undefined") {
      await sweetAlert(t("customer.notification_unsupported"), {
        title: t("customer.notification_open_failed"),
        type: "warning",
      });
      return;
    }
    setBusy("notification");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationEnabled(true);
        await sweetAlert(t("customer.notification_enabled_help"), {
          title: t("customer.notification_enabled"),
          type: "success",
        });
      } else {
        await sweetAlert(t("customer.notification_denied"), {
          title: t("customer.notification_denied_title"),
          type: "warning",
        });
      }
    } finally {
      setBusy("");
    }
  };

  if (!stylesReady) return null;
  return (
    <main className="waiting-customer-shell">
      <header className="waiting-customer-brand">
        <span className="waiting-customer-logo" aria-hidden="true"><i className="bi bi-person-standing"></i></span>
        <div><strong>{t("customer.brand_title")}</strong><span>{t("customer.brand_subtitle")}</span></div>
      </header>

      {loading ? (
        <div id="waitingCustomerLoading" className="waiting-customer-loading">
          <span className="waiting-customer-spinner" aria-hidden="true"></span>
          <strong>{t("customer.loading_title")}</strong>
          <span>{t("customer.loading_help")}</span>
        </div>
      ) : null}

      {errorText ? <div id="waitingCustomerError" className="waiting-customer-error">{errorText}</div> : null}

      {row ? (
        <section id="waitingCustomerCard" className="waiting-customer-card">
          <div className="waiting-customer-hero">
            <span className="waiting-customer-label">{t("customer.queue_number")}</span>
            <strong id="waitingCustomerQueueNumber" className="waiting-customer-number">{row.queueNumber || "-"}</strong>
            <div className="waiting-customer-hero-meta">
              <span id="waitingCustomerPartySize" className="waiting-customer-party">{t("common.people", { count: Number(row.partySize || 1).toLocaleString(intlLocale) })}</span>
              <div id="waitingCustomerStatus" className="waiting-customer-status" data-status={row.status}>{statusLabel}</div>
            </div>
          </div>

          <div className="waiting-customer-info">
            <article><i className="bi bi-people" aria-hidden="true"></i><div><span>{t("customer.groups_ahead")}</span><strong id="waitingCustomerGroupsAhead">{Number(row.groupsAhead || 0).toLocaleString(intlLocale)}</strong></div></article>
            <article><i className="bi bi-clock" aria-hidden="true"></i><div><span>{t("customer.estimated_wait")}</span><strong id="waitingCustomerEstimate">{estimateText}</strong></div></article>
          </div>

          <div id="waitingCustomerProgress" className="waiting-customer-progress" aria-label={t("customer.progress_aria")}>
            {[
              [1, "waiting"],
              [2, "called"],
              [3, "acknowledged"],
              [4, "preparing"],
              [5, "seated"],
            ].map(([number, key]) => (
              <div className={"waiting-customer-step" + (number <= step ? " active" : "") + (number === step ? " current" : "")} data-waiting-step={number} key={key}>
                <i>{number}</i><span>{t(`customer.steps.${key}`)}</span>
              </div>
            ))}
          </div>

          {row.status === "called" ? (
            <>
              <div id="waitingCustomerCallMessage" className="waiting-customer-call" aria-live="assertive">
                <i className="bi bi-megaphone" aria-hidden="true"></i>
                <div><strong>{t("customer.calling_title")}</strong><span>{t("customer.calling_body")}</span></div>
              </div>
              <div id="waitingCustomerCountdownWrap" className={"waiting-customer-countdown" + (remaining !== null && remaining <= 0 ? " overdue" : "")}>
                <span>{t("customer.response_remaining")}</span>
                <strong id="waitingCustomerCountdown">{countdownText}</strong>
              </div>
            </>
          ) : null}

          {orderReady ? (
            <section id="waitingCustomerOrderReady" className="waiting-customer-order-ready">
              <i className="bi bi-check-circle" aria-hidden="true"></i>
              <div>
                <strong>{t("customer.table_ready")}</strong>
                <span id="waitingCustomerTableLabel">{t(row.tableLabel ? "customer.table_opened" : "customer.table_opened_default", { table: row.tableLabel || "" })}</span>
              </div>
              <a id="waitingCustomerOrderLink" href={row.orderUrl}>
                <i className="bi bi-journal-text" aria-hidden="true"></i><span>{t("customer.order_at_table")}</span>
              </a>
            </section>
          ) : null}
          <div className="waiting-customer-actions">
            {["called", "acknowledged"].includes(row.status) ? (
              <button id="waitingCustomerConfirmArrival" className="waiting-customer-confirm" type="button" disabled={busy !== "" || row.customerResponse === "on_the_way"} onClick={confirmArrival}>
                <i className="bi bi-geo-alt" aria-hidden="true"></i><span>{row.customerResponse === "on_the_way" ? t("customer.confirm_arrival_done") : t("customer.confirm_arrival")}</span>
              </button>
            ) : null}
            <button id="waitingCustomerNotification" className="waiting-customer-notification" type="button" disabled={busy !== "" || notificationEnabled} onClick={enableNotifications}>
              <i className="bi bi-bell" aria-hidden="true"></i><span>{notificationEnabled ? t("customer.notification_enabled") : t("customer.notification_enable")}</span>
            </button>
            {row.active ? (
              <button id="waitingCustomerCancelQueue" className="waiting-customer-cancel" type="button" disabled={busy !== "" || row.customerResponse === "cancel_requested"} onClick={cancelQueue}>
                <i className="bi bi-x-circle" aria-hidden="true"></i><span>{row.customerResponse === "cancel_requested" ? t("customer.cancel_requested") : t("customer.cancel_queue")}</span>
              </button>
            ) : null}
          </div>

          <footer className="waiting-customer-note">
            <i className="bi bi-info-circle" aria-hidden="true"></i>
            <span>{t("customer.browser_note")}</span>
            <span id="waitingCustomerUpdated" className="waiting-customer-updated">{updatedText}</span>
          </footer>
        </section>
      ) : null}
    </main>
  );
}
