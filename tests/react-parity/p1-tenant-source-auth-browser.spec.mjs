import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
if (!getApps().length) initializeApp({ projectId: "demo-penguin-hybrid" });
const db = getFirestore();
const auth = getAuth();
const tenantId = "p1-browser-tenant";
const email = "p1-browser-superadmin@example.com";
const ownerEmail = "p1-browser-owner@example.com";
const password = "p1-browser-emulator-only-987";
const tenant = {
  id: tenantId, name: "ร้านตัวอย่าง Phase 1", slug: "p1-browser-shop",
  active: true, firstActivatedAt: "2026-10-18T03:00:00.000Z",
  subscriptionExpiresAt: "2026-11-18T03:00:00.000Z",
  trialEndsAt: "2026-11-17T16:59:59.999Z",
  subscriptionStatus: "trialing", planCode: "monthly",
  billingMode: "subscription", businessType: "both",
  shopPhone: "021234567", shopAddress: "Bangkok",
  ownerUid: "p1-browser-owner", ownerDisplayName: "Owner Sample",
  ownerEmail: "owner@example.com",
  lalamove: { accountMode: "disabled" },
};
test.beforeAll(async () => {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
    process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") {
    throw new Error("P1_BROWSER_REQUIRES_DEMO_EMULATORS");
  }
  let u;
  try { u = await auth.getUserByEmail(email); }
  catch { u = await auth.createUser({ email, password, emailVerified: true }); }
  await db.collection("users").doc(u.uid).set({
    uid: u.uid, email, role: "super_admin", active: true,
    displayName: "Demo Super Admin",
  });
  let owner;
  try { owner = await auth.getUserByEmail(ownerEmail); }
  catch { owner = await auth.createUser({ email: ownerEmail, password, emailVerified: true }); }
  await db.collection("users").doc(owner.uid).set({ uid: owner.uid, email: ownerEmail,
    role: "owner", active: true, tenantId, tenantSlug: tenant.slug });
  await db.collection("tenants").doc(tenantId).collection("memberships").doc("p1-browser-cashier").set({
    uid: "p1-browser-cashier", tenantId, role: "cashier", active: true,
    displayName: "Emulator Cashier", email: "cashier-demo@example.com", businessScope: "order_delivery",
    staffScope: "restaurant", businessUnit: "order_delivery",
  });
  await db.collection("tenants").doc(tenantId).set(tenant);
  await db.collection("tenants").doc(tenantId).collection("settings").doc("store")
    .set({ shopName: tenant.name, bankName: "Demo Bank",
      bankAccountName: "Store Owner",
      bankAccountNumber: "9998887777", promptPayId: "0811112222",
      promptPayName: "Store Owner", deliveryPromptPayEnabled: true });
});
async function mockNonMutatingFunctions(page) {
  const functionReads = {
    listTenants: { tenants: [tenant] },
    backfillTenantSubscriptions: { ok: true, updated: 0 },
    listPlatformRevenueSharePayments: {
      items: [], counts: { pending: 0, approved: 0, rejected: 0 },
    },
    getPlatformRevenueShareSummary: {
      tenants: { [tenantId]: { orderSales: 0, posSales: 0,
        combinedSales: 0, revenueShare: 0, platformAmountDue: 0 } },
      totals: {}, period: {},
    },
    getTenantLalamoveWallet: {
      wallet: { balance: 0 }, items: [], topups: [],
    },
    getPlatformTenantHybridInvoiceEvidence: {
      ok: true, available: true, tenantId,
      source: "hybrid_billing_period_firestore", status: "source_records_only",
      coverage: "single_cycle_only", bankSourceVerified: false,
      originalSignupVerified: false, canIssueRealInvoice: false,
      canSettleMoney: false, canReleaseTenant: false,
      invoiceEvidence: {
        cycleStartDate: "2026-10-18", cycleEndExclusiveDate: "2026-11-18",
        invoiceCount: 1, recordedAmountCents: 17500,
        recordedOpenAmountCents: 17500,
        invoices: [{
          id: "2026-10-18:delivery:trigger",
          kind: "delivery_threshold", date: "2026-11-05",
          dueDate: "2026-11-05", status: "issued", amountCents: 17500,
          bankVerified: false, settlementAuthority: false,
        }],
      },
    },
    getPlatformTenantSavedPaymentAccount: {
      ok: true, readOnly: true, tenantId,
      source: "firebase_saved_store_settings",
      account: {
        bankName: "Demo Bank", bankAccountName: "Store Owner",
        bankAccountMasked: "•••• 7777", promptPayMasked: "•••• 2222",
        promptPayName: "Store Owner", deliveryPromptPayEnabled: true,
        ownershipVerified: false,
      },
    },
  };
  await page.route("**/demo-penguin-hybrid/asia-southeast1/**", async route => {
    const endpoint = new URL(route.request().url()).pathname.split("/").pop();
    const allow = { "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization",
      "content-type": "application/json" };
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: allow });
    }
    if (!Object.hasOwn(functionReads, endpoint)) {
      return route.fulfill({ status: 404, headers: allow,
        body: JSON.stringify({ error: { status: "NOT_FOUND",
          message: "Demo Callable not mocked: " + endpoint } }) });
    }
    return route.fulfill({
      status: 200, headers: allow,
      body: JSON.stringify({ result: functionReads[endpoint] }),
    });
  });
}
for (const view of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe("Authenticated P1 source Tenant Control " + view.name, () => {
    test.use({ viewport: { width: view.width, height: view.height } });
    test("Owner staff page uses the actual scoped list handler and denies platform access", async ({ page }) => {
      let reads = 0;
      await page.route("**/demo-penguin-hybrid/asia-southeast1/**", async route => {
        const allow = { "access-control-allow-origin": "*", "access-control-allow-headers": "*",
          "access-control-allow-methods": "POST, OPTIONS", "content-type": "application/json" };
        if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: allow });
        const endpoint = new URL(route.request().url()).pathname.split("/").pop();
        if (endpoint !== "listTenantStaff") return route.fulfill({ status: 403, headers: allow,
          body: JSON.stringify({ error: { status: "PERMISSION_DENIED", message: "Read-only test bridge" } }) });
        const bearer = route.request().headers().authorization?.replace(/^Bearer /, "");
        const decoded = await auth.verifyIdToken(bearer);
        const data = route.request().postDataJSON().data;
        expect(data.expectedTenantId).toBe(tenantId);
        const result = await require("./staff-admin").listTenantStaff.run({
          auth: { uid: decoded.uid, token: decoded }, data,
        });
        reads++;
        return route.fulfill({ status: 200, headers: allow, body: JSON.stringify({ result }) });
      });
      await page.goto("/login?next=%2Fadmin%2Fusers");
      await page.locator("#email").fill(ownerEmail);
      await page.locator("#password").fill(password);
      await page.locator("#loginButton").click();
      await page.waitForURL(url => url.pathname !== "/login", { timeout: 20000 });
      await page.goto("/admin/users");
      await expect(page.locator("#openCreateUserModal")).toBeEnabled({ timeout: 15000 });
      await expect(page.getByText("cashier-demo@example.com").filter({ visible: true }).first()).toBeVisible();
      expect(reads).toBeGreaterThan(0);
      await page.locator("#openCreateUserModal").click();
      await expect(page.locator("dialog #displayName")).toBeVisible();
      await page.goto("/platform/pricing");
      await page.waitForURL(url => url.pathname !== "/platform/pricing", { timeout: 15000 });
    });
    test("six platform routes render with signed-in Auth and staff route rejects Super Admin", async ({ page }) => {
      const errors = [];
      page.on("pageerror", e => errors.push(String(e.message || e)));
      await mockNonMutatingFunctions(page);
      await page.goto("/login?next=%2Fplatform");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.locator("#loginButton").click();
      await page.waitForURL(url => url.pathname !== "/login", { timeout: 20000 });
      for (const path of ["/platform", "/platform/owners", "/platform/contact",
        "/platform/pricing", "/admin/tenants", "/super-admin/saas-setup"]) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("main h1").first()).toBeVisible({ timeout: 15000 });
        expect(new URL(page.url()).pathname).toBe(path);
        // These two read callables intentionally fail in the read-only fixture.
        // Their write controls must stay closed after inspection/config failure.
        if (path === "/platform/pricing") await expect(page.locator("#pricingSave")).toBeDisabled();
        if (path === "/super-admin/saas-setup") await expect(page.locator("#startMigration")).toBeDisabled();
      }
      await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
      await page.waitForURL(url => url.pathname !== "/admin/users", { timeout: 15000 });
      expect(errors).toEqual([]);
    });
    test("displays source card, activation date, masked account and 3-step store setup", async ({ page }) => {
      const errors = [];
      page.on("pageerror", e => errors.push(String(e.message || e)));
      await mockNonMutatingFunctions(page);
      await page.goto("/login?next=%2Fadmin%2Ftenants", { waitUntil: "domcontentloaded" });
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.locator("#loginButton").click();
      // Never interrupt Firebase sign-in before AuthProvider persists session.
      await page.waitForURL(url => url.pathname !== "/login", { timeout: 20000 });
      if (new URL(page.url()).pathname !== "/admin/tenants") {
        await page.goto("/admin/tenants", { waitUntil: "domcontentloaded" });
      }
      const card = page.locator('[data-tenant-control="' + tenantId + '"]');
      await expect(card).toBeVisible({ timeout: 15000 });
      await expect(card.locator('[data-tenant-first-activation="' + tenantId + '"]'))
        .toContainText("18/10/2569");
      await expect(card.locator("[data-tenant-summary-cards]")).toBeVisible();
      await card.locator("button.tenant-control-expand-btn").click();
      await expect(card.locator('[data-tenant-control-section="registration"]')).toBeVisible();
      const evidence = card.locator('[data-tenant-hybrid-finance-evidence="' + tenantId + '"]');
      await expect(evidence).toHaveAttribute("data-tenant-hybrid-evidence-state", "ready");
      await expect(evidence).toContainText("175.00");
      await expect(evidence).toContainText("ไม่ใช่หลักฐานธนาคาร");
      const payment = card.locator('[data-tenant-profile="payment"]');
      await expect(payment).toContainText("•••• 7777");
      await expect(payment).toContainText("•••• 2222");
      await expect(payment).not.toContainText("9998887777");
      await expect(payment).not.toContainText("0811112222");
      await page.locator("#openTenantCreateButton").click();
      await expect(page.locator("#tenantOwnerName")).toBeVisible();
      await expect(page.locator("#tenantOwnerEmail")).toBeVisible();
      await expect(page.locator("#tenantOwnerPassword")).toBeVisible();
      await expect(page.locator("#tenantOwnerPasswordConfirm")).toBeVisible();
      await expect(page.locator("#tenantNewPlanCode")).toBeVisible();
      await expect(page.locator("#tenantNewBusinessType")).toBeVisible();
      await expect(page.locator('[data-new-store-owner-fields]')).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
