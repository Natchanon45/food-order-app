// Shared location validation for customer checkout, saved address pins and
// browser geolocation. Never allow an empty or null value to coerce to 0,0.
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

// Accuracy is metres as reported by the browser, not a promise of exact
// building/entrance accuracy. Coarse results must not move a valid saved pin.
export function validatedGpsFix(coords, maxAccuracyMeters = 100) {
  const accuracy = Number(coords?.accuracy);
  const point = validDeliveryLocation(coords);
  if (!point || coords?.accuracy == null || !Number.isFinite(accuracy) || accuracy < 0
      || accuracy > maxAccuracyMeters) {
    return { point: null, accuracy: Number.isFinite(accuracy) && coords?.accuracy != null ? Math.round(accuracy) : null };
  }
  return { point, accuracy: Math.round(accuracy) };
}
