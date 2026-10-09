import { chromium } from "@playwright/test";

const base = process.env.DELIVERY_TEST_BASE_URL || "http://127.0.0.1:5099";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
let failed = false;
try {
  for (const width of [320, 360, 390, 440, 768, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 956 },
      isMobile: width <= 440,
      hasTouch: width <= 440,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base + "/s/saas-test-shop/delivery", {
      waitUntil: "domcontentloaded", timeout: 20000,
    });
    await page.locator("#promptPaySection").waitFor({ timeout: 15000 });
    // Exercise real app CSS with a detached-from-payment, read-only DOM fixture.
    const result = await page.evaluate(() => {
      const host = document.getElementById("promptPaySection");
      const fixture = document.createElement("div");
      fixture.id = "slipLayoutSmokeFixture";
      fixture.innerHTML = [
        '<div id="paymentSlipWrap" class="payment-slip-wrap">',
        ' <div class="payment-slip-dropzone has-file">',
        '  <div class="payment-slip-preview">',
        '   <div class="payment-slip-meta">',
        '    <span id="paymentSlipFileName"></span>',
        '    <span id="paymentSlipFileSize">0.47 MB</span>',
        '   </div>',
        '  </div>',
        ' </div>',
        '</div>',
        '<small class="menu-category delivery-payment-slip-review-note" id="paymentSlipReviewNote"></small>',
      ].join("");
      fixture.querySelector("#paymentSlipFileName").textContent =
        "IMG_88616_MOBILE_TEST_" + "A".repeat(110) + ".png";
      fixture.querySelector("#paymentSlipReviewNote").textContent =
        "ระบบใช้ Slip2Go ตรวจสลิปก่อนส่งเข้าครัว หากบริการไม่พร้อม แคชเชียร์จะตรวจสอบเอง";
      host.append(fixture);
      const box = element => element.getBoundingClientRect();
      const note = fixture.querySelector("#paymentSlipReviewNote");
      const name = fixture.querySelector("#paymentSlipFileName");
      const size = fixture.querySelector("#paymentSlipFileSize");
      const meta = fixture.querySelector(".payment-slip-meta");
      const wrap = fixture.querySelector("#paymentSlipWrap");
      return {
        noteHeight: Math.round(box(note).height),
        noteWidth: Math.round(box(note).width),
        noteRight: box(note).right,
        cardRight: box(host).right,
        filenameRight: box(name).right,
        fileSizeLeft: box(size).left,
        whiteSpace: getComputedStyle(note).whiteSpace,
        textAlign: getComputedStyle(note).textAlign,
        overflow: [
          host.scrollWidth - host.clientWidth,
          wrap.scrollWidth - wrap.clientWidth,
          meta.scrollWidth - meta.clientWidth,
          document.documentElement.scrollWidth - innerWidth,
        ],
      };
    });
    const ok = result.whiteSpace === "normal" &&
      result.textAlign === "left" &&
      result.noteHeight >= (width <= 440 ? 30 : 17) &&
      result.noteRight <= result.cardRight + 1 &&
      result.filenameRight <= result.fileSizeLeft + 1 &&
      result.overflow.every(value => value <= 2) &&
      errors.length === 0;
    console.log("SLIP_WRAP_" + width + "_" + (ok ? "PASS" : "FAIL"), JSON.stringify(result));
    if (!ok) failed = true;
    await context.close();
  }
} catch (error) {
  console.log("SLIP_WRAP_SMOKE_ERROR", String(error));
  failed = true;
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
else console.log("SLIP_WRAP_PC_MOBILE_ALL_PASS");
