import { functions, httpsCallable } from './firebase-config.js?v=20260630-073';
import { resolveShopContext } from './tenant-context.js';

let googleMapsPromise = null;

async function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return window.google.maps;
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = `__fodAdminGoogleMapsReady_${Date.now()}`;
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
    script.onerror = () => reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

async function googleMapsApiKey() {
  if (!functions) return '';
  const tenant = resolveShopContext();
  const callable = httpsCallable(functions, 'getDeliveryGoogleMapsConfig');
  const result = await callable({ slug: tenant.slug });
  return String(result.data?.apiKey || '').trim();
}

function createGoogleController(element, maps, defaultLocation, onChange) {
  const center = { lat: defaultLocation.latitude, lng: defaultLocation.longitude };
  const map = new maps.Map(element, {
    center,
    zoom: defaultLocation.zoom || 11,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
  });
  let marker = null;

  const setLocation = (location, pan = true) => {
    if (!location) return;
    const point = { lat: Number(location.latitude), lng: Number(location.longitude) };
    if (!marker) {
      marker = new maps.Marker({ map, position: point, draggable: true });
      marker.addListener('dragend', () => {
        const position = marker.getPosition();
        onChange(position.lat(), position.lng(), false);
      });
    } else {
      marker.setMap(map);
      marker.setPosition(point);
    }
    if (pan) {
      map.panTo(point);
      if (map.getZoom() < 16) map.setZoom(16);
    }
  };

  map.addListener('click', event => {
    onChange(event.latLng.lat(), event.latLng.lng(), true);
  });
  return { provider: 'google', setLocation, resize() {} };
}

function createLeafletController(element, defaultLocation, onChange) {
  if (!window.L?.map) throw new Error('LEAFLET_NOT_AVAILABLE');
  const map = window.L.map(element, { scrollWheelZoom: false }).setView(
    [defaultLocation.latitude, defaultLocation.longitude],
    defaultLocation.zoom || 11,
  );
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  let marker = null;
  const setLocation = (location, pan = true) => {
    if (!location) return;
    const point = [Number(location.latitude), Number(location.longitude)];
    if (!marker) {
      marker = window.L.marker(point, { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const value = marker.getLatLng();
        onChange(value.lat, value.lng, false);
      });
    } else {
      marker.setLatLng(point);
    }
    if (pan) map.setView(point, Math.max(map.getZoom(), 16));
  };

  map.on('click', event => onChange(event.latlng.lat, event.latlng.lng, true));
  setTimeout(() => map.invalidateSize(), 0);
  return { provider: 'leaflet', setLocation, resize: () => map.invalidateSize() };
}

export async function createAdminStoreLocationMap({ element, defaultLocation, onChange }) {
  try {
    const apiKey = await googleMapsApiKey();
    if (apiKey) {
      const maps = await loadGoogleMaps(apiKey);
      element.dataset.mapProvider = 'google';
      return createGoogleController(element, maps, defaultLocation, onChange);
    }
  } catch (error) {
    console.warn('[admin-store-map] Google Maps unavailable, using fallback', error);
  }

  element.dataset.mapProvider = 'leaflet';
  return createLeafletController(element, defaultLocation, onChange);
}
