import { expect, test } from "@playwright/test";

const STORE_SLUG = process.env.DELIVERY_SUCCESS_STORE_SLUG || "saas-test-shop";
const ORDER_ID = String(process.env.DELIVERY_SUCCESS_ORDER_ID || "").trim();

test.describe("Delivery Success Laravel parity", () => {
  test.skip(!ORDER_ID, "Set DELIVERY_SUCCESS_ORDER_ID to a readable Delivery order.");

  async function openSuccess(page) {
    await page.goto(
      `/s/${encodeURIComponent(STORE_SLUG)}/delivery/success?order=${encodeURIComponent(ORDER_ID)}`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.locator("#customerReceipt")).toBeVisible({ timeout: 15_000 });
  }

  test("uses Laravel workspace body/theme and header structure", async ({ page }) => {
    await openSuccess(page);

    await expect(page.locator("body")).toHaveClass(/order-delivery-workspace/);
    await expect(page.locator("body")).toHaveClass(/od-receipt-page/);

    const header = page.locator(".app-header").first();
    const children = await header.evaluate(element =>
      [...element.children].map(child => child.id || child.className),
    );
    expect(children).toHaveLength(3);
    expect(String(children[0])).toContain("brand");
    expect(String(children[1])).toContain("orderAgainLink");
    expect(String(children[2])).toContain("app-locale-switcher");
    await expect(page.locator("#orderAgainLink")).toHaveText("สั่งเพิ่ม");
  });

  test("renders Laravel tracking card before toolbar and receipt", async ({ page }) => {
    await openSuccess(page);

    await expect(page.locator("#deliveryTrackingCard")).toBeVisible();
    await expect(page.locator("#deliveryTrackingTimeline [data-tracking-step]")).toHaveCount(6);
    await expect(page.locator("#deliveryTrackingMessage")).not.toHaveText("");
    await expect(page.locator("#deliveryTrackingBadge")).not.toHaveText("");

    const activeSteps = page.locator("#deliveryTrackingTimeline .is-current, #deliveryTrackingTimeline .is-done");
    await expect(activeSteps).not.toHaveCount(0);

    const order = await page.evaluate(() => {
      const tracking = document.getElementById("deliveryTrackingCard");
      const toolbar = document.querySelector(".receipt-toolbar");
      const receipt = document.getElementById("customerReceipt");
      const before = (a, b) => Boolean(
        a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
      return {
        trackingBeforeToolbar: before(tracking, toolbar),
        toolbarBeforeReceipt: before(toolbar, receipt),
      };
    });
    expect(order).toEqual({ trackingBeforeToolbar: true, toolbarBeforeReceipt: true });
  });

  test("matches Laravel toolbar and receipt hooks", async ({ page }) => {
    await openSuccess(page);

    const toolbar = page.locator(".receipt-toolbar");
    await expect(toolbar.locator("#saveImageButton")).toHaveText("ดาวน์โหลดใบสั่งซื้อ");
    await expect(toolbar.locator("#verifyLatestLink")).toHaveText("ดูยอดล่าสุด");
    await expect(toolbar.locator("#orderAgainLink")).toHaveCount(0);

    for (const id of [
      "shopName", "shopAddress", "shopPhone", "receiptNumber", "receiptDate",
      "receiptPayment", "receiptRecipient", "receiptPhone", "receiptAddress",
      "receiptDeliveryZone", "receiptItems", "receiptSubtotal", "receiptDeliveryFee",
      "receiptTotal", "verifyQr",
    ]) {
      await expect(page.locator("#" + id)).toHaveCount(1);
    }

    await expect(page.locator("#receiptItems tr")).not.toHaveCount(0);
    await expect(page.locator("#receiptItems .receipt-item-line")).not.toHaveCount(0);
  });

  test("visible action buttons follow the global icon and spacing policy", async ({ page }) => {
    await openSuccess(page);

    for (const selector of ["#orderAgainLink", "#saveImageButton", "#verifyLatestLink"]) {
      const button = page.locator(selector);
      await expect(button.locator(":scope > i.app-icon")).toHaveCount(1);
      await expect(button.locator(":scope > span")).toHaveCount(1);

      const metrics = await button.evaluate(element => {
        const style = getComputedStyle(element);
        const icon = element.querySelector(":scope > i.app-icon");
        const label = element.querySelector(":scope > span");
        const iconRect = icon?.getBoundingClientRect();
        const labelRect = label?.getBoundingClientRect();
        return {
          display: style.display,
          gap: Number.parseFloat(style.gap || "0") || 0,
          visualGap: iconRect && labelRect ? labelRect.left - iconRect.right : 0,
        };
      });

      expect(["inline-flex", "flex"]).toContain(metrics.display);
      expect(metrics.gap).toBeGreaterThanOrEqual(7);
      expect(metrics.visualGap).toBeGreaterThanOrEqual(7);
    }

    const spacing = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
      const brand = rect(".app-header .brand");
      const orderAgain = rect("#orderAgainLink");
      const locale = rect(".app-header .app-locale-switcher");
      const tracking = rect("#deliveryTrackingCard");
      const toolbar = rect(".receipt-toolbar");
      const save = rect("#saveImageButton");
      const verify = rect("#verifyLatestLink");
      const toolbarStyle = getComputedStyle(document.querySelector(".receipt-toolbar"));

      return {
        brandToOrderAgain: brand && orderAgain ? orderAgain.left - brand.right : 0,
        orderAgainToLocale: orderAgain && locale ? locale.left - orderAgain.right : 0,
        toolbarButtonGap: save && verify ? verify.left - save.right : 0,
        trackingToToolbar: tracking && toolbar ? toolbar.top - tracking.bottom : 0,
        toolbarBottomMargin: Number.parseFloat(toolbarStyle.marginBottom || "0") || 0,
      };
    });

    expect(spacing.brandToOrderAgain).toBeGreaterThanOrEqual(8);
    expect(spacing.orderAgainToLocale).toBeGreaterThanOrEqual(8);
    expect(spacing.toolbarButtonGap).toBeGreaterThanOrEqual(8);
    expect(spacing.trackingToToolbar).toBeGreaterThanOrEqual(12);
    expect(spacing.toolbarBottomMargin).toBeGreaterThanOrEqual(12);
  });

  test("downloads the order evidence as PNG like Laravel", async ({ page }) => {
    await openSuccess(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await page.locator("#saveImageButton").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^delivery-order-[A-Z0-9-]+\.png$/);
  });
});
