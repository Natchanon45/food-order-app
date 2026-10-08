import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";
import { validDeliveryLocation as validLocation, validatedGpsFix } from "@/utils/deliveryLocationPolicy";

const getGoogleMapsConfig = httpsCallable(functions, "getDeliveryGoogleMapsConfig");
let googleMapsPromise = null;

async function ensureGoogleMaps(slug, language = "th") {
  if (window.google?.maps) return window.google.maps;
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = (async () => {
    const response = await getGoogleMapsConfig({ slug });
    const apiKey = String(response.data?.apiKey || "").trim();
    if (!apiKey) throw new Error("GOOGLE_MAPS_KEY_MISSING");
    await new Promise((resolve, reject) => {
      const callback = "__penguinReactGoogleMapsReady_" + Date.now();
      window[callback] = () => { delete window[callback]; resolve(); };
      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(apiKey)
        + "&v=weekly&language=" + encodeURIComponent(language === "en" ? "en" : "th")
        + "&region=TH&callback=" + encodeURIComponent(callback);
      script.onerror = () => { delete window[callback]; reject(new Error("GOOGLE_MAPS_LOAD_FAILED")); };
      document.head.appendChild(script);
    });
    return window.google.maps;
  })();
  return googleMapsPromise.catch(error => {
    // A failed API/network request must not poison all future map attempts.
    googleMapsPromise = null;
    throw error;
  });
}

export function DeliveryLocationPicker({
  slug, value, onChange, onUncertain, t, language = "th", disabled = false, idPrefix = "delivery",
}) {
  const mapElementRef = useRef(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapState, setMapState] = useState("loading");
  const [locating, setLocating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const normalized = validLocation(value);
  const mapId = idPrefix === "delivery" ? "deliveryLocationMap" : idPrefix + "LocationMap";
  const currentButtonId = idPrefix === "delivery" ? "useCurrentLocationButton" : idPrefix + "CurrentLocationButton";
  const pickerId = idPrefix === "delivery" ? "deliveryLocationPicker" : idPrefix + "LocationPicker";
  const statusId = idPrefix === "delivery" ? "deliveryLocationStatus" : idPrefix + "LocationStatus";
  const coordinatesId = idPrefix === "delivery" ? "deliveryLocationCoordinates" : idPrefix + "LocationCoordinates";

  const apply = useCallback((location, { pan = true, source = "map" } = {}) => {
    const next = validLocation(location);
    if (!next) return;
    if (source === "map") {
      setGpsAccuracy(null);
      setMapState("ready");
    }
    onChange?.(next, { source });
    const map = mapRef.current;
    const marker = markerRef.current;
    const position = { lat: next.latitude, lng: next.longitude };
    marker?.setPosition(position);
    marker?.setMap(map || null);
    if (map && pan) {
      map.panTo(position);
      map.setZoom(Math.max(Number(map.getZoom() || 0), 16));
    }
  }, [onChange]);

  useEffect(() => {
    let alive = true;
    if (!slug || !mapElementRef.current) return undefined;
    setMapState("loading");
    ensureGoogleMaps(slug, language).then(maps => {
      if (!alive || !mapElementRef.current) return;
      const center = normalized
        ? { lat: normalized.latitude, lng: normalized.longitude }
        : { lat: 13.756331, lng: 100.501762 };
      const map = new maps.Map(mapElementRef.current, {
        center,
        zoom: normalized ? 16 : 11,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        gestureHandling: "cooperative",
      });
      const marker = new maps.Marker({ map, position: center, draggable: !disabledRef.current });
      if (!normalized) marker.setMap(null);
      marker.addListener("dragend", () => {
        if (disabledRef.current) return;
        const point = marker.getPosition();
        if (point) apply({ latitude: point.lat(), longitude: point.lng() }, { pan: false, source: "map" });
      });
      map.addListener("click", event => {
        if (disabledRef.current || !event.latLng) return;
        apply({ latitude: event.latLng.lat(), longitude: event.latLng.lng() }, { source: "map" });
      });
      mapRef.current = map;
      markerRef.current = marker;
      setMapState("ready");
    }).catch(error => {
      console.error("DELIVERY_REACT_MAP_LOAD_FAILED", error);
      if (alive) setMapState("error");
    });
    return () => { alive = false; };
  }, [slug, language]);

  useEffect(() => {
    markerRef.current?.setDraggable(!disabled);
  }, [disabled]);

  useEffect(() => {
    const next = validLocation(value);
    if (!next || !mapRef.current || !markerRef.current) return;
    const position = { lat: next.latitude, lng: next.longitude };
    markerRef.current.setMap(mapRef.current);
    markerRef.current.setPosition(position);
    // A saved address loaded into the form must move the visible map viewport,
    // not only move a marker that might be kilometres outside the viewport.
    mapRef.current.panTo(position);
  }, [value?.latitude, value?.longitude]);

  const current = () => {
    if (disabled || locating) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setGpsAccuracy(null);
      setMapState("geolocation-error");
      onUncertain?.();
      return;
    }
    setLocating(true);
    setGpsAccuracy(null);
    // Reject stale/cell-tower fixes. Accuracy is a browser/device estimate,
    // not a guarantee that GPS matches the entrance or exact delivery pin.
    navigator.geolocation.getCurrentPosition(position => {
      const { point, accuracy } = validatedGpsFix(position.coords);
      if (!point) {
        setGpsAccuracy(accuracy);
        setMapState("geolocation-inaccurate");
        setLocating(false);
        onUncertain?.();
        return;
      }
      setGpsAccuracy(accuracy);
      apply(point, { source: "current-location" });
      setMapState("ready");
      setLocating(false);
    }, error => {
      console.warn("DELIVERY_REACT_GEOLOCATION_FAILED", error);
      setGpsAccuracy(null);
      setMapState("geolocation-error");
      setLocating(false);
      onUncertain?.();
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  };

  const status = mapState === "geolocation-inaccurate"
    ? t("delivery.checkout.address.gps_low_accuracy", { meters: gpsAccuracy ?? "?" })
    : mapState === "geolocation-error"
      ? t("delivery.checkout.address.location_error")
      : mapState === "error"
        ? t("delivery.checkout.address.location_map_failed")
        : normalized
          ? gpsAccuracy !== null
            ? t("delivery.checkout.address.gps_accuracy", { meters: gpsAccuracy })
            : t("delivery.checkout.address.location_ready")
          : t("delivery.checkout.address.location_missing");

  return (
    <section className="delivery-location-picker" id={pickerId}>
      <div className="delivery-location-head">
        <div><strong>{t("delivery.checkout.address.location_title")} *</strong><div className="menu-category">{t("delivery.checkout.address.location_help")}</div></div>
        <button type="button" className="btn btn-sm" id={currentButtonId} disabled={disabled || locating} onClick={current}>
          <i className="bi bi-crosshair app-icon" aria-hidden="true"></i>
          <span>{locating ? t("delivery.checkout.address.location_locating") : t("delivery.checkout.address.use_current_location")}</span>
        </button>
      </div>
      <div ref={mapElementRef} id={mapId} className="delivery-location-map" aria-label={t("delivery.checkout.address.location_title")}></div>
      <div className="delivery-location-footer">
        <div id={statusId} className={"delivery-location-status" + (mapState.includes("error") || mapState === "geolocation-inaccurate" ? " is-error" : normalized ? " is-ready" : "")}>{status}</div>
        {normalized ? <div id={coordinatesId} className="delivery-location-coordinates">{normalized.latitude.toFixed(7)}, {normalized.longitude.toFixed(7)}</div> : null}
      </div>
    </section>
  );
}
