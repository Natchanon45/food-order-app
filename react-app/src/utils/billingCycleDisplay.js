// Pure display helper for authoritative SERVER-computed anniversary cycles.
// Keep year in Gregorian 2026 for explicit dd/mm/yyyy billing contract.
function validDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function formatBillingCycleRange(startDate, endDate) {
  if (!validDateKey(startDate) || !validDateKey(endDate) || endDate < startDate) return "";
  const display = key => {
    const [y, m, d] = key.split("-");
    return Number(d) + "/" + Number(m) + "/" + y;
  };
  return display(startDate) + " - " + display(endDate);
}
