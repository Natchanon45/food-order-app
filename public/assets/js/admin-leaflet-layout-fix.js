// ADMIN_LEAFLET_LAYOUT_FIX_20260827_003

const registeredMaps = new Set();
let installed = false;

const adminStoreLocationCopy = {
  th: {
    title: 'ตำแหน่งร้าน',
    description: 'ใช้เป็นจุดเริ่มต้นสำหรับคำนวณระยะทาง Delivery',
    useCurrentLocation: 'ใช้ตำแหน่งปัจจุบัน',
    mapAriaLabel: 'ตำแหน่งร้าน',
    statusUnset: 'ยังไม่ได้กำหนดตำแหน่งร้าน',
    statusReady: 'กำหนดตำแหน่งร้านแล้ว',
    mapFailed: 'โหลดแผนที่ไม่สำเร็จ',
    geolocationUnsupported: 'เบราว์เซอร์ไม่รองรับการอ่านตำแหน่ง',
    geolocationFailed: 'ไม่สามารถอ่านตำแหน่งปัจจุบันได้',
  },
  en: {
    title: 'Store location',
    description: 'Used as the starting point for Delivery distance calculation',
    useCurrentLocation: 'Use current location',
    mapAriaLabel: 'Store location',
    statusUnset: 'Store location is not set',
    statusReady: 'Store location is set',
    mapFailed: 'Unable to load map',
    geolocationUnsupported: 'This browser does not support location access',
    geolocationFailed: 'Unable to get the current location',
  },
};

function currentAdminLocale() {
  const lang = String(document.documentElement.lang || '').toLowerCase();
  return lang.startsWith('en') ? 'en' : 'th';
}

function storeLocationCopy() {
  return adminStoreLocationCopy[currentAdminLocale()] || adminStoreLocationCopy.th;
}

const locationStatusAliases = new Map([
  ['ยังไม่ได้กำหนดตำแหน่งร้าน', 'statusUnset'],
  ['Store location is not set', 'statusUnset'],
  ['กำหนดตำแหน่งร้านแล้ว', 'statusReady'],
  ['Store location is set', 'statusReady'],
  ['โหลดแผนที่ไม่สำเร็จ', 'mapFailed'],
  ['Unable to load map', 'mapFailed'],
  ['เบราว์เซอร์ไม่รองรับการอ่านตำแหน่ง', 'geolocationUnsupported'],
  ['This browser does not support location access', 'geolocationUnsupported'],
  ['ไม่สามารถอ่านตำแหน่งปัจจุบันได้', 'geolocationFailed'],
  ['Unable to get the current location', 'geolocationFailed'],
]);

function translateStoreLocationStatus(statusElement) {
  if (!statusElement) return;

  const current = String(statusElement.textContent || '').trim();
  const key = locationStatusAliases.get(current);
  if (!key) return;

  const translated = storeLocationCopy()[key];
  if (translated && translated !== current) {
    statusElement.textContent = translated;
  }
}

function localizeStoreLocationUi() {
  const section = document.querySelector('.admin-store-location');
  if (!section) return;

  const copy = storeLocationCopy();
  const title = section.querySelector('.admin-store-location-head h3');
  const description = section.querySelector('.admin-store-location-head .menu-category');
  const currentLocationLabel = section.querySelector('#adminUseCurrentLocation span');
  const map = section.querySelector('#adminStoreLocationMap');
  const status = section.querySelector('#adminStoreLocationStatus');

  if (title) title.textContent = copy.title;
  if (description) description.textContent = copy.description;
  if (currentLocationLabel) currentLocationLabel.textContent = copy.useCurrentLocation;
  if (map) map.setAttribute('aria-label', copy.mapAriaLabel);

  translateStoreLocationStatus(status);

  if (status && typeof MutationObserver === 'function' && !status.dataset.localeObserverInstalled) {
    status.dataset.localeObserverInstalled = '1';

    const observer = new MutationObserver(() => {
      translateStoreLocationStatus(status);
    });

    observer.observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
}

function safeInvalidate(map) {
  try {
    if (!map || typeof map.invalidateSize !== 'function') return;

    const container = map.getContainer?.();

    if (!container) return;

    const rect = container.getBoundingClientRect();

    if (rect.width < 50 || rect.height < 50) return;

    map.invalidateSize({
      animate: false,
      pan: false,
    });
  } catch (error) {
    console.warn('[admin-leaflet-layout] invalidate failed', error);
  }
}

function invalidateAll() {
  for (const map of registeredMaps) {
    safeInvalidate(map);
  }
}

function scheduleRefresh() {
  requestAnimationFrame(() => {
    invalidateAll();

    requestAnimationFrame(() => {
      invalidateAll();
    });
  });

  window.setTimeout(invalidateAll, 80);
  window.setTimeout(invalidateAll, 220);
  window.setTimeout(invalidateAll, 500);
  window.setTimeout(invalidateAll, 1000);
}

function installLeafletHook() {
  if (installed) return true;

  const leaflet = globalThis.L;

  if (!leaflet || typeof leaflet.map !== 'function') {
    return false;
  }

  installed = true;

  const originalMapFactory = leaflet.map.bind(leaflet);

  leaflet.map = function adminResponsiveLeafletMap(...args) {
    const map = originalMapFactory(...args);

    registeredMaps.add(map);

    const originalRemove = map.remove.bind(map);

    map.remove = function responsiveRemove(...removeArgs) {
      registeredMaps.delete(map);
      return originalRemove(...removeArgs);
    };

    scheduleRefresh();

    return map;
  };

  return true;
}


/*
 * Leaflet normally loads before admin.js.
 * Poll briefly as a fallback in case page asset ordering changes later.
 */

if (!installLeafletHook()) {
  const timer = window.setInterval(() => {
    if (installLeafletHook()) {
      window.clearInterval(timer);
      scheduleRefresh();
    }
  }, 20);

  window.setTimeout(() => {
    window.clearInterval(timer);
  }, 5000);
}


window.addEventListener('load', () => {
  localizeStoreLocationUi();
  scheduleRefresh();
});
window.addEventListener('resize', scheduleRefresh);
window.addEventListener('orientationchange', scheduleRefresh);


document.addEventListener('DOMContentLoaded', () => {
  localizeStoreLocationUi();
  scheduleRefresh();

  const candidates = [
    document.querySelector('#storeLocationMap'),
    document.querySelector('.admin-store-location-map'),
    document.querySelector('.store-location-map'),
  ].filter(Boolean);

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      scheduleRefresh();
    });

    for (const element of candidates) {
      observer.observe(element);

      let parent = element.parentElement;

      for (let depth = 0; parent && depth < 4; depth += 1) {
        observer.observe(parent);
        parent = parent.parentElement;
      }
    }
  }

  /*
   * Form sections can change dimensions when data finishes loading.
   */
  if (document.body && typeof MutationObserver === 'function') {
    let mutationTimer = null;

    const mutationObserver = new MutationObserver(() => {
      window.clearTimeout(mutationTimer);

      mutationTimer = window.setTimeout(() => {
        localizeStoreLocationUi();
        scheduleRefresh();
      }, 40);
    });

    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style'],
      childList: true,
      subtree: true,
    });
  }
});
