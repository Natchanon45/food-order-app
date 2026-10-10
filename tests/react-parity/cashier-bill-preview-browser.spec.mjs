import { test, expect } from "@playwright/test";
import fs from "node:fs";

const cashierCss = fs.readFileSync("react-app/public/parity/css/cashier-refresh.css", "utf8");

for (const width of [320, 440, 1280]) {
  test("Cashier bill modal fits viewport and scrolls at " + width + "px", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 740 } });
    const page = await context.newPage();
    try {
      await page.setContent(
        '<style>:root { --app-ui-font: "Kanit Local", "Kanit", sans-serif; --ui-layer-modal-z: 2147483000; } * { box-sizing: border-box; } body { margin: 0; } ' + cashierCss + '</style>' +
        '<main><button id="viewBill">ดูบิล</button></main>' +
        '<div class="cashier-bill-preview-backdrop" data-ui-layer="modal">' +
        '<section class="cashier-bill-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="cashierBillPreviewTitle">' +
        '<header class="cashier-bill-preview-head"><div><h2 id="cashierBillPreviewTitle">รายละเอียดบิล</h2><p>เลขที่บิล 00001</p></div><button class="cashier-bill-preview-close">×</button></header>' +
        '<div class="cashier-bill-preview-body"><div class="cashier-bill-preview-customer"><strong>Delivery: ลูกค้า</strong><p>กรุงเทพมหานคร</p></div>' +
        '<div class="cashier-bill-preview-order-list">' + '<section class="cashier-bill-preview-round"><p>1 × เมนูสำหรับการทดสอบ</p></section>'.repeat(40) + '</div>' +
        '<div class="cashier-bill-preview-grand-total"><strong>ยอดสุทธิ</strong><strong>170.00 บาท</strong></div>' +
        '<div class="cashier-bill-preview-slip"><h3>สลิปการชำระเงิน</h3><img alt="สลิปการชำระเงิน" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'600\'%3E%3C/svg%3E"></div></div>' +
        '<footer class="cashier-bill-preview-footer"><button class="btn">ปิด</button><a class="btn btn-dark" href="#">พิมพ์</a></footer></section></div>'
      );
      const layout = await page.evaluate(() => {
        const dialog = document.querySelector(".cashier-bill-preview-dialog");
        const scroll = document.querySelector(".cashier-bill-preview-body");
        const footer = document.querySelector(".cashier-bill-preview-footer");
        const box = dialog.getBoundingClientRect();
        return {
          viewportWidth: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          modalLeft: box.left,
          modalRight: box.right,
          modalHeight: box.height,
          viewportHeight: innerHeight,
          canScroll: scroll.scrollHeight > scroll.clientHeight,
          dialogFont: getComputedStyle(dialog).fontFamily,
          footerBottom: footer.getBoundingClientRect().bottom,
        };
      });
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.modalLeft).toBeGreaterThanOrEqual(0);
      expect(layout.modalRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.modalHeight).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.canScroll).toBe(true);
      expect(layout.dialogFont).toContain("Kanit Local");
      await expect(page.getByRole("dialog", { name: "รายละเอียดบิล" })).toBeVisible();
    } finally { await context.close(); }
  });
}
