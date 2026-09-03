import "./public-i18n-bootstrap.js?v=20260903-231";
import { functions, httpsCallable } from "./firebase-config.js?v=20260630-073";

// DELIVERY_LOCATION_ADDRESS_RESOLVER_20260827_003

import {
  watchCustomerAuth,
  getCustomerProfile,
} from './customer-profile-service.js?v=20260903-201';

const NEARBY_SAVED_ADDRESS_METERS = 100;
const REVERSE_GEOCODE_DEBOUNCE_MS = 250;
const addressInput = document.querySelector('#deliveryAddress');

let currentProfile = { addresses: [] };
let profileReady = false;
let profileReadyResolve;
let resolutionSerial = 0;
let addressRevision = 0;
let lastReverseGeocodeKey = '';
let lastReverseGeocodeAddress = '';

const initialProfileReady = new Promise(resolve => {
  profileReadyResolve = resolve;
});

function normalizeCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

function normalizeLocation(value = {}) {
  const latitude = normalizeCoordinate(value.latitude, -90, 90);
  const longitude = normalizeCoordinate(value.longitude, -180, 180);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function distanceMeters(fromValue, toValue) {
  const from = normalizeLocation(fromValue);
  const to = normalizeLocation(toValue);
  if (!from || !to) return Number.POSITIVE_INFINITY;

  const earthRadiusMeters = 6371008.8;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const latitude1 = radians(from.latitude);
  const latitude2 = radians(to.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1)
      * Math.cos(latitude2)
      * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(
    Math.sqrt(value),
    Math.sqrt(1 - value),
  );
}

function nearestSavedAddress(location) {
  let nearest = null;

  for (const address of currentProfile.addresses || []) {
    const savedLocation = normalizeLocation(address);
    if (!savedLocation) continue;

    const meters = distanceMeters(location, savedLocation);
    if (!nearest || meters < nearest.meters) {
      nearest = { address, meters };
    }
  }

  return nearest;
}

function shouldAutoSelectSavedAddress(source) {
  /*
   * GPS is observational: if the device is already close to a known address,
   * reuse that saved address automatically. A map click/drag is explicit user
   * intent, so never snap the marker back to a nearby saved coordinate.
   */
  return source === 'current-location';
}

function savedAddressRadio(id) {
  return [...document.querySelectorAll(
    'input[name="savedDeliveryAddress"]'
  )].find(input => String(input.value) === String(id)) || null;
}

async function selectSavedAddress(id, serial) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (serial !== resolutionSerial) return false;

    const radio = savedAddressRadio(id);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return false;
}

function activeSlug() {
  const match = location.pathname.match(/^\/s\/([^/]+)/i);
  return decodeURIComponent(match?.[1] || '').trim().toLowerCase();
}

function reverseGeocodeKey(location) {
  return `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
}

async function reverseGeocode(location) {
  const key = reverseGeocodeKey(location);
  if (key === lastReverseGeocodeKey && lastReverseGeocodeAddress) return lastReverseGeocodeAddress;

  const slug = activeSlug();
  if (!slug || !functions) return '';

  try {
    const reverseGeocodeDeliveryLocation = httpsCallable(functions, "reverseGeocodeDeliveryLocation");
    const result = await reverseGeocodeDeliveryLocation({
      slug,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    const address = String(result.data?.address || '').trim();
    if (address) {
      lastReverseGeocodeKey = key;
      lastReverseGeocodeAddress = address;
    }
    return address;
  } catch (error) {
    console.warn('[delivery-location] reverse geocode failed', error);
    return '';
  }
}

async function resolveLocation(locationValue, source = '') {
  const location = normalizeLocation(locationValue);
  if (!location || !addressInput) return;

  const serial = ++resolutionSerial;
  const addressRevisionAtStart = addressRevision;

  if (!profileReady) await initialProfileReady;
  if (serial !== resolutionSerial) return;

  if (shouldAutoSelectSavedAddress(source)) {
    const nearest = nearestSavedAddress(location);
    if (nearest && nearest.meters <= NEARBY_SAVED_ADDRESS_METERS) {
      const selected = await selectSavedAddress(nearest.address.id, serial);
      if (selected) return;
    }
  }

  await new Promise(resolve => {
    setTimeout(resolve, REVERSE_GEOCODE_DEBOUNCE_MS);
  });

  if (
    serial !== resolutionSerial
    || addressRevision !== addressRevisionAtStart
  ) {
    return;
  }

  try {
    const address = await reverseGeocode(location);
    if (
      !address
      || serial !== resolutionSerial
      || addressRevision !== addressRevisionAtStart
    ) {
      return;
    }

    addressInput.value = address;
    addressInput.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (error) {
    console.warn('[delivery-location-address] reverse geocode failed', error);
  }
}

addressInput?.addEventListener('input', () => {
  addressRevision += 1;
  resolutionSerial += 1;
});

document.addEventListener('delivery-location-source-changed', event => {
  const source = String(event.detail?.source || '');
  resolutionSerial += 1;

  if (!['current-location', 'map', 'manual'].includes(source)) return;

  resolveLocation(event.detail?.location, source);
});

watchCustomerAuth(async user => {
  try {
    currentProfile = await getCustomerProfile(user);
  } catch (error) {
    console.warn('[delivery-location-address] profile unavailable', error);
    currentProfile = { addresses: [] };
  } finally {
    if (!profileReady) {
      profileReady = true;
      profileReadyResolve?.();
    }
  }

  const location = window.deliveryLocation?.get?.() || null;
  const source = String(window.deliveryLocation?.getSource?.() || '');
  if (location && ['current-location', 'map', 'manual'].includes(source)) {
    resolveLocation(location, source);
  }
});
