import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validDeliveryLocation, validatedGpsFix, nearestSavedAddress, matchGpsSavedAddress } from "../../react-app/src/utils/deliveryLocationPolicy.js";

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
  assert.match(picker, /mapRef\.current\.panTo\(position\)/);
  assert.match(picker, /markerRef\.current\.setPosition\(position\)/);
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
