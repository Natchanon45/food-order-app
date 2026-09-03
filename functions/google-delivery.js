const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const REGION = "asia-southeast1";
const GOOGLE_MAPS_SERVER_API_KEY = defineSecret("GOOGLE_MAPS_SERVER_API_KEY");
const GOOGLE_MAPS_BROWSER_API_KEY = defineSecret("GOOGLE_MAPS_BROWSER_API_KEY");
const ROUTE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function coordinate(value, min, max, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HttpsError("invalid-argument", `${field} is invalid`);
  }
  return number;
}

function normalizeSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (!slug) throw new HttpsError("invalid-argument", "Store slug is required");
  return slug;
}

async function storefront(slugValue) {
  const slug = normalizeSlug(slugValue);
  const db = getFirestore();
  const slugSnapshot = await db.collection("tenantSlugs").doc(slug).get();
  if (!slugSnapshot.exists || slugSnapshot.data()?.active === false) {
    throw new HttpsError("not-found", "Storefront not found");
  }
  const tenantId = String(slugSnapshot.data()?.tenantId || "").trim();
  if (!tenantId) throw new HttpsError("not-found", "Tenant not found");
  const settingsSnapshot = await db.collection("tenants").doc(tenantId).collection("settings").doc("store").get();
  return { db, slug, tenantId, settings: settingsSnapshot.data() || {} };
}

function maxDistance(settings = {}) {
  const value = Number(settings.deliveryMaxDistanceKm);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function deliveryZones(settings = {}) {
  const configuredMax = maxDistance(settings);
  const custom = Array.isArray(settings.deliveryFeeOptions) ? settings.deliveryFeeOptions : [];
  const legacy = {
    "distance-0-2": 2, nearby: 2,
    "distance-2-5": 5, general: 5,
    "distance-5-plus": configuredMax || 10, far: configuredMax || 10,
  };
  let tier = 0;
  const rows = custom.map((option, index) => {
    const id = String(option?.id || option?.key || `fee-${index + 1}`);
    if (id === "pickup") return null;
    const explicit = Number(option?.maxDistanceKm ?? option?.distanceKm ?? option?.maxDistance);
    const fallback = [2, 5, 10];
    const limit = Number.isFinite(explicit) && explicit > 0
      ? explicit
      : legacy[id] || fallback[tier] || (10 + ((tier - 2) * 5));
    tier += 1;
    return {
      id,
      label: String(option?.label || option?.name || "").trim(),
      fee: Math.max(0, Number(option?.fee ?? option?.amount ?? 0) || 0),
      maxDistanceKm: limit,
    };
  }).filter(row => row?.label);
  if (rows.length) return rows.sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  return [
    { id: "distance-0-2", label: "0-2 km", fee: 10, maxDistanceKm: 2 },
    { id: "distance-2-5", label: "2-5 km", fee: 30, maxDistanceKm: 5 },
    { id: "distance-5-plus", label: "5+ km", fee: 50, maxDistanceKm: configuredMax || 10 },
  ];
}

function cacheKey(tenantId, origin, destination) {
  const raw = [tenantId, origin.latitude.toFixed(5), origin.longitude.toFixed(5), destination.latitude.toFixed(5), destination.longitude.toFixed(5)].join("_");
  return raw.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function routeResult(row, settings) {
  const distanceMeters = Number(row.distanceMeters || 0);
  const distanceKm = Math.round(distanceMeters / 10) / 100;
  const limit = maxDistance(settings);
  const zone = deliveryZones(settings).find(item => distanceKm <= item.maxDistanceKm + 1e-9) || null;
  const inRange = distanceMeters > 0 && (!limit || distanceKm <= limit + 1e-9) && Boolean(zone);
  return {
    provider: "google_routes",
    distanceMeters,
    distanceKm,
    durationSeconds: Number(String(row.duration || "0s").replace(/s$/, "")) || 0,
    encodedPolyline: String(row.encodedPolyline || ""),
    inRange,
    maxDistanceKm: limit,
    zone: inRange ? zone : null,
  };
}

exports.getDeliveryGoogleMapsConfig = onCall({ region: REGION, timeoutSeconds: 10, secrets: [GOOGLE_MAPS_BROWSER_API_KEY] }, async request => {
  await storefront(request.data?.slug);
  const apiKey = GOOGLE_MAPS_BROWSER_API_KEY.value();
  if (!apiKey) throw new HttpsError("failed-precondition", "Google Maps browser key is not configured");
  return { apiKey };
});

exports.computeDeliveryRoute = onCall({ region: REGION, timeoutSeconds: 25, secrets: [GOOGLE_MAPS_SERVER_API_KEY] }, async request => {
  const destination = {
    latitude: coordinate(request.data?.latitude, -90, 90, "latitude"),
    longitude: coordinate(request.data?.longitude, -180, 180, "longitude"),
  };
  const { db, tenantId, settings } = await storefront(request.data?.slug);
  const origin = {
    latitude: coordinate(settings.storeLatitude, -90, 90, "storeLatitude"),
    longitude: coordinate(settings.storeLongitude, -180, 180, "storeLongitude"),
  };
  const key = cacheKey(tenantId, origin, destination);
  const cacheRef = db.collection("deliveryRouteCache").doc(key);
  const cached = await cacheRef.get();
  if (cached.exists) {
    const data = cached.data() || {};
    const updatedAt = data.updatedAt?.toMillis?.() || 0;
    if (Date.now() - updatedAt < ROUTE_CACHE_TTL_MS && Number(data.distanceMeters) > 0) {
      return { ...routeResult(data, settings), cached: true };
    }
  }

  const apiKey = GOOGLE_MAPS_SERVER_API_KEY.value();
  if (!apiKey) throw new HttpsError("failed-precondition", "Google Routes key is not configured");
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
      destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      languageCode: "th",
      units: "METRIC",
    }),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 1200);
    console.error("[google-routes] request failed", response.status, body);
    throw new HttpsError("unavailable", "Google Routes could not calculate this delivery route");
  }
  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route || !Number(route.distanceMeters)) throw new HttpsError("not-found", "No driving route found");
  const cache = {
    tenantId,
    origin,
    destination,
    distanceMeters: Number(route.distanceMeters),
    duration: String(route.duration || "0s"),
    encodedPolyline: String(route.polyline?.encodedPolyline || ""),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await cacheRef.set(cache, { merge: true });
  return { ...routeResult(cache, settings), cached: false };
});
