// Store is the fixed origin; the customer order pin is the destination.
// Never silently substitute the cashier/driver device position for store GPS.
import { validDeliveryLocation } from "./deliveryLocationPolicy.js";
export function isSelfDeliveryOrder(order) {
  if (String(order?.orderType || "").toLowerCase() !== "delivery") return false;
  const provider = String(order?.deliveryProvider || "").trim().toLowerCase();
  // Treat stored Lalamove dispatch evidence as authoritative even if a legacy
  // provider field is missing or incorrectly says "self".
  const hasLalamoveDispatch = Boolean(
    order?.lalamoveOrderId
    || order?.lalamoveQuotationId
    || order?.lalamoveDispatchQuote?.quotationId
  );
  if (hasLalamoveDispatch) return false;
  // Older self-delivery orders can predate the provider field.
  return provider === "self" || !provider;
}

export function deliveryDriverDestination(order) {
  if (!isSelfDeliveryOrder(order)) return null;
  const rawLatitude = order?.deliveryLatitude;
  const rawLongitude = order?.deliveryLongitude;
  if (rawLatitude === null || rawLatitude === undefined || String(rawLatitude).trim() === "") return null;
  if (rawLongitude === null || rawLongitude === undefined || String(rawLongitude).trim() === "") return null;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export function deliveryDriverMapsUrl(order, storeLocation) {
  const coordinates = deliveryDriverDestination(order);
  const origin = validDeliveryLocation(storeLocation);
  if (!coordinates || !origin) return "";
  const point = value => [value.latitude.toFixed(7), value.longitude.toFixed(7)].join(",");
  const params = new URLSearchParams({
    api: "1",
    origin: point(origin),
    destination: point(coordinates),
    travelmode: "driving",
    dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
