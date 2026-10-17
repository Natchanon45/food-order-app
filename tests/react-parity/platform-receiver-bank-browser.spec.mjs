import { test, expect } from "@playwright/test";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

const lang = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json","utf8")).th;
const bankOptions = lang.platform.slip_verification.receiver_account_types;
let viteServer;
let url;

test.beforeAll(async () => {
  viteServer = await createServer({
    configFile: false, root: process.cwd(), plugins: [react()],
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0 },
  });
  await viteServer.listen();
  const address = viteServer.httpServer.address();
  url = "http://127.0.0.1:" + address.port + "/tests/react-parity/fixtures/receiver-bank.html";
});
test.afterAll(async () => { await viteServer?.close(); });

test.use({ launchOptions: { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" } });

test("Search, keyboard selection, Escape and lazily loaded receiver bank options preserve original bank codes", async ({page}) => {
  await page.addInitScript(options => { window.__bankOptions = options; }, bankOptions);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const combo = page.getByRole("combobox");
  await expect(combo).toHaveValue(bankOptions["01014"]);
  await combo.click();
  await expect(combo).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("option")).toHaveCount(12);
  await combo.fill("01014");
  await expect(page.getByRole("option")).toHaveCount(1);
  await combo.press("Enter");
  await expect(combo).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => window.__bankCode)).toBe("01014");
  await combo.click();
  await combo.fill("01002");
  await combo.press("Enter");
  expect(await page.evaluate(() => window.__bankCode)).toBe("01002");
  await expect(combo).toHaveValue(bankOptions["01002"]);
  await combo.click();
  await combo.fill("not-a-real-bank");
  await expect(page.getByText("ไม่พบธนาคาร")).toBeVisible();
  await combo.press("Escape");
  await expect(combo).toHaveValue(bankOptions["01002"]);
  await combo.click();
  await expect(page.getByRole("option")).toHaveCount(12);
  await page.getByRole("button", { name: /โหลดรายการเพิ่มเติม/ }).click();
  await expect(page.getByRole("option")).toHaveCount(24);
  const list = page.getByRole("listbox");
  await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.getByRole("option")).toHaveCount(35);
});

test("Mobile receiver picker stays in the viewport and supports bank-name search", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(options => { window.__bankOptions = options; }, bankOptions);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const combo=page.getByRole("combobox");
  await combo.click();
  const popup=page.locator(".platform-bank-combobox-popup");
  await expect(popup).toBeVisible();
  const size=await popup.boundingBox();
  expect(size.x).toBeGreaterThanOrEqual(0);
  expect(size.x + size.width).toBeLessThanOrEqual(390);
  await combo.fill("SCB");
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.getByRole("option", { name: /01014/ }).click();
  expect(await page.evaluate(()=>window.__bankCode)).toBe("01014");
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
