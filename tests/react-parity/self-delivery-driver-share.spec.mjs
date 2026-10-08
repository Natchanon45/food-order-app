import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isSelfDeliveryOrder,
  deliveryDriverDestination,
  deliveryDriverMapsUrl,
} from "../../react-app/src/utils/deliveryDriverShare.js";

const cashier = fs.readFileSync("react-app/src/pages/CashierPage.jsx", "utf8");
const css = fs.readFileSync("react-app/public/parity/css/cashier-refresh.css", "utf8");
const dictionaries = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));

const store = { latitude: 13.845, longitude: 100.62 };

const order = {
  id: "delivery-123", queueNo: "D-023",
  orderType: "delivery", deliveryProvider: "self",
  deliveryLatitude: 13.756331, deliveryLongitude: 100.501762,
  deliveryAddress: "Bangkok, Thailand",
};

test("self-delivery only: Lalamove and unknown providers never receive driver links", () => {
  assert.equal(isSelfDeliveryOrder(order), true);
  assert.equal(isSelfDeliveryOrder({ ...order, deliveryProvider: "SELF" }), true);
  assert.equal(isSelfDeliveryOrder({ ...order, deliveryProvider: "lalamove" }), false);
  assert.equal(isSelfDeliveryOrder({ ...order, deliveryProvider: "self", lalamoveOrderId: "job-1" }), false);
  assert.equal(isSelfDeliveryOrder({ ...order, deliveryProvider: "third_party" }), false);
  assert.equal(isSelfDeliveryOrder({ ...order, orderType: "takeaway" }), false);
  assert.equal(isSelfDeliveryOrder({ ...order, deliveryProvider: undefined }), true);
  assert.equal(isSelfDeliveryOrder({ ...order, deliveryProvider: "", lalamoveOrderId: "job-1" }), false);
  assert.equal(isSelfDeliveryOrder({ ...order, deliveryProvider: "", lalamoveQuotationId: "quote-1" }), false);
  assert.equal(isSelfDeliveryOrder({ ...order, deliveryProvider: "", lalamoveDispatchQuote: { quotationId: "quote-1" } }), false);
  assert.equal(deliveryDriverMapsUrl({ ...order, deliveryProvider: "lalamove" }, store), "");
});

test("maps link uses the order's precise coordinates and Google Maps driving directions", () => {
  const url = deliveryDriverMapsUrl(order, store);
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://www.google.com");
  assert.equal(parsed.pathname, "/maps/dir/");
  assert.equal(parsed.searchParams.get("api"), "1");
  assert.equal(parsed.searchParams.get("destination"), "13.7563310,100.5017620");
  assert.equal(parsed.searchParams.get("origin"), "13.8450000,100.6200000");
  assert.equal(parsed.searchParams.get("travelmode"), "driving");
  assert.equal(parsed.searchParams.get("dir_action"), "navigate");
  assert.ok(!url.includes("recipientPhone"));
  assert.deepEqual(deliveryDriverDestination(order), { latitude: 13.756331, longitude: 100.501762 });
  assert.equal(deliveryDriverMapsUrl({ ...order, deliveryLatitude: "13.756331", deliveryLongitude: "100.501762" }, store), url);
});

test("missing, malformed, and zero-zero locations cannot generate a misleading driver link", () => {
  assert.equal(deliveryDriverMapsUrl(order, null), "");
  assert.equal(deliveryDriverMapsUrl(order, { latitude: null, longitude: null }), "");
  assert.equal(deliveryDriverMapsUrl(order, { latitude: 0, longitude: 0 }), "");
  assert.equal(deliveryDriverMapsUrl(order, { latitude: "bad", longitude: "bad" }), "");
  for (const patch of [
    { deliveryLatitude: null }, { deliveryLongitude: undefined },
    { deliveryLatitude: "" }, { deliveryLongitude: " " },
    { deliveryLatitude: "not-a-coordinate" },
    { deliveryLatitude: 99 }, { deliveryLongitude: 181 },
    { deliveryLatitude: 0, deliveryLongitude: 0 },
    { deliveryLongitude: Infinity }, { deliveryLatitude: NaN },
  ]) {
    assert.equal(deliveryDriverMapsUrl({ ...order, ...patch }, store), "", JSON.stringify(patch));
  }
});

test("Cashier renders separate, responsive driver controls only in self-delivery card", () => {
  assert.match(cashier, /const selfDelivery = isSelfDeliveryOrder\(order\)/);
  assert.match(cashier, /getOperationalStoreSettings\(tenant.id\)/);
  assert.match(cashier, /deliveryDriverMapsUrl\(order, storeLocation\)/);
  assert.match(cashier, /!storeLocation \? "cashier.delivery.driver_missing_store_location"/);
  assert.match(cashier, /storeLocation=\{storeLocation\}/);
  assert.match(cashier, /selfDelivery \? <div className="cashier-driver-panel"/);
  assert.match(cashier, /href=\{driverMapsUrl\} target="_blank" rel="noopener noreferrer"/);
  assert.match(cashier, /data-driver-share-button onClick=\{\(\) => onShareDriver\(order\)\}/);
  assert.match(cashier, /disabled=\{!driverMapsUrl\}/);
  assert.match(cashier, /onShareDriver=\{shareDriverLocation\}/);
  assert.match(css, /\.cashier-page \.cashier-driver-actions \{[\s\S]*?flex-wrap: wrap;[\s\S]*?gap: 8px;/);
  assert.match(css, /\.cashier-page \.cashier-driver-actions \.btn \{[\s\S]*?gap: 8px;[\s\S]*?min-height: 40px;/);
});

test("sharing keeps address/order information scoped and respects cancellation and copy fallback", () => {
  assert.match(cashier, /navigator\.share\(\{ title, text: message, url \}\)/);
  assert.match(cashier, /if \(error\?\.name === "AbortError"\) return/);
  assert.match(cashier, /navigator\.clipboard\.writeText\(message \+ "\\n" \+ url\)/);
  assert.match(cashier, /await sweetPrompt\(t\("cashier\.delivery\.driver_share_copy_help"\), url,/);
  assert.ok(!cashier.includes("navigator.geolocation.getCurrentPosition"));
});

test("driver-share UI and copied directions are localized for all five languages", () => {
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    const messages = dictionaries[locale]?.cashier?.delivery || {};
    for (const name of [
      "driver_location_title", "driver_open_maps", "driver_share",
      "driver_verify_pin", "driver_missing_coordinates",
      "driver_share_title", "driver_share_message", "driver_share_copied",
      "driver_share_copy_help", "driver_missing_store_location",
    ]) assert.ok(messages[name], `${locale} missing ${name}`);
    assert.ok(messages.driver_share_message.includes(":queue"));
    assert.ok(messages.driver_share_message.includes(":address"));
  }
});
