from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/react/index.html"
TARGETS = [
    "public/login/index.html",
    "public/register/index.html",
    "public/pos/index.html",
    "public/pos/sales/index.html",
    "public/pos/tax-invoices/index.html",
    "public/pos/returns/index.html",
    "public/pos/shifts/index.html",
    "public/pos/products/index.html",
    "public/pos/stock-movements/index.html",
    "public/pos/stock-counts/index.html",
    "public/pos/purchases/index.html",
    "public/kitchen/index.html",
    "public/cashier/index.html",
    "public/cashier/receipt/index.html",
    "public/cashier/table-qr/index.html",
    "public/cashier/waiting-queue/index.html",
    "public/waiting-queue/index.html",
    "public/waiting-queue/customer/index.html",
    "public/waiting-queue/display/index.html",
    "public/admin/index.html",
    "public/admin/qr/index.html",
    "public/admin/revenue-share/index.html",
    "public/admin/sales-report/index.html",
    "public/admin/tenants/index.html",
    "public/admin/users/index.html",
    "public/platform/index.html",
    "public/platform/owners/index.html",
    "public/platform/contact/index.html",
    "public/platform/pricing/index.html",
    "public/reports/revenue-share/index.html",
    "public/super-admin/saas-setup/index.html",
]

if not SOURCE.exists():
    raise SystemExit(f"React entry not built: {SOURCE}")

for relative in TARGETS:
    target = ROOT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, target)
    print(f"synced {relative}")
