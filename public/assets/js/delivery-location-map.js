import "./public-i18n-bootstrap.js?v=20260903-245";
import { functions, httpsCallable } from "./firebase-config.js?v=20260630-073";
import { getStoredTenant } from "./tenant-context.js?v=20260903-201";
import { t } from "./i18n.js?v=20260903-202";

// DELIVERY_GOOGLE_MAP_PICKER_20260903_001
const mapElement = document.querySelector("#deliveryLocationMap");
const latitudeInput = document.querySelector("#deliveryLatitude");
const longitudeInput = document.querySelector("#deliveryLongitude");
const statusElement = document.querySelector("#deliveryLocationStatus");
const coordinatesElement = document.querySelector("#deliveryLocationCoordinates");
const currentLocationButton = document.querySelector("#useCurrentLocationButton");
const getGoogleMapsConfig = httpsCallable(functions, "getDeliveryGoogleMapsConfig");

const DEFAULT_LOCATION = { latitude: 13.756331, longitude: 100.501762, zoom: 11 };
let map = null;
let marker = null;
let locationSource = "none";
let initialCurrentLocationPromise = Promise.resolve(null);
let googleMapsPromise = null;
let geolocationWatchId = null;
let geolocationPermissionStatus = null;
let lastWatchedLocation = null;
const GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 15000,
});

function storefrontSlug() {
  const match = location.pathname.match(/^\/s\/([^/]+)/i);
  return decodeURIComponent(match?.[1] || getStoredTenant()?.slug || "").trim().toLowerCase();
}
function normalize(latitude, longitude) {
  if (latitude === null || latitude === undefined || latitude === "" || longitude === null || longitude === undefined || longitude === "") return null;
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

async function loadGoogleMaps() {
  if (window.google?.maps) return window.google.maps;
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = (async () => {
    const slug = storefrontSlug();
    if (!slug) throw new Error("STORE_SLUG_REQUIRED");
    const response = await getGoogleMapsConfig({ slug });
    const apiKey = String(response.data?.apiKey || "").trim();
    if (!apiKey) throw new Error("GOOGLE_MAPS_KEY_MISSING");
    await new Promise((resolve, reject) => {
      const callback = `__fodGoogleMapsReady_${Date.now()}`;
      window[callback] = () => { delete window[callback]; resolve(); };
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=${document.documentElement.lang === "en" ? "en" : "th"}&region=TH&callback=${callback}`;
      script.onerror = () => { delete window[callback]; reject(new Error("GOOGLE_MAPS_LOAD_FAILED")); };
      document.head.appendChild(script);
    });
    return window.google.maps;
  })();
  return googleMapsPromise;
}
function render(location) {
  if (!location) {
    latitudeInput.value = ""; longitudeInput.value = "";
    statusElement.textContent = t("delivery.checkout.address.location_missing");
    statusElement.classList.remove("is-ready", "is-error");
    coordinatesElement.hidden = true; coordinatesElement.textContent = "";
    return;
  }
  latitudeInput.value = location.latitude.toFixed(7);
  longitudeInput.value = location.longitude.toFixed(7);
  statusElement.textContent = t("delivery.checkout.address.location_ready");
  statusElement.classList.remove("is-error"); statusElement.classList.add("is-ready");
  coordinatesElement.textContent = `${location.latitude.toFixed(7)}, ${location.longitude.toFixed(7)}`;
  coordinatesElement.hidden = false;
}

function getLocation() {
  return normalize(latitudeInput?.value, longitudeInput?.value);
}

function markerPosition() {
  const position = marker?.getPosition?.();
  return position ? { latitude: position.lat(), longitude: position.lng() } : null;
}
function moveMarker(location, pan = true) {
  if (!map || !window.google?.maps || !location) return;
  const position = { lat: location.latitude, lng: location.longitude };
  if (!marker) {
    marker = new window.google.maps.Marker({ map, position, draggable: true });
    marker.addListener("dragend", () => {
      const point = markerPosition();
      if (point) setLocation(point.latitude, point.longitude, false, { source: "map" });
    });
  } else {
    marker.setMap(map);
    marker.setPosition(position);
  }
  if (pan) {
    map.panTo(position);
    map.setZoom(Math.max(Number(map.getZoom() || 0), 16));
  }
}

function dispatchChange(location) {
  document.dispatchEvent(new CustomEvent("delivery-location-changed", { detail: location }));
}

function dispatchSourceChange(location, source, meta = {}) {
  locationSource = String(source || "none");
  document.dispatchEvent(new CustomEvent("delivery-location-source-changed", { detail: { source: locationSource, location, ...meta } }));
}
function dispatchCurrentLocationResult(detail) {
  document.dispatchEvent(new CustomEvent("delivery-current-location-result", { detail }));
}

function setLocation(latitude, longitude, pan = true, options = {}) {
  const location = normalize(latitude, longitude);
  if (!location) return false;
  const source = typeof options === "string" ? options : String(options?.source || "manual");
  render(location);
  moveMarker(location, pan);
  dispatchChange(location);
  dispatchSourceChange(location, source, { automatic: Boolean(options?.automatic) });
  return true;
}

function clearLocation(options = {}) {
  if (marker) marker.setMap(null);
  const source = typeof options === "string" ? options : String(options?.source || "none");
  render(null);
  dispatchChange(null);
  dispatchSourceChange(null, source);
}

function showError(key) {
  statusElement.textContent = t(key);
  statusElement.classList.remove("is-ready");
  statusElement.classList.add("is-error");
}
function setCurrentLocationButtonBusy(busy) {
  if (!currentLocationButton) return;
  currentLocationButton.disabled = busy;
  const label = currentLocationButton.querySelector("span");
  if (!label) return;
  if (!label.dataset.originalText) label.dataset.originalText = label.textContent || "";
  label.textContent = busy ? t("delivery.checkout.address.location_locating") : label.dataset.originalText;
}

function geolocationErrorKey(error) {
  if (!window.isSecureContext) return "delivery.checkout.address.location_insecure";
  if (Number(error?.code) === 1) return "delivery.checkout.address.location_permission_denied";
  if (Number(error?.code) === 2) return "delivery.checkout.address.location_unavailable";
  if (Number(error?.code) === 3) return "delivery.checkout.address.location_timeout";
  return "delivery.checkout.address.location_error";
}

function meaningfulLocationChange(next) {
  if (!lastWatchedLocation) return true;
  const latDelta = Math.abs(next.latitude - lastWatchedLocation.latitude);
  const lngDelta = Math.abs(next.longitude - lastWatchedLocation.longitude);
  return latDelta > 0.00015 || lngDelta > 0.00015;
}

function stopLocationWatch() {
  if (geolocationWatchId === null || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(geolocationWatchId);
  geolocationWatchId = null;
}

function startLocationWatch() {
  if (!navigator.geolocation || geolocationWatchId !== null) return;
  geolocationWatchId = navigator.geolocation.watchPosition(position => {
    const location = normalize(position.coords.latitude, position.coords.longitude);
    if (!location) return;
    if (!meaningfulLocationChange(location)) return;
    lastWatchedLocation = location;
    if (locationSource === "none" || locationSource === "current-location") {
      setLocation(location.latitude, location.longitude, true, {
        source: "current-location",
        automatic: true,
      });
    }
  }, error => {
    console.warn("[delivery-location] watchPosition failed", error);
    if (Number(error?.code) === 1) stopLocationWatch();
  }, GEOLOCATION_OPTIONS);
}

async function permissionState() {
  if (!navigator.permissions?.query) return "unknown";
  try {
    geolocationPermissionStatus = await navigator.permissions.query({ name: "geolocation" });
    geolocationPermissionStatus.onchange = () => {
      const state = String(geolocationPermissionStatus?.state || "unknown");
      if (state === "granted") {
        startLocationWatch();
        requestCurrentLocation({ automatic: true, startWatch: true });
      } else if (state === "denied") {
        stopLocationWatch();
        showError("delivery.checkout.address.location_permission_denied");
      }
    };
    return String(geolocationPermissionStatus.state || "unknown");
  } catch (error) {
    console.warn("[delivery-location] Permissions API unavailable", error);
    return "unknown";
  }
}

function requestCurrentLocation({ automatic = false, startWatch = true } = {}) {
  if (!window.isSecureContext) {
    showError("delivery.checkout.address.location_insecure");
    return Promise.resolve(null);
  }
  if (!navigator.geolocation) {
    showError("delivery.checkout.address.location_unsupported");
    const detail = { ok: false, applied: false, automatic, reason: "unsupported", location: null };
    dispatchCurrentLocationResult(detail);
    return Promise.resolve(null);
  }
  setCurrentLocationButtonBusy(true);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(position => {
      const location = normalize(position.coords.latitude, position.coords.longitude);
      const shouldApply = Boolean(location) && (!automatic || locationSource === "none" || locationSource === "current-location");
      if (shouldApply) {
        lastWatchedLocation = location;
        setLocation(location.latitude, location.longitude, true, { source: "current-location", automatic });
      }
      if (startWatch) startLocationWatch();
      setCurrentLocationButtonBusy(false);
      dispatchCurrentLocationResult({ ok: Boolean(location), applied: shouldApply, automatic, reason: location ? "" : "invalid-coordinate", location });
      resolve(shouldApply ? location : null);
    }, error => {
      console.error("[delivery-location] geolocation failed", error);
      showError(geolocationErrorKey(error));
      if (Number(error?.code) === 1) stopLocationWatch();
      setCurrentLocationButtonBusy(false);
      dispatchCurrentLocationResult({ ok: false, applied: false, automatic, reason: String(error?.code || "geolocation-error"), location: null });
      resolve(null);
    }, GEOLOCATION_OPTIONS);
  });
}

async function initializeCurrentLocation() {
  const state = await permissionState();
  if (state === "denied") {
    showError("delivery.checkout.address.location_permission_denied");
    return null;
  }
  const location = await requestCurrentLocation({ automatic: true, startWatch: true });
  if (state === "granted") startLocationWatch();
  return location;
}

async function initializeMap() {
  if (!mapElement) return;
  try {
    await loadGoogleMaps();
  } catch (error) {
    console.error("[delivery-location] google maps failed", error);
    showError("delivery.checkout.address.location_map_failed");
    return;
  }

  map = new window.google.maps.Map(mapElement, {
    center: { lat: DEFAULT_LOCATION.latitude, lng: DEFAULT_LOCATION.longitude },
    zoom: DEFAULT_LOCATION.zoom,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    gestureHandling: "cooperative",
  });
  map.addListener("click", event => {
    const point = event.latLng;
    if (point) setLocation(point.lat(), point.lng(), true, { source: "map" });
  });

  const initial = getLocation();
  if (initial) {
    render(initial);
    moveMarker(initial);
  } else {
    render(null);
  }
}

currentLocationButton?.addEventListener("click", async () => {
  await requestCurrentLocation({ automatic: false, startWatch: true });
});

window.deliveryLocation = Object.freeze({
  get() { return getLocation(); },
  set(latitude, longitude, options = {}) {
    return setLocation(latitude, longitude, options?.pan !== false, options);
  },
  clear(options = {}) { clearLocation(options); },
  requestCurrent(options = {}) { return requestCurrentLocation(options); },
  getSource() { return locationSource; },
  get initialCurrentLocation() { return initialCurrentLocationPromise; },
});

initializeMap();
initialCurrentLocationPromise = initializeCurrentLocation();
window.addEventListener("pagehide", stopLocationWatch, { once: true });
