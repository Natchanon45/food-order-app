import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("react-app/public/parity/css/quick-order.css", "utf8");
const page = fs.readFileSync("react-app/src/pages/QuickOrderPage.jsx", "utf8");

test("Quick Order back arrow is vertically aligned without affecting other icons", () => {
  assert.match(css, /\.quick-order-page \.quick-header-back \{[\s\S]*?align-items: center;[\s\S]*?justify-content: center;/);
  assert.match(css, /\.quick-order-page \.quick-header-back > i\.app-icon \{[\s\S]*?display: inline-grid;[\s\S]*?place-items: center;[\s\S]*?height: 18px;/);
  assert.match(css, /\.quick-order-page \.quick-header-back > i\.app-icon::before \{[\s\S]*?line-height: 1;/);
});

test("Mobile back arrow is centered on both axes inside a square control", () => {
  const mobile = css.slice(css.lastIndexOf("@media (max-width: 640px)"));
  assert.match(mobile, /\.quick-order-page \.quick-header-back \{[\s\S]*?align-items: center;[\s\S]*?justify-content: center;[\s\S]*?width: 40px;[\s\S]*?height: 40px;/);
  assert.match(css, /\.quick-header-back span \{[\s\S]*?display: none;/);
  assert.match(page, /className="btn quick-header-back" to="\/cashier" aria-label=\{t\("quick_order.actions.back_cashier"\)\}/);
});
