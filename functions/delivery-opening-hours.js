const SHOP_TIMEZONE = "Asia/Bangkok";
const SHOP_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minute = text => {
  if (!HHMM.test(String(text || ""))) return null;
  const [hour, minute] = text.split(":").map(Number);
  return hour * 60 + minute;
};
const defaultDeliveryHours = () => ({
  enabled: false,
  days: SHOP_WEEKDAYS.map(day => ({ day, enabled: true, open: "09:00", close: "21:00" })),
});
function normalizeDeliveryHours(input) {
  const source = input && typeof input === "object" ? input : {};
  const days = Array.isArray(source.days) ? source.days : [];
  return {
    enabled: source.enabled === true,
    days: SHOP_WEEKDAYS.map(day => {
      const value = days.find(row => Number(row?.day) === day) || {};
      return { day, enabled: value.enabled !== false,
        open: HHMM.test(String(value.open || "")) ? value.open : "09:00",
        close: HHMM.test(String(value.close || "")) ? value.close : "21:00" };
    }),
  };
}
function normalizeManualStoreStatus(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    mode: ["open", "closed"].includes(source.mode) ? source.mode : "auto",
    reason: String(source.reason || "").trim().slice(0, 180),
    until: /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(String(source.until || ""))
      ? source.until : "",
  };
}
function bangkokClock(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const day = DAYS.indexOf(parts.weekday);
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute),
    dateTime: parts.year + "-" + parts.month + "-" + parts.day + "T" + parts.hour + ":" + parts.minute };
}
function getDeliveryOpeningStatus(settings = {}, at = new Date()) {
  const current = bangkokClock(at);
  const manual = normalizeManualStoreStatus(settings.deliveryManualStatus);
  const activeManual = manual.mode !== "auto" && (!manual.until || current.dateTime < manual.until);
  if (activeManual) return {
    open: manual.mode === "open", reason: manual.mode === "closed" ? "manual" : "forced_open",
    message: manual.reason, until: manual.until, mode: manual.mode,
  };
  const hours = normalizeDeliveryHours(settings.deliveryHours);
  if (!hours.enabled) return { open: true, reason: "legacy", mode: "auto", message: "" };
  const today = hours.days.find(row => row.day === current.day);
  const previous = hours.days.find(row => row.day === (current.day + 6) % 7);
  // Yesterday's overnight shift must remain open after midnight.
  const previousStart = minute(previous?.open);
  const previousEnd = minute(previous?.close);
  if (previous?.enabled && previousStart !== null && previousEnd !== null && previousEnd < previousStart
    && current.minutes < previousEnd) return { open: true, reason: "scheduled", mode: "auto", message: "" };
  if (today?.enabled) {
    const start = minute(today.open);
    const end = minute(today.close);
    if (start !== null && end !== null) {
      if (start === end || (start < end && current.minutes >= start && current.minutes < end)
        || (start > end && current.minutes >= start)) {
        return { open: true, reason: "scheduled", mode: "auto", message: "" };
      }
    }
  }
  return { open: false, reason: today?.enabled ? "outside_hours" : "closed_day",
    mode: "auto", message: "", days: hours.days };
}

module.exports = { SHOP_TIMEZONE, SHOP_WEEKDAYS, defaultDeliveryHours, normalizeDeliveryHours, normalizeManualStoreStatus, bangkokClock, getDeliveryOpeningStatus };
