import fs from "node:fs";
import { expect, test } from "@playwright/test";

const matrix = JSON.parse(fs.readFileSync("react-app/migration/parity-verification-matrix.json", "utf8"));
const p0Routes = matrix.routes.filter(route => route.priority === "P0").map(route => route.route);

function reactUrl(route) {
  return route;
}

test.describe("P0 React route smoke", () => {
  for (const route of p0Routes) {
    test(`${route} resolves to a React page or intentional auth redirect`, async ({ page }) => {
      const pageErrors = [];
      page.on("pageerror", error => pageErrors.push(String(error?.message || error)));

      const response = await page.goto(reactUrl(route), { waitUntil: "domcontentloaded" });
      expect(response, `${route} must return an HTTP response`).not.toBeNull();
      expect(response.status(), `${route} must not return HTTP 4xx/5xx`).toBeLessThan(400);

      await page.waitForTimeout(250);
      const bodyText = (await page.locator("body").innerText()).trim();
      expect(bodyText, `${route} must render non-empty UI`).not.toBe("");
      expect(bodyText, `${route} must not render the React 404 fallback`).not.toMatch(/^404\s*$/);
      expect(pageErrors, `${route} must not throw an uncaught page error`).toEqual([]);
    });
  }
});

test.describe("P0 auth boundaries", () => {
  const protectedRoutes = [
    "/admin",
    "/admin/qr",
    "/admin/revenue-share",
    "/admin/sales-report",
    "/admin/tenants",
    "/admin/users",
    "/cashier",
    "/cashier/quick-order",
    "/cashier/receipt",
    "/cashier/table-qr",
    "/cashier/waiting-queue",
    "/platform",
    "/platform/contact",
    "/platform/owners",
    "/platform/pricing",
    "/super-admin/saas-setup",
    "/waiting-queue",
  ];

  for (const route of protectedRoutes) {
    test(`${route} does not expose protected workspace to an anonymous browser`, async ({ page }) => {
      await page.goto(reactUrl(route), { waitUntil: "domcontentloaded" });
      await page.waitForURL(url => url.pathname === "/login", { timeout: 10_000 });
      expect(page.url()).toContain("/login");
    });
  }
});

test.describe("P0 public Waiting Queue states", () => {
  test("customer page rejects an invalid tracking token without Firebase mutation", async ({ page }) => {
    await page.goto("/waiting-queue/customer?tenantId=test-tenant&token=short", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#waitingCustomerError")).toBeVisible();
    await expect(page.locator("#waitingCustomerError")).not.toHaveText("");
    await expect(page.locator("#waitingCustomerCard")).toHaveCount(0);
  });

  test("display page shows missing-link state without tenantId", async ({ page }) => {
    await page.goto("/waiting-queue/display", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#waitingDisplayCalledEmpty")).toBeVisible();
    await expect(page.locator("#waitingDisplayStatus")).toBeVisible();
    await expect(page.locator("#waitingDisplayFullscreen")).toBeVisible();
    await expect(page.locator("#waitingDisplaySound")).toBeVisible();
  });
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe(`P0 responsive public smoke: ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("customer invalid-link state stays within viewport", async ({ page }) => {
      await page.goto("/waiting-queue/customer?token=short", { waitUntil: "domcontentloaded" });
      const error = page.locator("#waitingCustomerError");
      await expect(error).toBeVisible();
      const box = await error.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    });

    test("display controls stay reachable", async ({ page }) => {
      await page.goto("/waiting-queue/display", { waitUntil: "domcontentloaded" });
      for (const selector of ["#waitingDisplaySound", "#waitingDisplayFullscreen"]) {
        const control = page.locator(selector);
        await expect(control).toBeVisible();
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });
  });
}


test.describe("P0 safe interaction behavior", () => {
  test("login uses Laravel-style inline validation instead of native browser bubbles", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#loginButton").click();

    await expect(page.locator("#email")).toHaveAttribute("data-validation-state", "invalid");
    await expect(page.locator("#password")).toHaveAttribute("data-validation-state", "invalid");
    const feedback = page.locator(".bootstrap-invalid-feedback.show");
    await expect(feedback).toHaveCount(2);
    await expect(feedback.first()).not.toHaveText("");
    await expect(page.locator("#loginError")).toBeHidden();
  });

  test("login shows a specific message when an expired tenant is redirected", async ({ page }) => {
    await page.goto("/login?reason=subscription_expired", { waitUntil: "domcontentloaded" });
    const error = page.locator("#loginError");
    await expect(error).toBeVisible();
    await expect(error).not.toHaveText("");
    await expect(error).not.toContainText("auth.login.errors");
  });

  test("global layer policy keeps Toast above Sweet Dialog above native Modal", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "ui-layer-test-style";
      style.textContent = `
        #uiLayerTestModal { width: 260px; height: 160px; padding: 20px; }
        #uiLayerTestSweet { display:grid!important; place-items:center!important; opacity:1!important; pointer-events:auto!important; }
        #uiLayerTestSweet > div { width:220px; height:120px; background:#fff; }
        #uiLayerTestToast { left:50%!important; top:50%!important; bottom:auto!important; width:180px!important; height:70px!important; opacity:1!important; transform:translate(-50%,-50%)!important; pointer-events:auto!important; display:grid!important; place-items:center!important; }
      `;
      document.head.appendChild(style);

      const modal = document.createElement("dialog");
      modal.id = "uiLayerTestModal";
      modal.textContent = "Modal";
      document.body.appendChild(modal);
      modal.showModal();

      const sweet = document.createElement("div");
      sweet.id = "uiLayerTestSweet";
      sweet.className = "sweet-dialog-backdrop show";
      sweet.innerHTML = '<div class="sweet-dialog">Sweet Dialog</div>';
      document.body.appendChild(sweet);

      const toast = document.createElement("div");
      toast.id = "uiLayerTestToast";
      toast.className = "app-toast show";
      toast.setAttribute("data-app-toast", "");
      toast.textContent = "Toast";
      document.body.appendChild(toast);
    });

    await expect.poll(() => page.evaluate(() => ({
      toastOpen: document.querySelector("#uiLayerTestToast")?.matches(":popover-open") || false,
      sweetOpen: document.querySelector("#uiLayerTestSweet")?.matches(":popover-open") || false,
      topId: document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest("#uiLayerTestToast, #uiLayerTestSweet, #uiLayerTestModal")?.id || "",
    }))).toEqual({ toastOpen: true, sweetOpen: true, topId: "uiLayerTestToast" });

    await page.evaluate(() => document.querySelector("#uiLayerTestToast")?.classList.remove("show"));
    await expect.poll(() => page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest("#uiLayerTestSweet, #uiLayerTestModal")?.id || ""))
      .toBe("uiLayerTestSweet");

    await page.evaluate(() => document.querySelector("#uiLayerTestSweet")?.classList.remove("show"));
    await expect.poll(() => page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest("#uiLayerTestModal")?.id || ""))
      .toBe("uiLayerTestModal");
  });

  test("login password visibility button changes field type and remains reversible", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const password = page.locator("#password");
    const toggle = page.locator("#togglePasswordBtn");

    await expect(password).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await toggle.click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("login language switch changes the active locale without navigation", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const beforeUrl = page.url();

    await page.locator(".app-locale-trigger").click();
    await page.locator('[data-locale-option="en"]').click();

    await expect(page.locator('input[data-locale-value]')).toHaveValue("en");
    await expect(page.locator('html')).toHaveAttribute("lang", "en");
    expect(page.url()).toBe(beforeUrl);
  });

  test("Waiting Queue display sound control records the user's opt-in without data writes", async ({ page }) => {
    await page.goto("/waiting-queue/display", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.removeItem("waiting_queue_display_sound"));

    const sound = page.locator("#waitingDisplaySound");
    await sound.click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("waiting_queue_display_sound"))).toBe("on");
  });

  test("Waiting Queue fullscreen action is safe when fullscreen is unavailable or denied", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(String(error?.message || error)));
    await page.goto("/waiting-queue/display", { waitUntil: "domcontentloaded" });
    await page.locator("#waitingDisplayFullscreen").click();
    await page.waitForTimeout(100);
    expect(pageErrors).toEqual([]);
  });
});
