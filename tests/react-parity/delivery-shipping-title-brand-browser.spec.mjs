import { test, expect } from "@playwright/test";
import fs from "node:fs";

const cssFiles = [
  "app.css", "store-hero-branding.css", "icons.css", "order-delivery-workspace-theme.css",
  "delivery-google-font-mobile-spacing.css", "shared-responsive.css",
];
const css = cssFiles.map(f => fs.readFileSync("react-app/public/parity/css/" + f, "utf8")).join("\n");
const logo = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffffff"/><circle cx="50" cy="50" r="36" fill="#148b53"/></svg>');

for (const width of [320, 440, 1280]) {
  for (const type of ["logo", "fallback"]) {
    test("Shipping logo centers on both axes with title gap " + type + " at " + width + "px", async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      try {
        await page.setContent(
          '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style></head>' +
          '<body class="delivery-page"><main class="container"><section class="card"><div class="section-title delivery-shipping-title">' +
          '<h2 class="delivery-shipping-title-row">' +
          '<span class="store-hero-brand-mark store-hero-brand-mark-section" aria-hidden="true">' +
          (type === "logo" ? '<img src="' + logo + '" alt="">' : "") +
          '<i class="bi bi-shop-window store-hero-fallback-icon" aria-hidden="true"></i></span>' +
          '<span>ข้อมูลจัดส่ง</span></h2></div></section></main></body></html>'
        );
        await expect(page.locator(".delivery-shipping-title-row")).toBeVisible();
        const metrics = await page.evaluate(() => {
          const heading = document.querySelector(".delivery-shipping-title-row");
          const tile = heading.firstElementChild;
          const text = heading.lastElementChild;
          const tileBox = tile.getBoundingClientRect();
          const textBox = text.getBoundingClientRect();
          const inner = tile.querySelector("img") || tile.querySelector(".store-hero-fallback-icon");
          const innerBox = inner.getBoundingClientRect();
          const tileStyle = getComputedStyle(tile);
          const glyphStyle = getComputedStyle(inner);
          return {
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            gap: textBox.left - tileBox.right,
            verticalOffset: Math.abs((tileBox.top + tileBox.height / 2) - (textBox.top + textBox.height / 2)),
            horizontalOffset: Math.abs((tileBox.left + tileBox.width / 2) - (innerBox.left + innerBox.width / 2)),
            iconVerticalOffset: Math.abs((tileBox.top + tileBox.height / 2) - (innerBox.top + innerBox.height / 2)),
            display: tileStyle.display,
            objectPosition: inner.tagName === "IMG" ? glyphStyle.objectPosition : null,
            width: tileBox.width,
          };
        });
        expect(metrics.pageOverflow).toBe(false);
        expect(metrics.display).toBe("grid");
        expect(metrics.gap).toBeGreaterThanOrEqual(11.5);
        expect(metrics.verticalOffset).toBeLessThanOrEqual(1);
        expect(metrics.horizontalOffset).toBeLessThanOrEqual(1);
        expect(metrics.iconVerticalOffset).toBeLessThanOrEqual(1);
        expect(metrics.width).toBe(width <= 480 ? 38 : 42);
        if (type === "logo") expect(metrics.objectPosition).toBe("50% 50%");
      } finally { await context.close(); }
    });
  }
}
