import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useAuth } from "@/auth/AuthProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { auth } from "@/firebase/client";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { PlatformPage } from "@/pages/PlatformPage";
import { AdminPage } from "@/pages/AdminPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { AdminSalesReportPage } from "@/pages/AdminSalesReportPage";
import { AdminQrPage } from "@/pages/AdminQrPage";
import { RevenueShareReportPage } from "@/pages/RevenueShareReportPage";
import { KitchenPage } from "@/pages/KitchenPage";
import { CashierPage } from "@/pages/CashierPage";
import { CashierReceiptPage } from "@/pages/CashierReceiptPage";
import { CashierTableQrPage } from "@/pages/CashierTableQrPage";
import { QuickOrderPage } from "@/pages/QuickOrderPage";
import { WaitingQueuePage } from "@/pages/WaitingQueuePage";
import { WaitingQueueCustomerPage } from "@/pages/WaitingQueueCustomerPage";
import { WaitingQueueDisplayPage } from "@/pages/WaitingQueueDisplayPage";
import { PosPage } from "@/pages/PosPage";
import { PosCatalogPage } from "@/pages/PosCatalogPage";
import { PosProductsPage } from "@/pages/PosProductsPage";
import { PosCustomerDisplayPage } from "@/pages/PosCustomerDisplayPage";
import { PosReceiptPage } from "@/pages/PosReceiptPage";
import { PosTaxInvoicePage } from "@/pages/PosTaxInvoicePage";
import { PosSalesPage } from "@/pages/PosSalesPage";
import { PosTaxInvoicesPage } from "@/pages/PosTaxInvoicesPage";
import { PosReturnsPage } from "@/pages/PosReturnsPage";
import { PosShiftsPage } from "@/pages/PosShiftsPage";
import { PosStockMovementsPage } from "@/pages/PosStockMovementsPage";
import { PosStockCountsPage } from "@/pages/PosStockCountsPage";
import { PosPurchasesPage } from "@/pages/PosPurchasesPage";
import { PosPayablesPage } from "@/pages/PosPayablesPage";
import { PosSuppliersPage } from "@/pages/PosSuppliersPage";
import { PosCustomersPage } from "@/pages/PosCustomersPage";
import { PosSettingsPage } from "@/pages/PosSettingsPage";
import { PosBackupPage } from "@/pages/PosBackupPage";
import { PosUsersPage } from "@/pages/PosUsersPage";
import { AdminTenantsPage } from "@/pages/AdminTenantsPage";
import { PlatformOwnersPage } from "@/pages/PlatformOwnersPage";
import { PlatformContactPage } from "@/pages/PlatformContactPage";
import { PlatformPricingPage } from "@/pages/PlatformPricingPage";
import { SaasSetupPage } from "@/pages/SaasSetupPage";
import { PublicOrderPage } from "@/pages/PublicOrderPage";
import { TakeawayPage } from "@/pages/TakeawayPage";
import { DeliveryPage } from "@/pages/DeliveryPage";
import { DeliverySuccessPage } from "@/pages/DeliverySuccessPage";
import { VerifyPage } from "@/pages/VerifyPage";
import { LegalPage } from "@/pages/LegalPage";
import { PosForbiddenPage } from "@/pages/PosForbiddenPage";
import { PublicRouteMissingPage } from "@/pages/PublicRouteMissingPage";
import { LegacyStorefrontEntry } from "@/pages/LegacyStorefrontEntry";

function StorefrontAliasRedirect({ target }) {
  const { slug = "" } = useParams();
  return <Navigate to={"/s/" + encodeURIComponent(slug) + "/" + target + location.search + location.hash} replace />;
}

function NotFound() {
  return (
    <main className="container">
      <section className="card empty">
        <strong>404</strong>
      </section>
    </main>
  );
}

function tenantProtectedPath(pathname) {
  if (pathname === "/") return true;
  if (pathname === "/waiting-queue/customer" || pathname === "/waiting-queue/display") return false;
  return /^\/(?:admin|cashier|kitchen|waiting-queue|pos)(?:\/|$)/.test(pathname);
}

function TenantAccessLoginRedirect({ reason }) {
  useEffect(() => {
    let alive = true;
    const target = `/login?reason=${encodeURIComponent(reason)}`;
    signOut(auth)
      .catch(error => console.warn("TENANT_ACCESS_SIGN_OUT_FAILED", error))
      .finally(() => {
        if (alive) window.location.replace(target);
      });
    return () => { alive = false; };
  }, [reason]);
  return null;
}

function RevenueShareSuspensionGuard({ children }) {
  const authState = useAuth();
  const tenantState = useTenant();
  const location = useLocation();
  const profile = authState.profile;
  const tenant = tenantState.tenant;
  const suspended = tenant?.revenueShareSuspended === true
    && (tenant?.revenueShareEnabled === true || tenant?.billingMode === "revenue_share");
  const ownerAdmin = ["owner", "admin"].includes(profile?.role);
  const reportPath = location.pathname === "/reports/revenue-share" || location.pathname === "/admin/revenue-share";
  const tenantErrorCode = String(tenantState.error?.code || tenantState.error?.message || "");
  const loginReason = tenantErrorCode.includes("TENANT_SUBSCRIPTION_EXPIRED")
    ? "subscription_expired"
    : tenantErrorCode.includes("TENANT_SUSPENDED")
      ? "tenant_suspended"
      : tenantErrorCode.includes("TENANT_INACTIVE")
        ? "tenant_inactive"
        : "";

  if (profile && profile.role !== "super_admin" && tenantState.status === "error" && loginReason) {
    return <TenantAccessLoginRedirect reason={loginReason} />;
  }

  if (authState.status === "ready" && tenantState.status === "ready" && ownerAdmin && suspended && !reportPath && tenantProtectedPath(location.pathname)) {
    return <Navigate to="/reports/revenue-share" replace state={{ revenueShareSuspended: true, from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  return (
    <RevenueShareSuspensionGuard>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/platform" element={<PlatformPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/users" element={<AdminUsersPage />} />
      <Route path="/admin/sales-report" element={<AdminSalesReportPage />} />
      <Route path="/admin/qr" element={<AdminQrPage />} />
      <Route path="/admin/revenue-share" element={<RevenueShareReportPage />} />
      <Route path="/reports/revenue-share" element={<RevenueShareReportPage />} />
      <Route path="/kitchen" element={<KitchenPage />} />
      <Route path="/cashier" element={<CashierPage />} />
      <Route path="/cashier/quick-order" element={<QuickOrderPage />} />
      <Route path="/cashier/receipt" element={<CashierReceiptPage />} />
      <Route path="/cashier/table-qr" element={<CashierTableQrPage />} />
      <Route path="/cashier/waiting-queue" element={<WaitingQueuePage />} />
      <Route path="/waiting-queue" element={<WaitingQueuePage />} />
      <Route path="/waiting-queue/customer" element={<WaitingQueueCustomerPage />} />
      <Route path="/waiting-queue/display" element={<WaitingQueueDisplayPage />} />
      <Route path="/queue" element={<WaitingQueueCustomerPage />} />
      <Route path="/privacy" element={<LegalPage type="privacy" />} />
      <Route path="/terms" element={<LegalPage type="terms" />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/delivery" element={<PublicRouteMissingPage />} />
      <Route path="/delivery/success" element={<PublicRouteMissingPage />} />
      <Route path="/takeaway" element={<LegacyStorefrontEntry target="takeaway" allowStoredTenant />} />
      <Route path="/order" element={<PublicRouteMissingPage />} />
      <Route path="/pos/login" element={<Navigate to="/login?next=/pos/" replace />} />
      <Route path="/pos/forbidden" element={<PosForbiddenPage />} />
      <Route path="/pos" element={<PosPage />} />
      <Route path="/pos/catalog" element={<PosCatalogPage />} />
      <Route path="/pos/products" element={<PosProductsPage />} />
      <Route path="/pos/customer-display" element={<PosCustomerDisplayPage />} />
      <Route path="/pos/receipt" element={<PosReceiptPage />} />
      <Route path="/pos/tax-invoice" element={<PosTaxInvoicePage />} />
      <Route path="/pos/sales" element={<PosSalesPage />} />
      <Route path="/pos/tax-invoices" element={<PosTaxInvoicesPage />} />
      <Route path="/pos/returns" element={<PosReturnsPage />} />
      <Route path="/pos/shifts" element={<PosShiftsPage />} />
      <Route path="/pos/stock-movements" element={<PosStockMovementsPage />} />
      <Route path="/pos/stock-counts" element={<PosStockCountsPage />} />
      <Route path="/pos/purchases" element={<PosPurchasesPage />} />
      <Route path="/pos/payables" element={<PosPayablesPage />} />
      <Route path="/pos/suppliers" element={<PosSuppliersPage />} />
      <Route path="/pos/customers" element={<PosCustomersPage />} />
      <Route path="/pos/settings" element={<PosSettingsPage />} />
      <Route path="/pos/backup" element={<PosBackupPage />} />
      <Route path="/pos/users" element={<PosUsersPage />} />
      <Route path="/admin/tenants" element={<AdminTenantsPage />} />
      <Route path="/platform/owners" element={<PlatformOwnersPage />} />
      <Route path="/platform/contact" element={<PlatformContactPage />} />
      <Route path="/platform/pricing" element={<PlatformPricingPage />} />
      <Route path="/super-admin/saas-setup" element={<SaasSetupPage />} />
      <Route path="/s/:slug/order" element={<PublicOrderPage />} />
      <Route path="/s/:slug/takeaway" element={<TakeawayPage />} />
      <Route path="/s/:slug/delivery" element={<DeliveryPage />} />
      <Route path="/s/:slug/delivery/success" element={<DeliverySuccessPage />} />
      <Route path="/s/:slug/react/order" element={<StorefrontAliasRedirect target="order" />} />
      <Route path="/s/:slug/react/takeaway" element={<StorefrontAliasRedirect target="takeaway" />} />
      <Route path="/s/:slug/react/delivery" element={<StorefrontAliasRedirect target="delivery" />} />
      <Route path="/s/:slug/react/delivery/success" element={<StorefrontAliasRedirect target="delivery/success" />} />
      <Route path="*" element={<NotFound />} />
      </Routes>
    </RevenueShareSuspensionGuard>
  );
}
