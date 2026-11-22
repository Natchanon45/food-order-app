"use strict";
const { validDateKey, bangkokDateKey } = require('./billing-anniversary');
const MAX_CENTS = 100000000000;
const MAX_VERSIONS = 1000;
function validCents(n) {return Number.isSafeInteger(n) && n >= 100 && n <= MAX_CENTS;}
function readThresholdHistory(raw = {}) {
  const versions = raw.deliveryThresholdVersions === undefined ? [] : raw.deliveryThresholdVersions;
  if (!Array.isArray(versions) || versions.length > MAX_VERSIONS) throw Error('DELIVERY_THRESHOLD_HISTORY_INVALID');
  const baseline = Math.round(Number(raw.deliveryThreshold) * 100);
  let previous = '', lastAmount = baseline;
  for (const row of versions) {
    if (!validCents(baseline) || !row || !validCents(row.thresholdCents) || row.baselineThresholdCents !== baseline || validDateKey(row.effectiveOn) <= previous || row.thresholdCents === lastAmount) throw Error('DELIVERY_THRESHOLD_HISTORY_INVALID');
    previous = row.effectiveOn; lastAmount = row.thresholdCents;
  }
  return versions.map(({effectiveOn,thresholdCents,baselineThresholdCents})=>({effectiveOn,thresholdCents,baselineThresholdCents}));
}
function thresholdForCycle(baseline, date, versions = []) {
  validDateKey(date);
  const clean = readThresholdHistory({deliveryThreshold:baseline,deliveryThresholdVersions:versions});
  let result = baseline;
  for (const row of clean) if (row.effectiveOn <= date) result = row.thresholdCents/100;
  return result;
}
function appendThresholdVersion(raw, input, today = bangkokDateKey(new Date())) {
  const history = readThresholdHistory(raw);
  const baseline = Math.round(Number(raw.deliveryThreshold)*100);
  if (!validCents(baseline) || input?.baselineThresholdCents !== baseline) throw Error('DELIVERY_THRESHOLD_BASELINE_LOCKED');
  if (!validCents(input?.thresholdCents)) throw Error('DELIVERY_THRESHOLD_SCHEDULE_INPUT_INVALID');
  try {validDateKey(input.effectiveOn);} catch {throw Error('DELIVERY_THRESHOLD_SCHEDULE_INPUT_INVALID');}
  if (input.effectiveOn <= today || input.effectiveOn <= (history.at(-1)?.effectiveOn || '') || history.length >= MAX_VERSIONS) throw Error('DELIVERY_THRESHOLD_SCHEDULE_DATE_CONFLICT');
  if (input.thresholdCents === (history.at(-1)?.thresholdCents ?? baseline)) throw Error('DELIVERY_THRESHOLD_UNCHANGED');
  return [...history,{effectiveOn:input.effectiveOn,thresholdCents:input.thresholdCents,baselineThresholdCents:baseline}];
}
module.exports={validCents,readThresholdHistory,thresholdForCycle,appendThresholdVersion};
