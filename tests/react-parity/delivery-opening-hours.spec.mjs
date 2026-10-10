import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  defaultDeliveryHours, normalizeDeliveryHours, normalizeManualStoreStatus,
  bangkokClock, getDeliveryOpeningStatus,
} from "../../react-app/src/utils/deliveryOpeningHours.js";

const atThai = (day, time) => new Date(day + "T" + time + "+07:00");
const monday = "2026-10-12";
const tuesday = "2026-10-13";
const timetable = { enabled: true, days: defaultDeliveryHours().days.map(row => ({
  ...row, enabled: row.day === 1, open: "09:00", close: "18:00",
})) };
const page = fs.readFileSync("react-app/src/pages/DeliveryPage.jsx", "utf8");
const admin = fs.readFileSync("react-app/src/pages/AdminPage.jsx", "utf8");
const catalog = fs.readFileSync("react-app/src/data/publicStorefrontData.js", "utf8");
const translations = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));

test("existing tenants without configured hours remain open (migration safe)", () => {
  assert.equal(getDeliveryOpeningStatus({}, atThai(monday, "03:00")).open, true);
  assert.equal(getDeliveryOpeningStatus({deliveryHours:defaultDeliveryHours()}, atThai(monday, "03:00")).open, true);
});

test("Bangkok clock and weekday are independent of browser timezone", () => {
  assert.deepEqual(bangkokClock(atThai(monday, "09:45")), { day: 1, minutes: 585, dateTime: monday + "T09:45" });
  assert.equal(bangkokClock(atThai(tuesday, "00:01")).day, 2);
});

test("weekday selection and time opening/closing boundaries use shop timezone", () => {
  assert.equal(getDeliveryOpeningStatus({deliveryHours:timetable}, atThai(monday, "08:59")).open, false);
  assert.equal(getDeliveryOpeningStatus({deliveryHours:timetable}, atThai(monday, "09:00")).open, true);
  assert.equal(getDeliveryOpeningStatus({deliveryHours:timetable}, atThai(monday, "17:59")).open, true);
  assert.equal(getDeliveryOpeningStatus({deliveryHours:timetable}, atThai(monday, "18:00")).open, false);
  assert.equal(getDeliveryOpeningStatus({deliveryHours:timetable}, atThai(tuesday, "10:00")).reason, "closed_day");
});

test("overnight hours remain open past midnight into next day", () => {
  const hours=normalizeDeliveryHours(timetable);
  hours.days.find(row=>row.day===1).open="20:00";
  hours.days.find(row=>row.day===1).close="02:00";
  assert.equal(getDeliveryOpeningStatus({deliveryHours:hours}, atThai(monday,"19:59")).open,false);
  assert.equal(getDeliveryOpeningStatus({deliveryHours:hours}, atThai(monday,"20:00")).open,true);
  assert.equal(getDeliveryOpeningStatus({deliveryHours:hours}, atThai(tuesday,"01:59")).open,true);
  assert.equal(getDeliveryOpeningStatus({deliveryHours:hours}, atThai(tuesday,"02:00")).open,false);
});

test("manual close overrides scheduled opening until reopened or expiry", () => {
  const settings={deliveryHours:timetable,deliveryManualStatus:{mode:"closed",reason:"Repairs",until:monday+"T11:00"}};
  const status=getDeliveryOpeningStatus(settings, atThai(monday,"10:00"));
  assert.equal(status.open,false);
  assert.equal(status.reason,"manual");
  assert.equal(status.message,"Repairs");
  assert.equal(getDeliveryOpeningStatus(settings,atThai(monday,"11:00")).open,true);
  assert.equal(getDeliveryOpeningStatus({...settings,deliveryManualStatus:{mode:"auto"}},atThai(monday,"10:00")).open,true);
});

test("manual open can open a normally closed day, with expiry", () => {
  const settings={deliveryHours:timetable,deliveryManualStatus:{mode:"open",until:tuesday+"T12:00"}};
  assert.equal(getDeliveryOpeningStatus(settings,atThai(tuesday,"10:00")).open,true);
  assert.equal(getDeliveryOpeningStatus(settings,atThai(tuesday,"12:00")).open,false);
  assert.equal(normalizeManualStoreStatus({mode:"closed",reason:"x".repeat(500)}).reason.length,180);
});

test("Admin manages days and immediate close without overwriting weekly settings", () => {
  assert.match(admin,/data-delivery-hours-editor|<DeliveryHoursEditor/);
  assert.match(admin,/setDeliveryHours\(normalizeDeliveryHours\(s.deliveryHours\)\)/);
  assert.match(admin,/saveAdminStoreSettings\(tenant.id, \{ deliveryManualStatus: normalized \}\)/);
  assert.match(admin,/deliveryHours: normalizeDeliveryHours\(deliveryHours\)/);
  const editor=fs.readFileSync("react-app/src/components/DeliveryHoursEditor.jsx","utf8");
  assert.match(editor,/className="admin-delivery-hours-override-header"/);
  assert.match(editor,/className="admin-delivery-hours-header-controls"/);
  assert.match(editor,/data-manual-toggle type="checkbox" role="switch"/);
  assert.match(editor,/checked=\{status.open\} disabled=\{busy\}/);
  assert.match(editor,/mode: event.target.checked \? "open" : "closed", reason, until/);
  assert.match(editor,/data-manual-auto/);
  assert.doesNotMatch(editor,/data-manual-open|data-manual-close/);
  assert.match(editor,/type="time"/);
});

test("Delivery shows live banner and blocks both adding and submitting while closed", () => {
  assert.match(page,/watchPublicStoreSettings\(tenant, updated =>/);
  assert.match(page,/window.setInterval\(\(\) => setOpeningClock\(Date.now\(\)\), 15000\)/);
  assert.match(page,/id="deliveryStoreClosed"/);
  assert.match(page,/onAdd=\{add\} disabled=\{submitting \|\| locked \|\| !storeAcceptingOrders\}/);
  assert.match(page,/disabled=\{!tenant \|\| !cart.length \|\| submitting \|\| !storeAcceptingOrders \|\| !selectedAddressId/);
  assert.match(page,/await checkDeliveryStoreIsOpen\(tenant\)/);
});

test("Delivery performs pre-payment read and submits to authoritative server-side transaction", () => {
  assert.match(catalog,/getDocFromServer\(tenantDocument\(tenant, "settings", "store"\)\)/);
  assert.match(catalog,/await submitPublicDeliveryOrder\(\{/);
  const source = fs.readFileSync("functions/public-delivery-submit.js", "utf8");
  assert.match(source,/return db.runTransaction\(async transaction => \{/);
  assert.match(source,/const store = settingsSnap.data\(\) \|\| \{\}/);
  assert.match(source,/!getDeliveryOpeningStatus\(store, new Date\(\)\).open/);
  assert.match(source,/transaction.create\(orderRef,/);
});

test("opening-hour labels are available in all five supported languages", () => {
  for(const locale of ["th","en","my","lo","km"]){
    const a=translations[locale]?.admin?.opening_hours;
    const d=translations[locale]?.delivery?.opening_hours;
    assert.ok(a && d,locale);
    for(const key of ["title","temporary_title","switch_on","switch_off","use_schedule_short","day_0","day_1","day_6","open","close","until","reason","enable_schedule"])
      assert.ok(a[key],locale+" "+key);
    for(const day of [0,1,2,3,4,5,6])
      assert.ok(a["day_"+day].length >= (locale === "en" ? 6 : 3),locale+" day_"+day);
    if (locale === "th") {
      assert.equal(a.day_1,"จันทร์");
      assert.equal(a.day_4,"พฤหัสบดี");
      assert.equal(a.day_0,"อาทิตย์");
    }
    if (locale === "en") {
      assert.equal(a.day_1,"Monday");
      assert.equal(a.day_2,"Tuesday");
      assert.equal(a.day_0,"Sunday");
    }
    for(const key of ["closed_title","outside_hours","closed_day","order_unavailable"])assert.ok(d[key],locale+" "+key);
  }
});
