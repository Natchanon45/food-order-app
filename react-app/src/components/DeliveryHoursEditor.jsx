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
        <strong>{t("admin.opening_hours.temporary_title")}</strong>
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
        <div className="admin-delivery-hours-actions">
          <button type="button" className="btn btn-primary" disabled={busy} data-manual-open
            onClick={() => onApplyManual({ mode: "open", reason, until })}>
            <i className="bi bi-door-open app-icon" aria-hidden="true"></i><span>{t("admin.opening_hours.force_open")}</span>
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} data-manual-close
            onClick={() => onApplyManual({ mode: "closed", reason, until })}>
            <i className="bi bi-door-closed app-icon" aria-hidden="true"></i><span>{t("admin.opening_hours.force_close")}</span>
          </button>
          <button type="button" className="btn" disabled={busy} data-manual-auto
            onClick={() => onApplyManual({ mode: "auto", reason: "", until: "" })}>
            <i className="bi bi-arrow-counterclockwise app-icon" aria-hidden="true"></i><span>{t("admin.opening_hours.use_schedule")}</span>
          </button>
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
        {SHOP_WEEKDAYS.map((day, index) => {
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
