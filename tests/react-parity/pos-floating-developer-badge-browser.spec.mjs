import { test, expect } from "@playwright/test";
import fs from "node:fs";
const css=fs.readFileSync("react-app/public/parity/css/app-version-badge-runtime.css","utf8");
test.use({launchOptions:{executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}});
for(const width of [320,430,1280]){
  test("Floating POS developer badge visible, positioned and opens panel at "+width+"px",async({page})=>{
    await page.setViewportSize({width,height:932});
    await page.setContent("<!doctype html><html lang=\"th\"><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body style=\"margin:0;min-height:1200px;background:#f8fbf9\"><main style=\"height:900px;padding:16px\">Retail POS</main><button type=\"button\" class=\"app-version-badge\" data-app-version-badge aria-label=\"เปิด Developer Panel\" title=\"PENGUIN v0.4.294\"></button><div class=\"app-dev-panel\" data-app-dev-panel hidden><div class=\"app-dev-backdrop\" data-close-dev-panel></div><section class=\"app-dev-card\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Developer Panel\"><header class=\"app-dev-head\"><div><small>Developer Panel</small><h2>PENGUIN</h2></div><button type=\"button\" class=\"app-dev-close\" aria-label=\"ปิด\">×</button></header><div class=\"app-dev-grid\"><div class=\"app-dev-row\"><span>Build</span><strong>2026.10.18.524</strong></div></div></section></div><script>const badge=document.querySelector(\"[data-app-version-badge]\");const panel=document.querySelector(\"[data-app-dev-panel]\");badge.addEventListener(\"click\",()=>panel.hidden=false);panel.querySelector(\"[data-close-dev-panel]\").addEventListener(\"click\",()=>panel.hidden=true);</script></body></html>");
    await page.addStyleTag({content:css});
    const badge=page.locator("[data-app-version-badge]");
    await expect(badge).toBeVisible();
    const data=await badge.evaluate(el=>{
      const r=el.getBoundingClientRect();
      const style=getComputedStyle(el);
      const dot=getComputedStyle(el,"::before");
      return {right:innerWidth-r.right,bottom:innerHeight-r.bottom,
        width:r.width,height:r.height,position:style.position,z:style.zIndex,
        dot:dot.display,dotWidth:parseFloat(dot.width),
        overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(data.position).toBe("fixed");
    expect(data.z).toBe("9999");
    expect(data.right).toBeCloseTo(14,0);
    expect(data.bottom).toBeCloseTo(width<=640?92:14,0);
    expect(data.width).toBe(width<=640?22:26);
    expect(data.height).toBe(width<=640?22:26);
    expect(data.dot).not.toBe("none");
    expect(data.dotWidth).toBeGreaterThan(5);
    expect(data.overflow).toBe(false);
    await badge.click();
    await expect(page.getByRole("dialog",{name:"Developer Panel"})).toBeVisible();
    await page.locator("[data-close-dev-panel]").click({position:{x:3,y:3}});
    await expect(page.getByRole("dialog",{name:"Developer Panel"})).toBeHidden();
  });
}
