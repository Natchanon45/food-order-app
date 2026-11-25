import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("react-app/src/pages/AdminPage.jsx", "utf8");
const cssPath = "react-app/public/parity/css/admin-store-settings-workspace.css";
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";

test("store settings are organized into modern disclosure groups", () => {
  assert.match(page, /function AdminSettingsGroup/);
  for (const id of [
    "storeBasicsGroup",
    "storeLocationGroup",
    "storePaymentGroup",
    "storeDeliveryGroup",
    "storeLalamoveGroup",
    "storePromotionGroup",
    "storeFeeGroup",
  ]) {
    assert.ok(page.includes(`id="${id}"`), `missing ${id}`);
  }
  assert.match(page, /id="storeBasicsGroup"[\s\S]*?defaultOpen/);
});

test("unused Lalamove and delivery-fee details stay hidden until relevant", () => {
  assert.ok(page.includes("tenantLalamoveMode ? ("));
  assert.ok(page.includes('previewLalamoveMode === "fod_central" ? ('));
  assert.ok(page.includes("!lalamoveSelected ? ("));
});

test("store settings dashboard exposes configuration status before details", () => {
  assert.ok(page.includes('className="admin-store-settings-overview"'));
  assert.ok(page.includes('data-store-status="location"'));
  assert.ok(page.includes('data-store-status="payment"'));
  assert.ok(page.includes('data-store-status="delivery"'));
});

test("store workspace CSS provides responsive modern cards and hidden disclosure bodies", () => {
  assert.ok(css.includes(".admin-store-settings-overview"));
  assert.ok(css.includes(".admin-settings-group"));
  assert.ok(css.includes(".admin-settings-group-body"));
  assert.ok(css.includes("@media (max-width: 720px)"));
});

test("Source store group order and independent notification forms", () => {
  const store = page.slice(page.indexOf('cardKey="store"'), page.indexOf('cardKey="menu-list"'));
  const markers = ['id="storeBasicsGroup"', 'id="storeLocationGroup"', 'id="storeOpeningHoursGroup"',
    'id="storePaymentGroup"', 'id="storeDeliveryGroup"', 'id="storeLalamoveGroup"',
    'id="storePromotionGroup"', 'id="storeFeeGroup"', '</form>', '<PaymentCompanionPairingCard',
    'id="storeLKShopGroup"', 'id="storeTelegramGroup"', 'id="storeSettingsSaveButton"'];
  let previous = -1;
  for (const marker of markers) {
    const at = store.indexOf(marker);
    assert.ok(at > previous, marker + " missing or out of Source order");
    previous = at;
  }
  assert.match(store, /id="storeSettingsSaveButton" type="submit" form="storeForm"/);
});
