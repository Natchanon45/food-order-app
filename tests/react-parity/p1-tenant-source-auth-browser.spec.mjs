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
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe("Authenticated P1 source Tenant Control " + view.name, () => {
    test.use({ viewport: { width: view.width, height: view.height } });
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
