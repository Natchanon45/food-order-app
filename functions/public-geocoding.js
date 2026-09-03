const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const REGION = "asia-southeast1";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function coordinate(value, min, max, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HttpsError("invalid-argument", `${field} is invalid`);
  }
  return number;
}

function cacheKey(latitude, longitude) {
  return `${latitude.toFixed(5)}_${longitude.toFixed(5)}`.replace(/[^0-9_.-]/g, "_");
}

exports.reverseGeocodeDeliveryLocation = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const latitude = coordinate(request.data?.latitude, -90, 90, "latitude");
  const longitude = coordinate(request.data?.longitude, -180, 180, "longitude");
  const slug = String(request.data?.slug || "").trim().toLowerCase();
  if (!slug) throw new HttpsError("invalid-argument", "Store slug is required");

  const db = getFirestore();
  const slugSnapshot = await db.collection("tenantSlugs").doc(slug).get();
  if (!slugSnapshot.exists || slugSnapshot.data()?.active === false) {
    throw new HttpsError("not-found", "Storefront not found");
  }

  const key = cacheKey(latitude, longitude);
  const cacheRef = db.collection("reverseGeocodeCache").doc(key);
  const cached = await cacheRef.get();
  if (cached.exists) {
    const row = cached.data() || {};
    const updatedAt = row.updatedAt?.toMillis?.() || 0;
    if (row.address && Date.now() - updatedAt < CACHE_TTL_MS) return { address: row.address, cached: true };
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "th,en");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FoodOrderDelivery/1.0 (reverse geocoding for customer delivery address)",
    },
  });
  if (!response.ok) throw new HttpsError("unavailable", "Reverse geocoding is temporarily unavailable");
  const payload = await response.json().catch(() => ({}));
  const address = String(payload?.display_name || "").trim();
  if (!address) return { address: "", cached: false };

  await cacheRef.set({ latitude, longitude, address, source: "nominatim", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { address, cached: false };
});
