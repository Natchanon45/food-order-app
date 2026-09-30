import { useEffect, useState } from "react";

const BASE = "/react/parity/css/";

function ensureStylesheet(name) {
  const href = BASE + name;
  const existing = document.head.querySelector(`link[data-parity-page-style="${name}"]`);
  if (existing) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.parityPageStyle = name;
    link.onload = () => resolve(link);
    link.onerror = () => reject(new Error(`PARITY_STYLE_LOAD_FAILED:${name}`));
    document.head.appendChild(link);
  });
}

export function useParityPage({ bodyClass = "", title = "KINJAI", styles = [], attributes = {}, disabledGlobalStyles = [] }) {
  const [stylesReady, setStylesReady] = useState(styles.length === 0);
  const styleKey = styles.join("|");
  const disabledStyleKey = disabledGlobalStyles.join("|");
  const attrsKey = JSON.stringify(attributes);

  useEffect(() => {
    const previousClass = document.body.className;
    const previousTitle = document.title;
    const previousAttrs = new Map();
    const previousDisabledStyles = new Map();

    if (disabledGlobalStyles.length) {
      const disabledNames = new Set(disabledGlobalStyles);
      document.head.querySelectorAll('link[rel="stylesheet"][href]').forEach(link => {
        let name = "";
        try { name = new URL(link.href, location.origin).pathname.split("/").pop() || ""; } catch {}
        if (!disabledNames.has(name)) return;
        previousDisabledStyles.set(link, link.disabled);
        link.disabled = true;
      });
    }

    document.body.className = bodyClass;
    document.title = title;

    Object.entries(attributes).forEach(([key, value]) => {
      previousAttrs.set(key, document.body.getAttribute(key));
      if (value === null || value === undefined || value === false) document.body.removeAttribute(key);
      else document.body.setAttribute(key, String(value));
    });

    let active = true;
    setStylesReady(styles.length === 0);
    Promise.all(styles.map(ensureStylesheet))
      .then(() => { if (active) setStylesReady(true); })
      .catch(error => {
        console.error(error);
        if (active) setStylesReady(false);
      });

    return () => {
      active = false;
      document.body.className = previousClass;
      document.title = previousTitle;
      previousAttrs.forEach((value, key) => {
        if (value === null) document.body.removeAttribute(key);
        else document.body.setAttribute(key, value);
      });
      previousDisabledStyles.forEach((wasDisabled, link) => { link.disabled = wasDisabled; });
    };
  }, [bodyClass, title, styleKey, attrsKey, disabledStyleKey]);

  return stylesReady;
}
