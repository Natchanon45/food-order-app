import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const component = fs.readFileSync("react-app/src/components/PublicStorefront.jsx", "utf8");
const css = fs.readFileSync("react-app/public/parity/css/mobile-menu-scroll.css", "utf8");
test("Delivery mobile scroll tracking preserves Table Order behavior", () => {
  assert.match(component, /const scrollSpyEnabled = mobile && prefix === "order.menu" && activeCategory === all/);
  assert.match(component, /const deliveryScrollSpyEnabled = mobile && prefix === "delivery.checkout.menu" && activeCategory === all/);
  assert.match(component, /const trackCategoryScroll = scrollSpyEnabled \|\| deliveryScrollSpyEnabled/);
  assert.match(component, /setHighlightedCategory\(currentCard.dataset.menuCategory \|\| all\)/);
});
test("category strip follows the active menu category horizontally", () => {
  assert.match(component, /prefix !== "order.menu" && prefix !== "delivery.checkout.menu"/);
  assert.match(component, /tabs.scrollTo\(\{ left: Math.max\(0, left\), behavior: "smooth" \}\)/);
});
test("mobile Delivery tabs sticky independently, while search stays normal flow", () => {
  assert.match(css, /body.delivery-page \.menu-filter-area \{\s*display: contents !important;/);
  assert.match(css, /body.delivery-page \.category-tabs \{\s*position: sticky !important;/);
  assert.match(css, /body.delivery-page \.menu-filter-area \.menu-search \{\s*position: static !important;/);
});
