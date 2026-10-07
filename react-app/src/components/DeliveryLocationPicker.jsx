import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/client";

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
  return googleMapsPromise;
}

function validLocation(value) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function DeliveryLocationPicker({
  slug, value, onChange, t, language = "th", disabled = false,
}) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapState, setMapState] = useState("loading");
  const [locating, setLocating] = useState(false);
  const normalized = validLocation(value);

  const apply = useCallback((location, { pan = true } = {}) => {
    const next = validLocation(location);
    if (!next) return;
    onChange?.(next);
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
      const marker = new maps.Marker({ map, position: center, draggable: !disabled });
      if (!normalized) marker.setMap(null);
      marker.addListener("dragend", () => {
        const point = marker.getPosition();
        if (point) apply({ latitude: point.lat(), longitude: point.lng() }, { pan: false });
      });
      map.addListener("click", event => {
        if (disabled || !event.latLng) return;
        apply({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
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
    const next = validLocation(value);
    if (!next || !mapRef.current || !markerRef.current) return;
    const position = { lat: next.latitude, lng: next.longitude };
    markerRef.current.setMap(mapRef.current);
    markerRef.current.setPosition(position);
  }, [value?.latitude, value?.longitude]);

  const current = () => {
    if (disabled || locating) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      setMapState("geolocation-error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      apply(next);
      setMapState("ready");
      setLocating(false);
    }, error => {
      console.warn("DELIVERY_REACT_GEOLOCATION_FAILED", error);
      setMapState("geolocation-error");
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 });
  };

  const status = normalized
    ? t("delivery.checkout.address.location_ready")
    : mapState === "error"
      ? t("delivery.checkout.address.location_map_failed")
      : mapState === "geolocation-error"
        ? t("delivery.checkout.address.location_error")
        : t("delivery.checkout.address.location_missing");

  return (
    <section className="delivery-location-picker">
      <div className="delivery-location-head">
        <div><strong>{t("delivery.checkout.address.location_title")} *</strong><div className="menu-category">{t("delivery.checkout.address.location_help")}</div></div>
        <button type="button" className="btn btn-sm" disabled={disabled || locating} onClick={current}>
          <i className="bi bi-crosshair app-icon" aria-hidden="true"></i>
          <span>{locating ? t("delivery.checkout.address.location_locating") : t("delivery.checkout.address.use_current_location")}</span>
        </button>
      </div>
      <div ref={mapElementRef} className="delivery-location-map" aria-label={t("delivery.checkout.address.location_title")}></div>
      <div className="delivery-location-footer">
        <div className={"delivery-location-status" + (normalized ? " is-ready" : mapState.includes("error") ? " is-error" : "")}>{status}</div>
        {normalized ? <div className="delivery-location-coordinates">{normalized.latitude.toFixed(7)}, {normalized.longitude.toFixed(7)}</div> : null}
      </div>
    </section>
  );
}
