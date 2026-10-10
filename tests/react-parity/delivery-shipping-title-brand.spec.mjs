import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const delivery = fs.readFileSync("react-app/src/pages/DeliveryPage.jsx", "utf8");
const css = fs.readFileSync("react-app/public/parity/css/store-hero-branding.css", "utf8");
const brand = fs.readFileSync("react-app/src/components/StoreHeroBranding.jsx", "utf8");

test("Delivery shipping title keeps the tenant logo with its own isolated centered row", () => {
  assert.match(delivery, /className="section-title delivery-shipping-title"><h2 className="delivery-shipping-title-row"><StoreBrandMark settings=\{settings\} className="store-hero-brand-mark-section"/);
  assert.match(css, /body\.delivery-page \.delivery-shipping-title h2\.delivery-shipping-title-row \{/);
  assert.match(css, /column-gap: 14px;/);
  assert.match(css, /column-gap: 12px;/);
  assert.match(css, /place-items: center;/);
  assert.match(css, /object-position: 50% 50%;/);
  assert.match(css, /flex: 0 0 42px;/);
  assert.match(css, /flex-basis: 38px;/);
});

test("Uploaded logo and default shop icon still use the same tenant branding component", () => {
  assert.match(brand, /settings\.shopLogoUrl \|\| settings\.logoUrl/);
  assert.match(brand, /bi bi-shop-window store-hero-fallback-icon/);
  assert.match(css, /img:not\(\[hidden\]\) \+ \.store-hero-fallback-icon/);
  assert.match(css, /img\[hidden\] \+ \.store-hero-fallback-icon/);
  assert.match(css, /\.store-branded-hero\.hero/);
});
