import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const report = fs.readFileSync("react-app/src/pages/RevenueShareReportPage.jsx", "utf8");
const platform = fs.readFileSync("react-app/src/pages/PlatformPage.jsx", "utf8");
const component = fs.readFileSync("react-app/src/components/PlatformReceiverBankSelect.jsx", "utf8");
const locale = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));

test("Zero-balance periods explain why slips cannot be submitted", () => {
  // A stale API response may still include a prepaid Lalamove debit gap in
  // platformAmountDue. Only earned revenue share may enable a payment slip.
  assert.match(report, /const platformSharePayable = Math\.round\(Math\.max\(0, Number\(summary\.deliveryShareAmount \|\| 0\)\) \* 100\) \/ 100/);
  assert.match(report, /const noAmountDue = !loading && billingSummaryReady && paymentSharePayable <= 0/);
  assert.match(report, /const platformSharePayable = Math\.round\(Math\.max\(0, Number\(summary\.deliveryShareAmount \|\| 0\)\) \* 100\) \/ 100/);
  assert.match(report, /report\.billingSummary\?\.deliveryShareAmount/);
  assert.match(report, /const canSubmit = access\?\.enabled === true && !loading && billingSummaryReady/);
  assert.doesNotMatch(report, /const noAmountDue = !loading && Number\(summary\.platformAmountDue/);
  assert.match(report, /id="platformAmountDue">\{money\(platformSharePayable\)\}/);
  assert.match(report, /id="paymentAmountDue">\{money\(paymentSharePayable\)\}/);
  assert.match(report, /&& !noAmountDue && cycleMatches && !uploading/);
  assert.match(report, /noAmountDue \? t\("revenue_share_report\.payment\.no_amount_due"\)/);
  assert.match(report, /if \(!canSubmit\) \{/);
  assert.match(report, /disabled=\{!canSubmit\} onChange=\{onSlipChange\}/);
  assert.match(report, /id="submitRevenueShareSlip" type="submit" disabled=\{!canSubmit\}/);
  assert.match(report, /paymentUnavailableMessage \? <div/);
  assert.match(report, /aria-describedby="revenueSharePaymentMessage"/);
  assert.match(report, /submitRevenueSharePayment\(tenant\.id, periodPayload, slip\)/);
});

test("Platform receiver selection uses a paginated, keyboard accessible searchable combobox", () => {
  assert.match(platform, /<PlatformReceiverBankSelect/);
  assert.match(platform, /id="platformSlip2GoReceiverAccountType"/);
  assert.match(platform, /onChange=\{accountType => setSlip\(current => \(\{ \.\.\.current, receiver: \{ \.\.\.current\.receiver, accountType \} \}\)\)\}/);
  assert.doesNotMatch(platform, /<select[^>]+id="platformSlip2GoReceiverAccountType"/);
  assert.match(component, /RECEIVER_BANK_PAGE_SIZE = 12/);
  assert.match(component, /role="combobox"/);
  assert.match(component, /role="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /event\.key === "ArrowDown"/);
  assert.match(component, /event\.key === "Enter"/);
  assert.match(component, /onScroll=\{onListScroll\}/);
  assert.match(component, /onClick=\{loadMore\}/);
  assert.match(component, /onChange\(bankCode\)/);
});

test("Zero-payment and bank paging messages exist in TH EN MY LO KM", () => {
  for (const language of ["th", "en", "my", "lo", "km"]) {
    const pay = locale[language].revenue_share_report.payment.no_amount_due;
    const more = locale[language].platform.slip_verification.receiver_load_more;
    assert.ok(typeof pay === "string" && pay.length > 20, language);
    assert.ok(typeof more === "string" && more.length > 3, language);
    const banks = locale[language].platform.slip_verification.receiver_account_types;
    assert.equal(Object.keys(banks).length, 35, language);
    assert.ok(Object.prototype.hasOwnProperty.call(banks, "01014"), language);
    assert.ok(Object.prototype.hasOwnProperty.call(banks, ""), language);
  }
});

test("Platform React does not restore jQuery/Select2 and existing credential saver stays unchanged", () => {
  assert.ok(!platform.includes("window.jQuery"));
  assert.ok(!platform.includes("select2"));
  assert.match(platform, /const receiverTypes = raw\("platform\.slip_verification\.receiver_account_types"\) \|\| \{\}/);
  assert.match(platform, /savePlatformSlipVerification\(/);
  assert.match(platform, /receiverAccountType: receiver\.accountType \|\| ""/);
});
