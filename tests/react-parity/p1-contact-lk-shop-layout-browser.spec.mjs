import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const css = readFileSync(new URL("../../react-app/src/ui/platform-contact-card-collapse.css", import.meta.url), "utf8");
const jsx = readFileSync(new URL("../../react-app/src/pages/PlatformContactPage.jsx", import.meta.url), "utf8");

test("LK Shop contact uses two source cards, collapsed preview, scoped Firebase pairing and PENGUIN copy", () => {
  for (const marker of [
    'className="platform-lk-shop-layout"',
    'className="card platform-lk-shop-settings-card platform-contact-toggle-host"',
    'className="card platform-lk-shop-preview-card"',
    'controls="platformContactLKShopPanel"',
    'id="platformContactLKShopPanel" className="platform-contact-collapsed-body"',
    'className="platform-contact-preview-body" hidden={!expandedCards.lkShop}',
    '<LKShopPairingPanel scope="platform" embedded notify={showToast} />',
    'ข้อความเป็นตัวอย่างเท่านั้น ไม่ใช่การแจ้งเตือนจริง',
  ]) assert.ok(jsx.includes(marker), "missing source layout / Firebase gate: " + marker);
  assert.doesNotMatch(jsx, /LUKKAJA/);
});

test("contact LK Shop grid never overflows and stacks at tablet/mobile widths", async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 880 } });
      try {
        await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}main{max-width:1160px;margin:auto;padding:12px}</style><style>' + css + '</style></head><body class="platform-contact-page"><main><div class="platform-lk-shop-layout"><section class="card platform-lk-shop-settings-card"><div class="section-title"><div class="platform-contact-heading-copy"><h2>การแจ้งเตือนผ่าน LK Shop</h2><p>เลือกห้องและจับคู่อุปกรณ์</p></div></div><div class="platform-contact-collapsed-body" hidden>Pairing</div></section><aside class="card platform-lk-shop-preview-card"><div class="section-title"><div class="platform-contact-heading-copy"><h2>ตัวอย่างการแจ้งเตือน LK Shop</h2><p>ตัวอย่างข้อความแจ้งเตือน</p></div></div><div class="platform-contact-preview-body" hidden>Demo</div></aside></div></main></body></html>');
        const v = await page.evaluate(() => {
          const a = document.querySelector(".platform-lk-shop-settings-card").getBoundingClientRect();
          const b = document.querySelector(".platform-lk-shop-preview-card").getBoundingClientRect();
          return { a: {x:a.x,y:a.y,w:a.width,h:a.height}, b:{x:b.x,y:b.y,w:b.width,h:b.height},
            overflow: document.documentElement.scrollWidth-window.innerWidth,
            collapsed: getComputedStyle(document.querySelector(".platform-contact-preview-body")).display==="none" };
        });
        assert.ok(v.overflow <= 2, "overflow at width " + width + ": " + v.overflow);
        assert.ok(v.collapsed, "preview must be initially collapsed");
        assert.ok(v.a.w >= 200 && v.b.w >= 200, "cards too narrow at width " + width);
        if (width > 1040) {
          assert.ok(v.b.x >= v.a.x + v.a.w - 1, "desktop must have two columns");
          assert.ok(Math.abs(v.a.y-v.b.y)<=2, "desktop columns must align");
        } else {
          assert.ok(v.b.y >= v.a.y + v.a.h - 1, "tablet/mobile must stack");
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
