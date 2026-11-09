import { test, expect } from "@playwright/test";
import fs from "node:fs";

const styles = ["app.css","quick-order.css","quick-order-emerald-port.css","icons.css"]
  .map(name => fs.readFileSync("react-app/public/parity/css/" + name, "utf8")).join("\n");
for (const width of [320,390,440,1280]) {
  test("M2.162 two Quick Order actions match LUKKAJA stacked emerald layout at " + width, async ({browser}) => {
    const context = await browser.newContext({viewport:{width,height:800},isMobile:width<500,hasTouch:width<500});
    const page = await context.newPage();
    try {
      await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}'+styles+'</style></head>'+
        '<body class="quick-order-page"><main class="container" style="padding:12px;width:100%;max-width:850px;margin:auto">'+
        '<section class="card quick-cart-checkout" style="padding:12px"><h2>สรุปคำสั่งซื้อ</h2>'+
        '<div class="quick-deferred-actions">'+
        '<button class="btn btn-primary quick-submit" id="payFirst"><i class="bi bi-cash-coin app-icon" aria-hidden="true"></i><span>ชำระเงินก่อนส่งเข้าครัว</span></button>'+
        '<button class="btn quick-submit quick-send-kitchen" id="sendKitchen"><i class="bi bi-egg-fried app-icon" aria-hidden="true"></i><span>ส่งเข้าครัว (ยังไม่ชำระเงิน)</span></button>'+
        '</div></section></main></body></html>');
      const computed=await page.evaluate(()=>{
        const a=document.getElementById("payFirst"),b=document.getElementById("sendKitchen");
        const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();
        const base=getComputedStyle(b), group=getComputedStyle(a.parentElement);
        return {
          viewport:innerWidth,scroll:document.documentElement.scrollWidth,
          display:group.display,cols:group.gridTemplateColumns,
          gap:Math.round(parseFloat(group.rowGap)*100)/100,
          aHeight:A.height,bHeight:B.height,
          aLeft:A.left,bLeft:B.left,aRight:A.right,bRight:B.right,
          spacing:B.top-A.bottom,
          bColor:base.color,bBackground:base.backgroundColor,
          bBorder:base.borderTopColor,iconCount:[...document.querySelectorAll(".quick-deferred-actions .app-icon")].length,
          buttonCount:document.querySelectorAll(".quick-deferred-actions button").length
        };
      });
      expect(computed.display).toBe("grid");
      expect(computed.buttonCount).toBe(2);
      expect(computed.iconCount).toBe(2);
      expect(computed.scroll).toBeLessThanOrEqual(computed.viewport + 1);
      expect(computed.aHeight).toBeGreaterThanOrEqual(42);
      expect(computed.bHeight).toBeGreaterThanOrEqual(42);
      expect(computed.spacing).toBeGreaterThanOrEqual(8.5);
      expect(computed.aLeft).toBeGreaterThanOrEqual(0);
      expect(computed.bLeft).toBeGreaterThanOrEqual(0);
      expect(computed.aRight).toBeLessThanOrEqual(computed.viewport);
      expect(computed.bRight).toBeLessThanOrEqual(computed.viewport);
      expect(computed.bBackground).toBe("rgb(240, 250, 244)");
      expect(computed.bColor).toBe("rgb(14, 104, 64)");
      expect(computed.bBorder).toBe("rgb(33, 148, 92)");
    } finally { await context.close(); }
  });
}
