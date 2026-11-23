import { expect, test } from "@playwright/test";

const STORE_SLUG = process.env.DELIVERY_SUCCESS_STORE_SLUG || "saas-test-shop";
const ORDER_ID = String(process.env.DELIVERY_SUCCESS_ORDER_ID || "").trim();

test.describe("Delivery Success current Source UI parity (Firebase-backed)", () => {
  test.skip(!ORDER_ID, "Set DELIVERY_SUCCESS_ORDER_ID to a readable Delivery order.");

  async function openSuccess(page) {
    await page.goto(
      `/s/${encodeURIComponent(STORE_SLUG)}/delivery/success?order=${encodeURIComponent(ORDER_ID)}`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.locator("#customerReceipt")).toBeVisible({ timeout: 15_000 });
  }

  test("keeps storefront header and first card of three equal icon-only actions", async ({ page }) => {
    await openSuccess(page);
    await expect(page.locator("body")).toHaveClass(/order-delivery-workspace/);
    await expect(page.locator("body")).toHaveClass(/od-receipt-page/);
    await expect(page.locator("#orderAgainLink")).toHaveCount(0);
    await expect(page.locator("#orderAgainMobileLink")).toHaveAttribute("title", "สั่งเพิ่ม");
    await expect(page.locator("#verifyLatestLink")).toHaveAttribute("title", "ดูยอดล่าสุด");
    await expect(page.locator("#saveImageButton")).toHaveAttribute("title", "ดาวน์โหลดใบสั่งซื้อ");
    await expect(page.locator(".delivery-receipt-actions > *")).toHaveCount(3);
    const computed=await page.locator(".delivery-receipt-actions").evaluate(bar=>{
      const rect=bar.getBoundingClientRect();
      const buttons=[...bar.children].map(child=>child.getBoundingClientRect());
      return {
        grid:getComputedStyle(bar).gridTemplateColumns,
        headerBottom:document.querySelector(".app-header").getBoundingClientRect().bottom,
        actionsTop:rect.top,
        widths:buttons.map(x=>x.width),
        pageOverflow:document.documentElement.scrollWidth-innerWidth,
      };
    });
    expect(computed.actionsTop).toBeGreaterThanOrEqual(computed.headerBottom);
    expect(Math.max(...computed.widths)-Math.min(...computed.widths)).toBeLessThanOrEqual(2);
    expect(computed.pageOverflow).toBeLessThanOrEqual(2);
  });

  test("places toolbar above receipt/tracking; keeps order tracking independent of payment badge", async ({ page }) => {
    await openSuccess(page);
    await expect(page.locator("#deliveryTrackingCard")).toBeVisible();
    await expect(page.locator("#deliveryTrackingTimeline [data-tracking-step]")).toHaveCount(6);
    await expect(page.locator("#deliveryTrackingMessage")).not.toHaveText("");
    await expect(page.locator("#deliveryTrackingBadge")).not.toHaveText("");
    const order=await page.evaluate(()=>{
      const before=(a,b)=>Boolean(a&&b&&(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING));
      const toolbar=document.querySelector(".delivery-receipt-actions");
      const tracking=document.querySelector("#deliveryTrackingCard");
      const receipt=document.querySelector("#customerReceipt");
      const payment=document.querySelector("#customerQROrderReceived");
      return {
        toolbarBeforeTracking:before(toolbar,tracking),
        trackingBeforeReceipt:before(tracking,receipt),
        paymentInBetween:!payment||before(toolbar,payment)&&before(payment,tracking),
      };
    });
    expect(order).toEqual({
      toolbarBeforeTracking:true,trackingBeforeReceipt:true,paymentInBetween:true,
    });
  });

  test("retains all server-backed receipt fields and icon-only labels remain accessible", async ({ page }) => {
    await openSuccess(page);
    for(const id of ["shopName","shopAddress","shopPhone","receiptNumber",
      "receiptDate","receiptPayment","receiptRecipient","receiptPhone",
      "receiptAddress","receiptDeliveryZone","receiptItems","receiptSubtotal",
      "receiptDeliveryFee","receiptTotal","verifyQr"]){
      await expect(page.locator("#"+id)).toHaveCount(1);
    }
    await expect(page.locator("#receiptItems tr")).not.toHaveCount(0);
    for(const id of ["verifyLatestLink","saveImageButton","orderAgainMobileLink"]){
      const control=page.locator("#"+id);
      await expect(control.locator(".delivery-receipt-action-icon svg")).toHaveCount(1);
      await expect(control).toHaveAttribute("aria-label",/\S+/);
    }
  });

  test("downloads the order evidence as PNG like Laravel", async ({ page }) => {
    await openSuccess(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await page.locator("#saveImageButton").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^delivery-order-[A-Z0-9-]+\.png$/);
  });
});
