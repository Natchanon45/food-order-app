import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const jsx=readFileSync("react-app/src/pages/RevenueShareReportPage.jsx","utf8");
const css=readFileSync("react-app/public/parity/css/revenue-share-report.css","utf8");
test("monthly and yearly captions use month name / year, other filters unchanged",()=>{
  assert.match(jsx,/const reportSummaryPeriodLabel = period === "monthly" \? displayMonth\(month\)/);
  assert.match(jsx,/new Intl.DateTimeFormat\(intlLocale, \{ year: "numeric", month: "long", calendar: "gregory" \}\)/);
  assert.equal(new Intl.DateTimeFormat("th-TH", {year:"numeric",month:"long",calendar:"gregory"}).format(new Date("2026-10-01T00:00:00Z")), "ตุลาคม 2026");
  assert.match(jsx,/: period === "yearly" \? String\(year\) : periodLabel/);
  assert.match(jsx,/Food sales for the selected report period, separated by channel"\)\}: \{reportSummaryPeriodLabel\}/);
  assert.match(jsx,/Calculated on eligible merchandise for the selected reporting period"\)\}: \{reportSummaryPeriodLabel\}/);
  assert.match(jsx,/const periodLabel = period === "monthly" \? monthlyReportLabel\(month\)/);
  assert.match(jsx,/getRevenueShareReport\(reportingQuery\(periodPayload\)\)/);
  assert.match(jsx,/const paymentPeriodLabel =/);
});
test("wide desktop custom inputs share filter row, mobile inherits existing stack",()=>{
  const index=css.lastIndexOf("/* 0.4.301 / Build 2026.10.31.531");
  assert.ok(index>0);
  const custom=css.slice(index);
  assert.match(custom,/@media \(min-width: 1280px\)/);
  assert.match(custom,/report-period-controls \{\s*grid-column: 3; grid-row: 1/);
  assert.match(custom,/report-filter-refresh \{\s*grid-column: 4; grid-row: 1/);
  assert.match(custom,/report-custom-period \{\s*width: 100%; min-width: 0; grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(custom,/@media \(max-width:/);
});


test("0.4.302 desktop Custom group moves left; date inputs vertically centered independent of labels", () => {
  const start = css.lastIndexOf("/* 0.4.302 / Build 2026.10.31.532");
  assert.ok(start > 0, "new desktop CSS override exists");
  const override = css.slice(start);
  assert.match(override, /@media \(min-width: 1280px\)/);
  assert.match(override, /grid-template-columns: minmax\(230px, min\(28%, 310px\)\) max-content minmax\(240px, 305px\) 36px/);
  assert.match(override, /justify-content: start/);
  assert.match(override, /report-custom-period label \{[^}]*position: relative;[^}]*display: flex;[^}]*align-items: center;[^}]*justify-content: center/s);
  assert.match(override, /report-custom-period label > span \{[^}]*position: absolute;[^}]*bottom: calc\(100% \+ 1px\)/s);
  assert.match(override, /report-custom-period label > \.input \{[^}]*height: 34px;[^}]*min-height: 34px/s);
  assert.doesNotMatch(override, /@media \(max-width:/);
});


test("0.4.303 keeps original Refresh edge and adds framed wide date group", () => {
  const start=css.lastIndexOf("/* 0.4.303 / Build 2026.10.31.533");
  assert.ok(start>0);
  const override=css.slice(start);
  assert.match(override,/@media \(min-width: 1280px\)/);
  assert.match(override,/grid-template-columns: minmax\(195px, 1fr\) max-content minmax\(310px, 345px\) 36px/);
  assert.match(override,/justify-content: stretch/);
  assert.match(override,/report-custom-period \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(override,/report-custom-period \{[^}]*border: 1px solid #c9e4d3/sg);
  assert.match(override,/report-filter-refresh \{[^}]*justify-self: end/s);
  assert.match(override,/report-custom-period label > span \{[^}]*bottom: calc\(100% \+ 7px\)/s);
  assert.doesNotMatch(override,/@media \(max-width:/);
});
