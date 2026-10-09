import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validDeliveryLocation, validatedGpsFix, nearestSavedAddress, matchGpsSavedAddress } from "../../react-app/src/utils/deliveryLocationPolicy.js";

const page = fs.readFileSync("react-app/src/pages/DeliveryPage.jsx", "utf8");
const picker = fs.readFileSync("react-app/src/components/DeliveryLocationPicker.jsx", "utf8");
const translations = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));
const css = fs.readFileSync("react-app/public/parity/css/delivery-location-map.css", "utf8");

test("coordinate validation rejects invalid pins and preserves distinct nearby saved/GPS locations", () => {
  const saved = { latitude: 13.756331, longitude: 100.501762 };
  const gps = { latitude: 13.75654, longitude: 100.501762 };
  assert.deepEqual(validDeliveryLocation(saved), saved);
  assert.notDeepEqual(validDeliveryLocation(gps), saved);
  for (const bad of [null, {}, { latitude: null, longitude: 100.5 }, { latitude: "", longitude: 100.5 },
    { latitude: 0, longitude: 0 }, { latitude: Infinity, longitude: 100.5 },
    { latitude: -91, longitude: 100.5 }, { latitude: 13, longitude: 200 }]) {
    assert.equal(validDeliveryLocation(bad), null);
  }
});

test("strict 100-metre radius never auto-selects a far saved address, even the sole default", () => {
  const gps = { latitude: 13.756331, longitude: 100.501762 };
  const onlyFar = [{ id: "default", isDefault: true, latitude: 13.766331, longitude: 100.501762 }];
  assert.equal(nearestSavedAddress(onlyFar, gps), null);
  assert.equal(matchGpsSavedAddress(onlyFar, gps, "current-location"), null);
  assert.equal(nearestSavedAddress([], gps), null);
  assert.equal(matchGpsSavedAddress(onlyFar, null, "current-location"), null);
  assert.equal(matchGpsSavedAddress(onlyFar, gps, "map"), null);
  const close = { id: "near", latitude: 13.75638, longitude: 100.50176 };
  assert.equal(nearestSavedAddress([...onlyFar, close], gps)?.address.id, "near");
});

test("closest of multiple saved addresses is auto-selected, irrespective of default flag", () => {
  const gps = { latitude: 13.756331, longitude: 100.501762 };
  const addresses = [
    { id: "default", isDefault: true, latitude: 13.7567, longitude: 100.501762 },
    { id: "closer", isDefault: false, latitude: 13.756345, longitude: 100.501762 },
    { id: "further", isDefault: false, latitude: 13.7578, longitude: 100.501762 },
  ];
  assert.equal(matchGpsSavedAddress(addresses, gps, "current-location")?.address.id, "closer");
  assert.equal(nearestSavedAddress(addresses, gps, 0.5), null);
});

test("GPS must be accurate and fresh before automatic saved-address matching", () => {
  const gps = { latitude: 13.75654, longitude: 100.501762, accuracy: 11.7 };
  assert.deepEqual(validatedGpsFix(gps), { point: { latitude: gps.latitude, longitude: gps.longitude }, accuracy: 12 });
  assert.equal(validatedGpsFix({ ...gps, accuracy: 100 }).point.latitude, gps.latitude);
  assert.deepEqual(validatedGpsFix({ ...gps, accuracy: 350 }), { point: null, accuracy: 350 });
  assert.equal(validatedGpsFix({ ...gps, accuracy: undefined }).point, null);
  assert.equal(validatedGpsFix({ ...gps, accuracy: -1 }).point, null);
  assert.ok(page.includes('maximumAge: 0'));
  assert.ok(page.includes('enableHighAccuracy: true'));
});

test("Delivery waits for saved addresses, never defaults to a far pin, and never uses raw GPS as checkout pin", () => {
  assert.ok(page.includes('if (!tenant?.id || profileLoading || initialGpsRequestedForTenantRef.current === tenant.id)'));
  assert.ok(page.includes('if (profileLoading || initialGps.status === "pending" || locationSourceRef.current) return;'));
  assert.ok(page.includes('matchGpsSavedAddress(addresses, initialGps.point, "current-location")'));
  assert.ok(page.includes('if (nearest) selectAddress(nearest.address);'));
  const initial = page.slice(page.indexOf('if (profileLoading || initialGps.status === "pending"'), page.indexOf('useEffect(() => () => { if (slipPreview)'));
  assert.doesNotMatch(initial, /selectAddress\(addresses\[0\]|addresses\.find\(address => address\?\.isDefault\)/);
  assert.doesNotMatch(initial, /resolveDeliveryLocation\(|setDeliveryLocation\(initialGps\.point\)/);
  assert.doesNotMatch(page, /const resolveDeliveryLocation =/);
});

test("no saved address, unmatched GPS, or denied GPS requires explicit selection or saved new address", () => {
  assert.ok(page.includes('id="deliveryAddressChoiceNotice"'));
  for (const token of ['choice_no_saved', 'choice_no_nearby', 'choice_gps_unavailable', 'choice_locating', 'choice_help']) {
    assert.ok(page.includes('delivery.checkout.address.' + token), token);
  }
  assert.ok(page.includes('id="addAddressButton"'));
  assert.ok(page.includes('id="saveAddressButton"'));
  assert.ok(page.includes('onChange={() => selectAddress(address)}'));
  assert.ok(page.includes('setAddressEditor({ id: "", label:'));
  assert.ok(page.includes('const point = normalizeLocation(address);'));
});

test("checkout does not allow free-form address text, map changes, unsaved GPS or the old confirmation checkbox", () => {
  assert.match(page, /id="deliveryAddress"[^>]*readOnly/);
  assert.ok(page.includes('disabled showCurrentLocation={false}'));
  assert.doesNotMatch(page, /id="deliveryPinConfirmed"|locationConfirmed|setLocationConfirmed/);
  assert.doesNotMatch(page, /onChange={resolveDeliveryLocation}|onUncertain=\{/);
  assert.doesNotMatch(css, /\.delivery-pin-confirm/);
});

test("checkout submission requires a valid selected Saved Address matching persistent coordinates and address text", () => {
  const validate = page.slice(page.indexOf('const validateBase = () =>'), page.indexOf('const submit = async () =>'));
  assert.ok(validate.includes('const saved = (profile.addresses || []).find(address => address.id === selectedAddressId)'));
  assert.ok(validate.includes('const point = normalizeLocation(saved)'));
  assert.ok(validate.includes('deliveryLocation.latitude !== point.latitude'));
  assert.ok(validate.includes('deliveryLocation.longitude !== point.longitude'));
  assert.ok(validate.includes('deliveryAddress.trim() !== String(saved.address || "").trim()'));
  assert.ok(validate.includes('delivery.checkout.address.saved_selection_required'));
  assert.ok(page.includes('|| !selectedAddressId || !deliveryLocation'));
  assert.ok(page.includes('await checkDeliveryStoreIsOpen(tenant)'));
  assert.ok(page.includes('await createPublicDeliveryOrder(tenant, payload'));
});

test("address editor has independent GPS and can save new pins while checkout map is read-only", () => {
  const save = page.slice(page.indexOf('const saveAddress ='), page.indexOf('const deleteAddress ='));
  assert.ok(save.includes('const addressPin = normalizeLocation(addressEditor)'));
  assert.ok(save.includes('latitude: addressPin.latitude, longitude: addressPin.longitude'));
  assert.ok(save.includes('await persistProfile('));
  assert.ok(save.includes('selectAddress(row)'));
  assert.ok(page.includes('idPrefix="savedAddress"'));
  assert.ok(page.includes('onChange={point => setAddressEditor('));
  assert.ok(page.includes('showCurrentLocation={false}'));
  assert.ok(picker.includes('{showCurrentLocation ? <button'));
  assert.ok(picker.includes('new maps.Marker('));
  assert.ok(picker.includes('marker.setMap(map)'));
  assert.ok(picker.includes('map.panTo(position)'));
});

test("the only visible map marker is the Google Maps native Marker, not a green duplicate", () => {
  assert.doesNotMatch(picker, /visiblePinRef|syncVisiblePin|delivery-location-visible-pin|mapPinPixel/);
  assert.doesNotMatch(css, /\.delivery-location-visible-pin/);
  assert.ok(picker.includes('new maps.Marker('));
  assert.ok(picker.includes('marker.addListener("dragend"'));
});

test("shop closed notice uses improved style while closure protections remain active", () => {
  assert.ok(page.includes('id="deliveryStoreClosed"'));
  assert.ok(page.includes('delivery-closed-heading'));
  assert.ok(page.includes('delivery-closed-status'));
  assert.ok(page.includes('delivery-closed-reason'));
  assert.ok(css.includes('.delivery-closed-icon'));
  assert.ok(css.includes('linear-gradient('));
  assert.ok(page.includes('!storeAcceptingOrders'));
});

test("all supported languages explain no-nearby, missing GPS, saved-only checkout and closed status", () => {
  for (const locale of ["th", "en", "my", "lo", "km"]) {
    const a = translations[locale].delivery.checkout.address;
    const closed = translations[locale].delivery.opening_hours;
    for (const key of ["choice_required_title", "choice_no_saved", "choice_locating", "choice_no_nearby",
      "choice_gps_unavailable", "choice_help", "saved_selection_required", "saved_pin_required"]) {
      assert.ok(a[key], locale + " " + key);
    }
    assert.ok(closed.closed_badge);
  }
});
