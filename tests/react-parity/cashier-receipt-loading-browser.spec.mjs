import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("react-app/src/utils/receiptPrintWindow.js", "utf8")
  .replaceAll("export function ", "function ")
  + "\nwindow.__receiptLoading = { openReceiptPrintLoading, updateReceiptPrintLoading };";

for (const width of [390, 1280]) {
  test("Cashier print tab shows centered loader immediately at width " + width, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    try {
      await page.setContent('<button id="approve">Confirm payment</button>');
      await page.addScriptTag({ content: source });
      await page.evaluate(() => document.querySelector("#approve").addEventListener("click", () => {
        const { openReceiptPrintLoading, updateReceiptPrintLoading } = window.__receiptLoading;
        const tab = openReceiptPrintLoading({
          title: "กำลังยืนยันการชำระเงิน", message: "ระบบกำลังตรวจสอบและบันทึกยอดชำระ กรุณารอสักครู่",
          language: "th",
        });
        window.__testPopup = tab;
        setTimeout(() => updateReceiptPrintLoading(tab, {
          title: "ชำระเงินสำเร็จ กำลังเตรียมใบเสร็จ",
          message: "กรุณารอ ระบบกำลังเปิดหน้าพิมพ์ใบเสร็จ",
        }), 850);
      }));
      const [popup] = await Promise.all([page.waitForEvent("popup"), page.locator("#approve").click()]);
      await expect(popup.locator("#receiptPrintLoadingTitle")).toHaveText("กำลังยืนยันการชำระเงิน");
      await expect(popup.locator("#receiptPrintLoadingMessage")).toContainText("ตรวจสอบ");
      await expect(popup.locator(".receipt-print-loading-brand")).toHaveCount(0);
      await expect(popup.locator(".receipt-print-loading-mark")).toHaveCount(0);
      const metrics = await popup.evaluate(() => {
        const body = document.querySelector(".receipt-print-loading");
        const spinner = document.querySelector(".receipt-print-loading-spinner");
        const rect = body.querySelector(".receipt-print-loading-panel").getBoundingClientRect();
        return {
          width: document.documentElement.scrollWidth,
          viewport: innerWidth,
          centerOffset: Math.abs((rect.left + rect.width / 2) - innerWidth / 2),
          animation: getComputedStyle(spinner).animationName,
          role: body.getAttribute("role"),
          visible: rect.width > 0 && rect.height > 0,
          noOpener: window.opener === null,
          fontFamily: getComputedStyle(document.documentElement).fontFamily,
        };
      });
      expect(metrics.visible).toBe(true);
      expect(metrics.role).toBe("status");
      expect(metrics.noOpener).toBe(true);
      expect(metrics.fontFamily).toContain("Kanit Local");
      expect(metrics.width).toBeLessThanOrEqual(metrics.viewport + 1);
      expect(metrics.centerOffset).toBeLessThanOrEqual(2);
      expect(metrics.animation).toContain("receipt-print-spin");
      await expect(popup.locator("#receiptPrintLoadingTitle")).toContainText("เตรียมใบเสร็จ", { timeout: 5000 });
      await popup.close();
    } finally {
      await context.close();
    }
  });
}
