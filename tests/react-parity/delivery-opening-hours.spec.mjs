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
  assert.match(editor,/data-manual-close/);
  assert.match(editor,/data-manual-open/);
  assert.match(editor,/data-manual-auto/);
  assert.match(editor,/type="time"/);
});

test("Delivery shows live banner and blocks both adding and submitting while closed", () => {
  assert.match(page,/watchPublicStoreSettings\(tenant, updated =>/);
  assert.match(page,/window.setInterval\(\(\) => setOpeningClock\(Date.now\(\)\), 15000\)/);
  assert.match(page,/id="deliveryStoreClosed"/);
  assert.match(page,/onAdd=\{add\} disabled=\{submitting \|\| locked \|\| !storeAcceptingOrders\}/);
  assert.match(page,/disabled=\{!tenant \|\| !cart.length \|\| submitting \|\| !storeAcceptingOrders\}/);
  assert.match(page,/await checkDeliveryStoreIsOpen\(tenant\)/);
});

test("Delivery transaction rechecks status atomically when admin closes mid-order", () => {
  assert.match(catalog,/getDocFromServer\(tenantDocument\(tenant, "settings", "store"\)\)/);
  assert.match(catalog,/await runTransaction\(db, async transaction => \{/);
  assert.match(catalog,/if \(!getDeliveryOpeningStatus\(settingsSnapshot.data\(\)\).open\) throw new Error\("DELIVERY_STORE_CLOSED"\)/);
  assert.match(catalog,/transaction.set\(tenantDocument\(tenant, "orders", id\)/);
});

test("opening-hour labels are available in all five supported languages", () => {
  for(const locale of ["th","en","my","lo","km"]){
    const a=translations[locale]?.admin?.opening_hours;
    const d=translations[locale]?.delivery?.opening_hours;
    assert.ok(a && d,locale);
    for(const key of ["title","temporary_title","force_open","force_close","day_0","day_1","day_6","open","close","until","reason","enable_schedule"])
      assert.ok(a[key],locale+" "+key);
    for(const key of ["closed_title","outside_hours","closed_day","order_unavailable"])assert.ok(d[key],locale+" "+key);
  }
});
