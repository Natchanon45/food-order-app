// No external writes: Bangkok calendar-month trial/term boundaries.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
function monthStartAfter(reference, months) {
  const bangkok = new Date(reference.getTime() + BANGKOK_OFFSET_MS);
  const y = bangkok.getUTCFullYear();
  const m = bangkok.getUTCMonth();
  const d = bangkok.getUTCDate();
  const first = new Date(Date.UTC(y, m + months, 1));
  const endDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(),
    Math.min(d, endDay)) - BANGKOK_OFFSET_MS);
}
function onboardingDates(now, planCode) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error("INVALID_ACTIVATION_DATE");
  if (!["monthly", "yearly"].includes(planCode)) throw Error("INVALID_PLAN_CODE");
  const trialEndsAt = new Date(monthStartAfter(now, 1).getTime() - 1);
  const subscriptionExpiresAt = planCode === "yearly"
    ? new Date(monthStartAfter(now, 13).getTime() - 1)
    : trialEndsAt;
  return { trialStartsAt: now, trialEndsAt, subscriptionExpiresAt };
}
module.exports = { monthStartAfter, onboardingDates };
