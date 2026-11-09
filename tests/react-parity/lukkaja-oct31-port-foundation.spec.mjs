import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=n=>readFileSync("react-app/src/pages/"+n+".jsx","utf8");
const css=n=>readFileSync("react-app/public/parity/css/"+n,"utf8");
const data=readFileSync("react-app/src/data/operationalData.js","utf8");
const lang=JSON.parse(readFileSync("react-app/src/i18n/parity-translations.json","utf8"));

test("Oct31 PENGUIN emerald Quick Order styling keeps original orders UI",()=>{
 const q=page("QuickOrderPage"),style=css("quick-order-emerald-port.css");
 assert.match(q,/"quick-order.css", "quick-order-emerald-port.css"/);
 assert.match(style,/body\.quick-order-page \.quick-menu-panel/);
 assert.match(style,/@media \(max-width: 640px\)/);
 assert.match(q,/id="quickMenuGrid"/);
});
test("Oct31 cash input selects all of previous amount",()=>{
 const q=page("QuickOrderPage");
 assert.match(q,/input\?\.focus\(\{ preventScroll: true \}\);\s*input\?\.select\(\)/);
 assert.match(q,/id="quickCashReceived"/);
});
test("Oct31 held bill delete needs confirmation before Firestore mutation",()=>{
 const q=page("QuickOrderPage");
 const chunk=q.slice(q.indexOf("const deleteHeld = async row =>"),q.indexOf("const draftPayload ="));
 assert.match(chunk,/await sweetConfirm\(/);
 assert.match(chunk,/confirmIcon: "trash"/);
 assert.match(chunk,/if \(!confirmed \|\| busy\)/);
 assert.ok(chunk.indexOf("sweetConfirm")<chunk.indexOf("releaseQuickOrderHeldBill"));
 for(const locale of ["th","en","my","lo","km"]){
  assert.ok(lang[locale].quick_order.held.delete_title);
  assert.ok(lang[locale].quick_order.held.delete_confirm);
 }
});
test("Oct31 Admin menu ordering already works in Firebase operational layer",()=>{
 assert.match(data,/function menuSort\(rows, categoryOrder/);
 assert.match(data,/categoryRank/);
 assert.match(data,/sortOrder/);
 assert.match(data,/menuSort\(docs\(menuSnap\), settings\.categoryOrder \|\| \[\]\)/);
 assert.match(page("QuickOrderPage"),/watchOperationalMenus/);
});
test("Oct31 wallet list scroll and slip card spacing scoped to Revenue Share",()=>{
 const r=page("RevenueShareReportPage"),s=css("revenue-share-wallet-scroll-port.css");
 assert.match(r,/"revenue-share-wallet-scroll-port.css"/);
 assert.match(s,/body\.order-delivery-workspace\.revenue-share-report-page/);
 assert.match(s,/#walletTransactionList \{\s*height: 340px/);
 assert.match(s,/overflow-y: auto/);
 assert.match(s,/height: 286px/);
 assert.match(s,/report-history-disclosure\[open\] > \.report-history-card/);
});
test("Oct31 Firebase auth refreshes only current customer address without unmount",()=>{
 const d=page("DeliveryPage");
 assert.match(d,/customerProfileInitialized/);
 assert.match(d,/setCustomerProfileInitialized\(true\)/);
 assert.match(d,/tenant && !customerProfileInitialized && !loadError/);
 assert.doesNotMatch(d,/tenant && profileLoading && !loadError/);
 assert.match(d,/const sequence = \+\+authSequence/);
 assert.match(d,/if \(!alive \|\| sequence !== authSequence\) return/);
 assert.match(d,/addressAuthRevision/);
 assert.match(d,/locationSourceRef\.current = ""/);
 assert.match(d,/getDeliveryCustomerProfile\(tenant, user\)/);
 assert.match(d,/getDeliveryCustomerFavorites\(tenant, user\)/);
 assert.match(d,/gpsRequestedForAddressContextRef/);
 assert.match(d,/matchGpsSavedAddress\(addresses, initialGps\.point, "current-location"\)/);
 assert.match(d,/maximumAge: 0/);
 const updating=d.slice(d.indexOf("const stop = watchDeliveryCustomerAuth"),d.indexOf("return () => { alive = false; ++authSequence"));
 assert.doesNotMatch(updating,/setCart\(/);
});
