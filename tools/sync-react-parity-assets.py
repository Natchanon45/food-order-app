import json
import re
import shutil
import subprocess
from pathlib import Path

target = Path("/Users/natchanonsripleng/Desktop/Sites/food-order-app")
source = Path("/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80")

css_dir = target / "react-app/public/parity/css"
css_dir.mkdir(parents=True, exist_ok=True)
js_dir = target / "react-app/src/ui"
js_dir.mkdir(parents=True, exist_ok=True)
payment_branding_dir = target / "public/assets/images/payment-branding"
payment_branding_dir.mkdir(parents=True, exist_ok=True)

for name in [
    "app.css",
    "icons.css",
    "sweet-dialog.css",
    "cashier-refresh.css",
    "order-delivery-workspace-theme.css",
    "customer-rounds.css",
    "pos-refresh.css",
    "table-order-sticky-lite.css",
    "public-menu-image-frame.css",
    "payment-slip.css",
    "delivery-addresses.css",
    "delivery-location-map.css",
    "delivery-promotions.css",
    "delivery-favorites.css",
    "delivery-google-font-mobile-spacing.css",
    "delivery-google-normal-button.css",
    "mobile-menu-scroll.css",
    "delivery-payment-lock.css",
    "receipt-layout.css",
    "delivery-success-tracking.css",
    "page-ready-state.css",
    "quick-order.css",
    "kitchen-item-editor.css",
    "shared-responsive.css",
    "i18n.css",
    "theme-checkbox.css",
    "unified-table-icon.css",
    "toast-system.css",
    "ui-layer-stack.css",
    "home-dashboard.css",
    "public-contact.css",
    "public-utility-actions.css",
    "platform-control-center.css",
    "tenant-admin.css",
    "tenant-card-independent-height.css",
    "tenant-admin-clarity.css",
    "tenant-admin-compact.css",
    "revenue-share-report.css",
    "revenue-share-slip-dialog.css",
    "platform-contact-settings.css",
    "platform-google-login-settings.css",
    "menu-pagination.css",
    "admin-sort.css",
    "admin-workspace.css",
    "admin-retail-pos-parity.css",
    "admin-modal-retail-pos-parity.css",
    "admin-delivery-fee-row-alignment.css",
    "admin-store-location.css",
    "admin-delivery-providers.css",
    "admin-delivery-promotions.css",
    "admin-upload.css",
    "admin-mobile-table.css",
    "admin-users.css",
    "sales-report.css",
    "sales-report-modern.css",
    "admin-sales-report-retail-pos-parity.css",
    "sales-report-period-tabs.css",
    "menu-qr.css",
    "admin-icon-polish.css",
    "pos-locale-switcher-placement.css",
    "retail-pos-catalog.css",
    "retail-products.css",
    "retail-products-sort-manager.css",
    "retail-product-categories.css",
    "retail-product-merchandising.css",
    "retail-customer-display.css",
    "retail-customer-display-responsive.css",
    "retail-customer-display-qr-consistency.css",
    "retail-pos-font-local.css",
    "retail-pos-tailwind-responsive.css",
    "retail-sales.css",
    "retail-sales-mobile.css",
    "retail-returns.css",
    "retail-returns-mobile.css",
    "retail-return-receipt.css",
    "retail-shifts.css",
    "retail-stock-movements.css",
    "retail-stock-movements-scroll.css",
    "retail-stock-counts.css",
    "retail-purchases.css",
    "retail-purchases-report.css",
    "retail-payables.css",
    "retail-suppliers.css",
    "retail-customers.css",
    "retail-loyalty.css",
    "retail-pos-settings.css",
    "retail-pos-backup.css",
    "retail-pos-users-layout.css",
    "retail-pos-users-mobile.css",
]:
    destination = css_dir / name
    shutil.copy2(source / "public/assets/css" / name, destination)
    destination.write_text(destination.read_text().rstrip() + "\n")

def extract_runtime_css(script_name, output_name, include_appends=False):
    text = (source / "public/assets/js" / script_name).read_text()
    match = re.search(r"style\.textContent\s*=\s*`(.*?)`;", text, flags=re.S)
    if not match:
        raise RuntimeError(f"Runtime CSS block not found: {script_name}")
    css = match.group(1).strip()
    if include_appends:
        for extra in re.findall(r"style\.textContent\s*\+=\s*'([^']*)';", text):
            css += "\n" + extra.replace('\\\"', '"').replace("\\'", "'")
    (css_dir / output_name).write_text(css + "\n")

extract_runtime_css("app-version-badge.js", "app-version-badge-runtime.css")
extract_runtime_css("retail-mobile-cart-bar.js", "retail-mobile-cart-bar.css")
extract_runtime_css("retail-pos-payment-enter.js", "retail-pos-payment-enter.css", include_appends=True)
extract_runtime_css("retail-pos-promptpay-payment.js", "retail-pos-promptpay-payment.css")
extract_runtime_css("retail-barcode-scan-tools.js", "retail-barcode-scan-tools.css")

for name in ["thai-qr-payment.svg", "promptpay.svg", "thai-qr-payment-mark.png"]:
    shutil.copy2(source / "public/assets/images/payment-branding" / name, payment_branding_dir / name)

# React's Top Layer manager is runtime safety code, not a visual parity asset.
# Never overwrite react-app/src/ui/toast-top-layer.js from Laravel here; doing
# so can silently restore an older Popover implementation after a parity sync.
views = {
    "home-page.css": source / "resources/views/migrated/home.blade.php",
    "login-page.css": source / "resources/views/migrated/login.blade.php",
    "register-page.css": source / "resources/views/migrated/register.blade.php",
    "platform-pricing-page.css": source / "resources/views/migrated/platform__pricing.blade.php",
    "pos-receipt-page.css": source / "resources/views/migrated/pos__receipt.blade.php",
    "pos-tax-invoice-page.css": source / "resources/views/migrated/pos__tax_invoice.blade.php",
    "pos-tax-invoices-page.css": source / "resources/views/migrated/pos__tax_invoices.blade.php",
}
for output, view in views.items():
    text = view.read_text()
    blocks = re.findall(r"<style>(.*?)</style>", text, flags=re.S)
    (css_dir / output).write_text("\n\n".join(block.strip() for block in blocks) + "\n")

locale_names = ["th", "en", "my", "lo", "km"]
translation_files = sorted({
    file.stem
    for locale in locale_names
    for file in (source / "resources/lang" / locale).glob("*.php")
})
translations = {}
for locale in locale_names:
    translations[locale] = {}
    for name in translation_files:
        file = source / "resources/lang" / locale / f"{name}.php"
        if not file.exists():
            translations[locale][name] = {}
            continue
        payload = subprocess.check_output([
            "php",
            "-r",
            "$x=require $argv[1]; echo json_encode($x,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);",
            str(file),
        ], text=True)
        translations[locale][name] = json.loads(payload)

def deep_merge(base, override):
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], value)
        else:
            base[key] = value

storefront_overrides = target / "react-app/src/i18n/public-storefront-overrides.json"
if storefront_overrides.exists():
    deep_merge(translations, json.loads(storefront_overrides.read_text()))

out = target / "react-app/src/i18n/parity-translations.json"
out.write_text(json.dumps(translations, ensure_ascii=False, indent=2) + "\n")
print("Parity CSS/translations synced from Laravel baseline + React storefront overrides")
