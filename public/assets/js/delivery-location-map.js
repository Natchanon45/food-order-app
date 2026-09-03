import "./public-i18n-bootstrap.js?v=20260903-231";

// DELIVERY_LOCATION_PICKER_20260827_002

import { t } from "./i18n.js?v=20260903-202";

const mapElement = document.querySelector("#deliveryLocationMap");
const latitudeInput = document.querySelector("#deliveryLatitude");
const longitudeInput = document.querySelector("#deliveryLongitude");
const statusElement = document.querySelector("#deliveryLocationStatus");
const coordinatesElement = document.querySelector("#deliveryLocationCoordinates");
const currentLocationButton = document.querySelector("#useCurrentLocationButton");

const DEFAULT_LOCATION = {
  latitude: 13.756331,
  longitude: 100.501762,
  zoom: 11,
};

let map = null;
let marker = null;
let locationSource = "none";
let initialCurrentLocationPromise = Promise.resolve(null);

function normalize(latitude, longitude) {
  if (
    latitude === null ||
    latitude === undefined ||
    latitude === "" ||
    longitude === null ||
    longitude === undefined ||
    longitude === ""
  ) {
    return null;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lng,
  };
}

function render(location) {
  if (!location) {
    latitudeInput.value = "";
    longitudeInput.value = "";

    statusElement.textContent =
      t("delivery.checkout.address.location_missing");

    statusElement.classList.remove("is-ready", "is-error");

    coordinatesElement.hidden = true;
    coordinatesElement.textContent = "";

    return;
  }

  latitudeInput.value = location.latitude.toFixed(7);
  longitudeInput.value = location.longitude.toFixed(7);

  statusElement.textContent =
    t("delivery.checkout.address.location_ready");

  statusElement.classList.remove("is-error");
  statusElement.classList.add("is-ready");

  coordinatesElement.textContent =
    `${location.latitude.toFixed(7)}, ${location.longitude.toFixed(7)}`;

  coordinatesElement.hidden = false;
}

function getLocation() {
  return normalize(
    latitudeInput?.value,
    longitudeInput?.value,
  );
}

function moveMarker(location, pan = true) {
  if (!map || !location) return;

  if (!marker) {
    marker = window.L.marker(
      [location.latitude, location.longitude],
      {
        draggable: true,
      },
    ).addTo(map);

    marker.on("dragend", () => {
      const point = marker.getLatLng();

      setLocation(
        point.lat,
        point.lng,
        false,
        { source: "map" },
      );
    });
  } else {
    marker.setLatLng([
      location.latitude,
      location.longitude,
    ]);
  }

  if (pan) {
    map.setView(
      [location.latitude, location.longitude],
      Math.max(map.getZoom(), 16),
    );
  }
}

function dispatchChange(location) {
  document.dispatchEvent(
    new CustomEvent("delivery-location-changed", {
      detail: location,
    }),
  );
}

function dispatchSourceChange(location, source, meta = {}) {
  locationSource = String(source || "none");

  document.dispatchEvent(
    new CustomEvent("delivery-location-source-changed", {
      detail: {
        source: locationSource,
        location,
        ...meta,
      },
    }),
  );
}

function dispatchCurrentLocationResult(detail) {
  document.dispatchEvent(
    new CustomEvent("delivery-current-location-result", {
      detail,
    }),
  );
}

function setLocation(
  latitude,
  longitude,
  pan = true,
  options = {},
) {
  const location = normalize(latitude, longitude);

  if (!location) return false;

  const source =
    typeof options === "string"
      ? options
      : String(options?.source || "manual");

  render(location);
  moveMarker(location, pan);
  dispatchChange(location);
  dispatchSourceChange(location, source, {
    automatic: Boolean(options?.automatic),
  });

  return true;
}

function clearLocation(options = {}) {
  if (map && marker) {
    map.removeLayer(marker);
    marker = null;
  }

  const source =
    typeof options === "string"
      ? options
      : String(options?.source || "none");

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

  if (!label.dataset.originalText) {
    label.dataset.originalText = label.textContent || "";
  }

  label.textContent = busy
    ? t("delivery.checkout.address.location_locating")
    : label.dataset.originalText;
}

function requestCurrentLocation({ automatic = false } = {}) {
  if (!navigator.geolocation) {
    if (locationSource === "none") {
      showError(
        "delivery.checkout.address.location_unsupported",
      );
    }

    const detail = {
      ok: false,
      applied: false,
      automatic,
      reason: "unsupported",
      location: null,
    };

    dispatchCurrentLocationResult(detail);
    return Promise.resolve(null);
  }

  setCurrentLocationButtonBusy(true);

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const location = normalize(
          position.coords.latitude,
          position.coords.longitude,
        );

        const shouldApply =
          Boolean(location)
          && (
            !automatic
            || locationSource === "none"
            || locationSource === "current-location"
          );

        if (shouldApply) {
          setLocation(
            location.latitude,
            location.longitude,
            true,
            {
              source: "current-location",
              automatic,
            },
          );
        }

        setCurrentLocationButtonBusy(false);

        dispatchCurrentLocationResult({
          ok: Boolean(location),
          applied: shouldApply,
          automatic,
          reason: location ? "" : "invalid-coordinate",
          location,
        });

        resolve(shouldApply ? location : null);
      },

      error => {
        console.error(
          "[delivery-location] geolocation failed",
          error,
        );

        if (locationSource === "none") {
          showError(
            "delivery.checkout.address.location_error",
          );
        }

        setCurrentLocationButtonBusy(false);

        dispatchCurrentLocationResult({
          ok: false,
          applied: false,
          automatic,
          reason: String(error?.code || "geolocation-error"),
          location: null,
        });

        resolve(null);
      },

      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      },
    );
  });
}

function initializeMap() {
  if (!mapElement) return;

  if (!window.L) {
    showError(
      "delivery.checkout.address.location_map_failed",
    );
    return;
  }

  map = window.L.map(mapElement, {
    scrollWheelZoom: false,
  });

  map.setView(
    [
      DEFAULT_LOCATION.latitude,
      DEFAULT_LOCATION.longitude,
    ],
    DEFAULT_LOCATION.zoom,
  );

  window.L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    },
  ).addTo(map);

  map.on("click", event => {
    setLocation(
      event.latlng.lat,
      event.latlng.lng,
      true,
      { source: "map" },
    );
  });

  const initial = getLocation();

  if (initial) {
    render(initial);
    moveMarker(initial);
  } else {
    render(null);
  }

  setTimeout(() => {
    map.invalidateSize();
  }, 0);
}

currentLocationButton?.addEventListener("click", () => {
  requestCurrentLocation({ automatic: false });
});

window.deliveryLocation = Object.freeze({
  get() {
    return getLocation();
  },

  set(latitude, longitude, options = {}) {
    return setLocation(
      latitude,
      longitude,
      options?.pan !== false,
      options,
    );
  },

  clear(options = {}) {
    clearLocation(options);
  },

  requestCurrent(options = {}) {
    return requestCurrentLocation(options);
  },

  getSource() {
    return locationSource;
  },

  get initialCurrentLocation() {
    return initialCurrentLocationPromise;
  },
});

initializeMap();

/*
 * Start every delivery checkout from the device's current position. Saved
 * addresses remain available, but they only replace this location after the
 * customer explicitly selects one. If location permission is denied, the
 * address-book module may fall back to the saved default address.
 */
initialCurrentLocationPromise = requestCurrentLocation({
  automatic: true,
});
