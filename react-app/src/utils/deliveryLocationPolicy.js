// Shared coordinate and geolocation policy between Delivery checkout and map picker.
export function validDeliveryLocation(value) {
  if (value?.latitude == null || value?.longitude == null
      || String(value.latitude).trim() === "" || String(value.longitude).trim() === "") return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function validatedGpsFix(coords, maxAccuracyMeters = 100) {
  const accuracy = Number(coords?.accuracy);
  const point = validDeliveryLocation(coords);
  if (!point || coords?.accuracy == null || !Number.isFinite(accuracy) || accuracy < 0
      || accuracy > maxAccuracyMeters) {
    return { point: null, accuracy: Number.isFinite(accuracy) && coords?.accuracy != null ? Math.round(accuracy) : null };
  }
  return { point, accuracy: Math.round(accuracy) };
}

const NEARBY_SAVED_ADDRESS_METERS = 100;
export function nearestSavedAddress(addresses = [], location, maxDistanceMeters = NEARBY_SAVED_ADDRESS_METERS) {
  const gps = validDeliveryLocation(location);
  if (!gps) return null;
  const radians = degrees => degrees * Math.PI / 180;
  const earthRadiusMeters = 6371008.8;
  let nearest = null;
  for (const address of addresses || []) {
    const point = validDeliveryLocation(address);
    if (!point) continue;
    const latitudeDelta = radians(point.latitude - gps.latitude);
    const longitudeDelta = radians(point.longitude - gps.longitude);
    const value = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(radians(gps.latitude)) * Math.cos(radians(point.latitude))
        * Math.sin(longitudeDelta / 2) ** 2;
    const meters = earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
    if (!nearest || meters < nearest.meters) nearest = { address, meters };
  }
  return nearest && nearest.meters <= maxDistanceMeters ? nearest : null;
}

// Intended source is important: only GPS observations may auto-select saved
// entries; deliberate map pinning must never be overwritten by a nearby record.
export function matchGpsSavedAddress(addresses, location, source = "") {
  return source === "current-location" ? nearestSavedAddress(addresses, location) : null;
}
