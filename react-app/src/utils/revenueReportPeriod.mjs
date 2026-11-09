// Revenue report filters use calendar dates, while actual settlements and
// threshold accumulation preserve each shop's anniversary billing policy.
const validDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function calendarMonthRange(month) {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  if (year < 2000 || year > 2200) return null;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: month + "-01", endDate: month + "-" + String(lastDay).padStart(2, "0") };
}

// The existing callable accepts a custom inclusive range without affecting
// its established monthly-anniversary invoice calculation. Never send this
// reporting query to submitTenantRevenueSharePayment.
export function reportingQuery(periodPayload = {}) {
  if (periodPayload.period !== "monthly") return periodPayload;
  const range = calendarMonthRange(periodPayload.month);
  return range ? { period: "custom", ...range } : periodPayload;
}

export function formatReportDateRange(startDate, endDate) {
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) return "";
  const ddmmyyyy = value => value.slice(8, 10) + "/" + value.slice(5, 7) + "/" + value.slice(0, 4);
  return ddmmyyyy(startDate) + " - " + ddmmyyyy(endDate);
}

export function monthlyReportLabel(month) {
  const range = calendarMonthRange(month);
  return range ? formatReportDateRange(range.startDate, range.endDate) : "";
}
