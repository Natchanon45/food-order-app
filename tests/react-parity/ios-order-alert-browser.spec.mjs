import { test, expect } from "@playwright/test";
import fs from "node:fs";

const source = fs.readFileSync("react-app/src/components/orderAlertRecordedAudio.js", "utf8").replace(/^export /gm, "")
  + "\n" + fs.readFileSync("react-app/src/components/orderAlertAudio.js", "utf8")
    .replace(/^import .*orderAlertRecordedAudio\.js";?\n/m, "").replace(/^export /gm, "")
  + "\nwindow.__controller = createOrderAlertAudioController(); window.__tester = {orderAlertAudioTokens};";
const root = "public/assets/audio/order-alert-th/";

test("iPad speech fallback uses real locally hosted audio buffers after an explicit tap", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  try {
    await page.route("https://order-test.local/**", route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html", body: '<button id="bell">เปิดเสียงแจ้งเตือน</button><div id="status"></div>' });
      if (url.pathname.startsWith("/assets/audio/order-alert-th/")) {
        const basename = url.pathname.split("/").pop();
        if (!/^[a-z_]+\.wav$/.test(basename)) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ status: 200, contentType: "audio/wav", body: fs.readFileSync(root + basename) });
      }
      return route.fulfill({ status: 404, body: "" });
    });
    await page.goto("https://order-test.local/");
    await page.addScriptTag({ content: source });
    await page.evaluate(() => {
      document.querySelector("#bell").addEventListener("click", async () => {
        window.__armResult = await window.__controller.arm();
      });
    });
    await page.locator("#bell").click();
    await expect.poll(() => page.evaluate(() => window.__controller.voiceState().chimeReady)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__controller.voiceState().speechReady), { timeout: 20000 }).toBe(true);
    const result = await page.evaluate(() => window.__controller.announce({ id: "safe-test", orderType: "delivery", totalAmount: 170 }));
    expect(result.chimePlayed).toBe(true);
    expect(result.spoken).toBe(true);
    expect(result.mode).toBe("recorded");
    expect(await page.evaluate(() => window.__controller.voiceState().mode)).toBe("recorded");
    await page.evaluate(() => window.__controller.cancel());
  } finally { await context.close(); }
});
