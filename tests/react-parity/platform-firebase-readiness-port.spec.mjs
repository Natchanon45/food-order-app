import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("react-app/src/pages/PlatformPage.jsx", "utf8");
const firebaseAdapters = readFileSync("react-app/src/data/platformSettingsService.js", "utf8");
const branding = readFileSync("react-app/src/data/platformBrandingService.js", "utf8");
const backend = readFileSync("functions/platform-settings.js", "utf8");

const cases = [
  { name: "branding", flag: "brandingReadReady", error: "brandingLoadError",
    load: "loadPlatformBranding", actions: ["saveBranding"] },
  { name: "google", flag: "googleReadReady", error: "googleLoadError",
    load: "loadPlatformGoogleApis", actions: ["saveGoogle"] },
  { name: "slip", flag: "slipReadReady", error: "slipLoadError",
    load: "loadPlatformSlipVerification", actions: ["saveSlip", "testSlip"] },
  { name: "lalamove", flag: "lalamoveReadReady", error: "lalamoveLoadError",
    load: "loadPlatformLalamove", actions: ["saveLalamove", "testLalamove", "registerLalamoveWebhook"] },
];

test("source-equivalent platform readiness tracks successful authenticated Firebase reads, not Go storageReady", () => {
  for (const spec of cases) {
    assert.match(page, new RegExp(`const \\[\\[${spec.flag}, set${spec.flag[0].toUpperCase() + spec.flag.slice(1)}\\]\\] = useState\\(false\\)`));
    assert.match(page, new RegExp(`set${spec.flag[0].toUpperCase() + spec.flag.slice(1)}\\(false\\);\\s+${spec.load}\\(`));
    assert.match(page, new RegExp(`set${spec.flag[0].toUpperCase() + spec.flag.slice(1)}\\(true\\)`));
    assert.match(page, new RegExp(`set${spec.error[0].toUpperCase() + spec.error.slice(1)}\\(true\\)`));
    assert.match(page, new RegExp(`\\|| !${spec.flag}`));
  }
  assert.doesNotMatch(page, /storageReady/);
  assert.match(page, /PLATFORM_GOOGLE_READ_INVALID/);
  assert.match(page, /PLATFORM_BRANDING_READ_INVALID/);
  assert.match(page, /PLATFORM_SLIP_READ_INVALID/);
  assert.match(page, /PLATFORM_LALAMOVE_READ_INVALID/);
});

test("platform save/test/event actions fail closed on stale reads and wrong roles", () => {
  for (const spec of cases) {
    for (const action of spec.actions) {
      const start = page.indexOf(`const ${action} = async `);
      assert.ok(start > 0, action);
      const stop = page.indexOf("\n  };", start);
      assert.ok(stop > start, action);
      const body = page.slice(start, stop);
      assert.ok(body.includes('authState.status !== "ready"'), action);
      assert.ok(body.includes('profile?.role !== "super_admin"'), action);
      assert.ok(body.includes(spec.error), action);
      assert.ok(body.includes(`!${spec.flag}`), action);
    }
  }
  assert.match(page, /registerLalamoveWebhook = async/);
  assert.match(page, /lalamoveWebhookBusy \|\| lalamoveLoadError \|\| !lalamoveReadReady/);
  assert.match(page, /if \(authState.status === "error"\) return <main role="alert"/);
});

test("all Firebase settings forms and secret controls are disabled until a successful read", () => {
  const forms = ["platformBrandingForm", "platformGoogleApiForm", "platformSlipVerificationForm", "platformLalamoveForm"];
  for (const form of forms) assert.ok(page.includes(`id="${form}"`), form);
  for (const spec of cases) {
    assert.match(page, new RegExp(`disabled=\\{[^}]*${spec.error} \\|\\| !${spec.flag}\\}`));
  }
  for (const id of [
    "savePlatformBrandingButton", "savePlatformGoogleApiButton",
    "savePlatformSlipVerificationButton", "testPlatformSlip2GoButton",
    "savePlatformLalamoveButton", "testPlatformLalamoveButton", "registerPlatformLalamoveWebhookButton"
  ]) assert.ok(page.includes(`id="${id}"`), id);
  // A feature hidden by prior owner request must remain hidden.
  assert.doesNotMatch(page, /to="\/platform\/hybrid-invoices"/);
  assert.match(page, /platform-tenant-notification-card/);
  assert.match(page, /<PlatformReceiverBankSelect/);
});

test("Firebase callable boundary and server-side super_admin authorization remain unchanged", () => {
  for (const name of [
    "getPlatformGoogleApis", "updatePlatformGoogleApis", "getPlatformSlipVerification",
    "updatePlatformSlipVerification", "getPlatformLalamove", "testPlatformLalamove"
  ]) assert.ok(firebaseAdapters.includes(name), name);
  assert.match(branding, /getPlatformBranding/);
  assert.match(branding, /updatePlatformBranding/);
  for (const name of ["getPlatformBranding", "getPlatformGoogleApis", "getPlatformSlipVerification", "getPlatformLalamove"]) {
    assert.match(backend, new RegExp(`exports\\.${name} = onCall\\(\\{ region: REGION \\}, async request => \\{\\s+await assertSuperAdmin\\(request\\.auth\\)`));
  }
});
