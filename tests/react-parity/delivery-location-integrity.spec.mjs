import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validDeliveryLocation, validatedGpsFix, nearestSavedAddress, matchGpsSavedAddress } from "../../react-app/src/utils/deliveryLocationPolicy.js";
import { mapPinPixel } from "../../react-app/src/utils/mapPinProjection.js";

const page = fs.readFileSync("react-app/src/pages/DeliveryPage.jsx", "utf8");
const picker = fs.readFileSync("react-app/src/components/DeliveryLocationPicker.jsx", "utf8");
const translations = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));

test("coordinate validation rejects null/empty/zero-zero, preserves nearby but distinct points", () => {
  const saved = { latitude: 13.756331, longitude: 100.501762 };
  const nearbyGps = { latitude: 13.75654, longitude: 100.501762 };
  assert.deepEqual(validDeliveryLocation(saved), saved);
  assert.deepEqual(validDeliveryLocation(nearbyGps), nearbyGps);
  assert.notDeepEqual(validDeliveryLocation(nearbyGps), validDeliveryLocation(saved));
  for (const bad of [
    null, {}, { latitude: null, longitude: 100.5 },
    { latitude: " ", longitude: 100.5 },
    { latitude: 0, longitude: 0 },
    { latitude: Infinity, longitude: 100.5 },
    { latitude: -91, longitude: 100.5 },
    { latitude: 13, longitude: 200 },
  ]) assert.equal(validDeliveryLocation(bad), null);
});

test("nearest saved selection: close ties, 100m threshold, map override, and invalid pins", () => {
  const gps = { latitude: 13.756331, longitude: 100.501762 };
  const saved = [
    { id: "far", latitude: 13.765, longitude: 100.501762 },
    { id: "nearest", latitude: 13.75638, longitude: 100.501763 },
    { id: "second", latitude: 13.7566, longitude: 100.501762 },
    { id: "invalid", latitude: null, longitude: null },
  ];
  const match = nearestSavedAddress(saved, gps);
  assert.equal(match?.address?.id, "nearest");
  assert.ok(match?.meters > 0 && match?.meters < 100);
  assert.equal(matchGpsSavedAddress(saved, gps, "current-location")?.address?.id, "nearest");
  assert.equal(matchGpsSavedAddress(saved, gps, "map"), null);
  assert.equal(matchGpsSavedAddress(saved, gps, "manual"), null);
  assert.equal(nearestSavedAddress([{ id: "far", latitude: 13.765, longitude: 100.501762 }], gps), null);
  assert.equal(nearestSavedAddress(saved, { latitude: 0, longitude: 0 }), null);
});

test("GPS accepts fresh accurate fixes but rejects coarse readings and invalid coordinates", () => {
  const accurate = { latitude: 13.75654, longitude: 100.501762, accuracy: 11.7 };
  assert.deepEqual(validatedGpsFix(accurate), { point: { latitude: 13.75654, longitude: 100.501762 }, accuracy: 12 });
  assert.equal(validatedGpsFix({ ...accurate, accuracy: 100 }).point.latitude, accurate.latitude);
  assert.deepEqual(validatedGpsFix({ ...accurate, accuracy: 350 }), { point: null, accuracy: 350 });
  assert.deepEqual(validatedGpsFix({ ...accurate, accuracy: undefined }), { point: null, accuracy: null });
  assert.equal(validatedGpsFix({ ...accurate, longitude: "" }).point, null);
  assert.equal(validatedGpsFix({ ...accurate, accuracy: -10 }).point, null);
});

test("Laravel GPS matches the nearest saved address within 100m, but map clicks never snap", () => {
  assert.match(page, /matchGpsSavedAddress\(addresses, initialGps.point, "current-location"\)/);
  assert.match(page, /matchGpsSavedAddress\(profile.addresses \|\| \[\], next, source\)/);
  assert.match(page, /if \(nearest\) \{[\s\S]*?selectAddress\(nearest.address\)/);
  const resolver = page.slice(page.indexOf("const resolveDeliveryLocation ="), page.indexOf("const persistProfile ="));
  assert.match(resolver, /setDeliveryLocation\(next\)/);
  assert.ok(resolver.includes('setSelectedAddressId("")'));
  assert.match(resolver, /source === "current-location"/);
});

test("selecting saved address replaces active coordinate including invalid pin and map pans to chosen marker", () => {
  const select = page.slice(page.indexOf("const selectAddress ="), page.indexOf("const resolveDeliveryLocation ="));
  assert.match(select, /setDeliveryLocation\(location\)/);
  assert.match(select, /setLocationConfirmed\(false\)/);
  assert.match(picker, /map\.panTo\(position\)/);
  assert.match(picker, /marker\.setPosition\(position\)/);
});

test("editing or creating saved address owns a separate map pin, never borrows the active checkout pin", () => {
  const save = page.slice(page.indexOf("const saveAddress ="), page.indexOf("const deleteAddress ="));
  assert.match(save, /const addressPin = normalizeLocation\(addressEditor\)/);
  assert.match(save, /latitude: addressPin\.latitude, longitude: addressPin\.longitude/);
  assert.doesNotMatch(save, /latitude: deliveryLocation\.latitude/);
  assert.match(page, /idPrefix="savedAddress"/);
  assert.match(page, /onChange=\{point => setAddressEditor\(current => current \? \{ \.\.\.current, \.\.\.point \}/);
  assert.match(page, /id="addAddressButton"/);
  const add = page.match(/id="addAddressButton"[^\n]*/)?.[0] || "";
  assert.doesNotMatch(add, /\.\.\.deliveryLocation/);
  assert.match(picker, /const mapId = idPrefix === "delivery"/);
});

test("checkout never silently writes the submitted pin into saved profile after successful order", () => {
  assert.match(page, /await createPublicDeliveryOrder\(tenant, payload/);
  const submitted = page.slice(page.indexOf("await createPublicDeliveryOrder(tenant, payload"), page.indexOf("// Replace the submitted checkout history entry"));
  assert.doesNotMatch(submitted, /persistProfile\(|saveDeliveryCustomerProfile\(|latitude: deliveryLocation\.latitude/);
  assert.match(submitted, /saved-address coordinates as a side effect/);
});

test("GPS never uses stale geolocation and never accepts coarse coordinates; locked map listeners are blocked", () => {
  assert.match(picker, /validatedGpsFix\(position\.coords\)/);
  assert.match(picker, /maximumAge: 0/);
  assert.match(picker, /enableHighAccuracy: true/);
  assert.match(picker, /onUncertain\?\.\(\)/);
  assert.match(picker, /if \(disabledRef\.current \|\| !event\.latLng\) return/);
  assert.match(picker, /markerRef\.current\?\.setDraggable\(!disabled\)/);
});

test("delivery checkout requires explicit pin confirmation and all locales contain instructions", () => {
  assert.match(page, /if \(!locationConfirmed\) \{ showStorefrontToast/);
  assert.match(page, /id="deliveryPinConfirmed" type="checkbox"/);
  assert.match(page, /setLocationConfirmed\(false\)/);
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    const values = translations[locale]?.delivery?.checkout?.address || {};
    for (const key of ["saved_pin_help", "saved_pin_required", "confirm_pin_label", "confirm_pin_required", "gps_accuracy", "gps_low_accuracy"]) {
      assert.ok(values[key], `${locale} missing ${key}`);
    }
    assert.ok(values.gps_accuracy.includes(":meters"));
  }
});

test("Google Maps marker always reflects the saved pin even when profile/GPS arrives during map initialization", () => {
  assert.match(picker, /const locationRef = useRef\(null\)/);
  assert.match(picker, /locationRef\.current = normalized/);
  assert.match(picker, /const selected = validLocation\(locationRef\.current\)/);
  assert.match(picker, /zoom: selected \? 16 : 11/);
  assert.match(picker, /\[value\?\.latitude, value\?\.longitude, mapState, syncVisiblePin\]/);
  assert.match(picker, /if \(!next\) \{\s*marker\.setMap\(null\)/);
  assert.match(picker, /marker\.setPosition\(position\)/);
  assert.match(picker, /marker\.setMap\(map\)/);
  assert.match(picker, /map\.panTo\(position\)/);
  assert.match(picker, /map\.setZoom\(Math\.max\(Number\(map\.getZoom\(\) \|\| 0\), 16\)\)/);
  assert.match(picker, /applyRef\.current\(\{ latitude: event\.latLng\.lat\(\)/);
});

test("saved addresses finish loading before initial GPS starts, and unmatched GPS requires explicit location verification", () => {
  assert.match(page, /if \(!tenant\?\.id \|\| profileLoading \|\| initialGpsRequestedForTenantRef\.current === tenant\.id\)/);
  assert.match(page, /id="deliveryPinConfirmed"/);
  assert.match(page, /className="delivery-location-verify-notice"/);
  assert.match(page, /no_nearby_saved_confirm/);
  for(const locale of ["th","en","my","lo","km"]) {
    const a=translations[locale].delivery.checkout.address;
    assert.ok(a.no_nearby_saved_confirm && a.gps_saved_fallback_notice);
  }
});

test("visible Google Maps-independent pin follows exact coordinates when map pans/zooms", () => {
  const a = { latitude: 13.756331, longitude: 100.501762 };
  assert.deepEqual(mapPinPixel(a, a, 16, 400, 280), { x: 200, y: 140 });
  const east = mapPinPixel({ ...a, longitude: a.longitude + 0.001 }, a, 16, 400, 280);
  assert.ok(east.x > 200 && Math.abs(east.y - 140) < 1);
  const north = mapPinPixel({ ...a, latitude: a.latitude + 0.001 }, a, 16, 400, 280);
  assert.ok(north.y < 140);
  assert.equal(mapPinPixel(a, a, 16, 0, 280), null);
  assert.equal(mapPinPixel(a, a, 16, 400, 0), null);
  const wrap = mapPinPixel({ latitude: 0, longitude: -179.999 }, { latitude: 0, longitude: 179.999 }, 13, 400, 280);
  assert.ok(wrap.x > 200 && wrap.x < 400);
  assert.match(picker, /ref=\{visiblePinRef\}/);
  assert.match(picker, /delivery-location-visible-pin/);
  assert.match(picker, /for \(const event of \["center_changed", "zoom_changed", "idle"\]\)/);
  assert.match(picker, /window\.requestAnimationFrame\(syncVisiblePin\)/);
  // A valid coordinate alone is not enough: Google Maps must be ready and
  // projection must succeed before the fallback pin becomes visible.
  assert.match(picker, /hidden=\{!normalized \|\| mapState !== "ready"\}/);
  assert.match(picker, /overlay\.style\.visibility = overlay\.hidden \? "hidden" : "visible"/);
});
