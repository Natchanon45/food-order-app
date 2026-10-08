import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pageDir = "react-app/src/pages";
const overlayPath = "react-app/src/components/PageReadyOverlay.jsx";
const cssPath = "react-app/public/parity/css/page-ready-state.css";

test("PageReadyOverlay never renders fake indeterminate progress", () => {
  const overlay = fs.readFileSync(overlayPath, "utf8");
  const css = fs.readFileSync(cssPath, "utf8");
  assert.ok(!overlay.includes("page-ready-progress-indeterminate"));
  assert.ok(!css.includes("page-ready-progress-indeterminate"));
  assert.ok(!css.includes("page-ready-progress-move"));
});

test("hard-coded fake progress props are forbidden on route overlays", () => {
  const offenders = [];
  for (const file of fs.readdirSync(pageDir).filter(name => name.endsWith(".jsx"))) {
    const source = fs.readFileSync(path.join(pageDir, file), "utf8");
    if (/\bprogress=\{\d+(?:\.\d+)?\}/.test(source)) offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});

test("real progress is optional and must expose a real percent when supplied", () => {
  const overlay = fs.readFileSync(overlayPath, "utf8");
  assert.ok(overlay.includes("progressPercent = null"));
  assert.ok(overlay.includes('role="progressbar"'));
  assert.ok(overlay.includes('aria-valuenow={roundedProgress}'));
  assert.ok(overlay.includes('{roundedProgress}%'));
});

test("pages with known first-load fetches keep the full-screen overlay until initialReady", () => {
  const pages = [
    "AdminPage.jsx",
    "AdminQrPage.jsx",
    "PlatformOwnersPage.jsx",
    "PlatformPricingPage.jsx",
    "PosCatalogPage.jsx",
    "RevenueShareReportPage.jsx",
    "PlatformContactPage.jsx",
    "PlatformPage.jsx",
    "SaasSetupPage.jsx",
  ];
  for (const file of pages) {
    const source = fs.readFileSync(path.join(pageDir, file), "utf8");
    assert.ok(source.includes("initialReady"), `${file} must track initialReady`);
    const overlayIndex = source.indexOf("<PageReadyOverlay");
    assert.ok(overlayIndex >= 0, `${file} must use PageReadyOverlay`);
    const before = source.slice(Math.max(0, overlayIndex - 900), overlayIndex);
    assert.ok(/!initialReady/.test(before), `${file} overlay must wait for initialReady`);
  }
});
