import { useState } from "react";
import {
  SHOP_WEEKDAYS, getDeliveryOpeningStatus, normalizeDeliveryHours, normalizeManualStoreStatus,
} from "@/utils/deliveryOpeningHours";

export function DeliveryHoursEditor({ t, hours, savedHours, onChange, manual, onApplyManual, busy = false }) {
  const schedule = normalizeDeliveryHours(hours);
  const override = normalizeManualStoreStatus(manual);
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const status = getDeliveryOpeningStatus({ deliveryHours: savedHours, deliveryManualStatus: override });
  const updateDay = (day, change) => onChange({
    ...schedule,
    days: schedule.days.map(row => row.day === day ? { ...row, ...change } : row),
  });
  return (
    <div className="admin-delivery-hours" data-delivery-hours-editor>
      <div className="admin-delivery-hours-live">
        <span className={"admin-delivery-hours-indicator" + (status.open ? " is-open" : " is-closed")}>
          <i className={"bi bi-" + (status.open ? "check-circle-fill" : "x-circle-fill") + " app-icon"} aria-hidden="true"></i>
          {t(status.open ? "admin.opening_hours.open_now" : "admin.opening_hours.closed_now")}
        </span>
        <span>{t("admin.opening_hours.timezone")}</span>
      </div>
      <div className="admin-delivery-hours-override">
        <div className="admin-delivery-hours-override-header">
          <strong className="admin-delivery-hours-override-title">{t("admin.opening_hours.temporary_title")}</strong>
          <div className="admin-delivery-hours-header-controls">
            <label className="admin-delivery-hours-switch" htmlFor="deliveryManualToggle"
              title={t(status.open ? "admin.opening_hours.force_close" : "admin.opening_hours.force_open")}>
              <span className="admin-delivery-hours-switch-label">
                {t(status.open ? "admin.opening_hours.switch_on" : "admin.opening_hours.switch_off")}
              </span>
              <input id="deliveryManualToggle" data-manual-toggle type="checkbox" role="switch"
                checked={status.open} disabled={busy}
                aria-label={t("admin.opening_hours.temporary_title")}
                onChange={event => onApplyManual({ mode: event.target.checked ? "open" : "closed", reason, until })} />
              <span className="admin-delivery-hours-switch-track" aria-hidden="true">
                <span className="admin-delivery-hours-switch-thumb">
                  <i className={"bi bi-" + (status.open ? "check" : "x") + " app-icon"}></i>
                </span>
              </span>
            </label>
            <button type="button" className="btn admin-delivery-hours-schedule-button"
              disabled={busy} data-manual-auto
              onClick={() => onApplyManual({ mode: "auto", reason: "", until: "" })}>
              <i className="bi bi-arrow-counterclockwise app-icon" aria-hidden="true"></i>
              <span className="admin-delivery-hours-schedule-long">{t("admin.opening_hours.use_schedule")}</span>
              <span className="admin-delivery-hours-schedule-short">{t("admin.opening_hours.use_schedule_short")}</span>
            </button>
          </div>
        </div>
        <p className="menu-category">{t("admin.opening_hours.temporary_help")}</p>
        <div className="grid grid-2">
          <label className="field">
            <span>{t("admin.opening_hours.reason")}</span>
            <input className="input" id="deliveryManualReason" maxLength={180} value={reason}
              onChange={e => setReason(e.target.value)} placeholder={t("admin.opening_hours.reason_example")} />
          </label>
          <label className="field">
            <span>{t("admin.opening_hours.until")}</span>
            <input className="input" id="deliveryManualUntil" type="datetime-local" value={until}
              onChange={e => setUntil(e.target.value)} />
          </label>
        </div>
        {override.mode !== "auto" ? <div className="admin-delivery-hours-override-status">
          <i className="bi bi-info-circle app-icon" aria-hidden="true"></i>
          <span>{t(override.mode === "closed" ? "admin.opening_hours.override_closed" : "admin.opening_hours.override_open")}
            {override.reason ? " — " + override.reason : ""}
            {override.until ? " (" + override.until.replace("T", " ") + ")" : ""}
          </span>
        </div> : null}
      </div>
      <label className="admin-delivery-hours-enable">
        <input type="checkbox" id="deliveryHoursEnabled" checked={schedule.enabled}
          onChange={e => onChange({ ...schedule, enabled: e.target.checked })} />
        <strong>{t("admin.opening_hours.enable_schedule")}</strong>
      </label>
      <p className="menu-category">{t("admin.opening_hours.schedule_help")}</p>
      <div className="admin-delivery-hours-table">
        <div className="admin-delivery-hours-head"><span>{t("admin.opening_hours.day")}</span><span>{t("admin.opening_hours.open")}</span><span>{t("admin.opening_hours.close")}</span></div>
        {SHOP_WEEKDAYS.map(day => {
          const row = schedule.days.find(item => item.day === day);
          return <div className="admin-delivery-hours-row" key={day}>
            <label className="admin-delivery-hours-day">
              <input type="checkbox" data-business-day={day} checked={row.enabled}
                onChange={e => updateDay(day, { enabled: e.target.checked })} />
              <span>{t("admin.opening_hours.day_" + day)}</span>
            </label>
            <input className="input" type="time" data-open-day={day} aria-label={t("admin.opening_hours.open") + " " + t("admin.opening_hours.day_" + day)}
              disabled={!row.enabled} value={row.open} onChange={e => updateDay(day, { open: e.target.value })} />
            <input className="input" type="time" data-close-day={day} aria-label={t("admin.opening_hours.close") + " " + t("admin.opening_hours.day_" + day)}
              disabled={!row.enabled} value={row.close} onChange={e => updateDay(day, { close: e.target.value })} />
          </div>;
        })}
      </div>
      <p className="menu-category">{t("admin.opening_hours.save_note")}</p>
    </div>
  );
}
