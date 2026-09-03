import { dataService } from "./data-service.js?v=20260903-203";
import { ensureAdminSessionContext } from "./admin-session-bootstrap.js?v=20260903-203";
import { t } from "./i18n.js?v=20260903-202";

function qrImageUrl(value) {
  return `https://quickchart.io/qr?text=${encodeURIComponent(value)}&size=720&margin=2&ecLevel=H`;
}

async function qrControls(id) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const input = document.querySelector(`#${id}Link`);
    const image = document.querySelector(`#${id}Image`);
    const preview = document.querySelector(`#${id}Preview`);
    const shopLabel = document.querySelector(`#${id}ShopName`);
    if (input && image && preview && shopLabel) {
      return { input, image, preview, shopLabel };
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return null;
}

async function recoverQr(id, path) {
  const controls = await qrControls(id);
  if (!controls || controls.input.value) return;

  const user = await ensureAdminSessionContext();
  const tenant = dataService.getActiveShop();
  const slug = tenant.slug || user?.tenantSlug || "";
  if (!slug) throw new Error("TENANT_SLUG_MISSING");

  const settings = await dataService.getStoreSettings();
  const url = `${location.origin}/s/${encodeURIComponent(slug)}/${path}`;
  controls.input.value = url;
  controls.shopLabel.textContent = settings.shopName || tenant.name || user?.tenantName || t("admin.common.restaurant_fallback");
  controls.image.src = qrImageUrl(url);
  controls.preview.hidden = false;
}

await Promise.allSettled([
  recoverQr("deliveryQr", "delivery"),
  recoverQr("takeawayQr", "takeaway"),
]);
