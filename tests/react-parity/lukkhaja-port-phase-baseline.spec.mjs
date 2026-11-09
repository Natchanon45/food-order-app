import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const matrix = JSON.parse(readFileSync("docs/LUKKAJA_TO_PENGUIN_PAGE_MATRIX.json", "utf8"));
const plan = readFileSync("docs/LUKKAJA_TO_PENGUIN_PORT_PHASES.md", "utf8");

test("Phase-0 pins only authorized LUKKAJA source and PENGUIN destination branches", () => {
  assert.equal(matrix.source.repository, "cosmatch/lukkhaja");
  assert.equal(matrix.source.branch, "feature/react-golang-vite-tailwind-axios");
  assert.equal(matrix.source.commit, "e84c899028eb16c67401dcc05c5faed84bf48f63");
  assert.equal(matrix.target.repository, "Natchanon45/food-order-app");
  assert.equal(matrix.target.branch, "feature/react-firebase-port");
  assert.equal(matrix.target.commit, "d87fc3752efff126dc9846d7cbe844aa982840a2");
  assert.match(plan, /Source \(strictly read-only\)/);
  assert.match(plan, /No merge to `main` without instruction/);
});

test("all 65 distinct source JSX pages are assigned exactly once", () => {
  assert.equal(matrix.pages.length, 65);
  assert.equal(new Set(matrix.pages.map(page => page.filename)).size, 65);
  assert.equal(new Set(matrix.pages.map(page => page.id)).size, 65);
  const expected = { P1: 7, P2: 10, P3: 8, P4: 8, P5: 29, P6: 3 };
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map(phase => [
    phase, matrix.pages.filter(page => page.phase === phase).length,
  ])), expected);
  for (const page of matrix.pages) {
    assert.ok(page.sourcePath.startsWith("resources/js/react-port/pages/"), page.filename);
    assert.ok(page.destinationPath.startsWith("react-app/src/pages/"), page.filename);
    assert.ok(page.sourcePath.endsWith(page.filename), page.filename);
    assert.ok(page.destinationPath.endsWith(page.filename), page.filename);
    assert.ok(["not_started", "hosting_0_4_305__signed_in_superadmin_uat_pending"].includes(page.release), page.filename);
    assert.ok(["pending", "inventory_started", "source_form_markup_compared__firebase_read_guard_adapted__visual_pending", "source_delta_2341_vs_1578_reviewed__port_pending"].includes(page.jsxReview), page.filename);
    assert.ok(["pending", "read_failure_guards_contract_pass__emulator_write_pending"].includes(page.firebaseContract), page.filename);
  }
});

test("a same-named JSX file does not falsely mark UI or Firebase parity", () => {
  const existing = matrix.pages.filter(page =>
    page.destinationPresence === "filename_exists__ui_not_verified");
  const sourceOnly = matrix.pages.filter(page =>
    page.destinationPresence === "source_only__must_assess_route_vs_helper");
  assert.equal(matrix.counts.sourcePageJsx, 65);
  assert.equal(matrix.counts.destinationPageJsx, 52);
  assert.equal(existing.length, 52);
  assert.equal(sourceOnly.length, 13);
  assert.equal(matrix.counts.existingFilenameMatches, 52);
  assert.equal(matrix.counts.sourceOnlyPageJsx, 13);
  assert.ok(sourceOnly.some(page => page.filename === "AdminStoreMasterPage.jsx"));
  assert.ok(sourceOnly.some(page => page.filename === "PosProductsMasterPage.jsx"));
});

test("source-only components stay tracked and finance rollout remains gated", () => {
  assert.equal(matrix.counts.sourceComponentJsx, 70);
  assert.equal(matrix.counts.destinationComponentJsx, 25);
  assert.equal(matrix.sourceOnlyComponents.length, 45);
  assert.equal(new Set(matrix.sourceOnlyComponents).size, 45);
  assert.ok(matrix.sourceOnlyComponents.includes("TenantControlPanel.jsx"));
  assert.ok(matrix.sourceOnlyComponents.includes("M7FinancePolicyPanel.jsx"));
  assert.match(plan, /NO financial activation/);
  assert.match(plan, /no retroactive billing/i);
  assert.match(plan, /Do not automatically create invoices/);
});

test("P1.1 audit is visible without falsely marking Platform parity delivered", () => {
  const platform = matrix.pages.find(page => page.phase === "P1" && page.filename === "PlatformPage.jsx");
  assert.equal(platform.jsxReview, "source_form_markup_compared__firebase_read_guard_adapted__visual_pending");
  assert.equal(platform.firebaseContract, "read_failure_guards_contract_pass__emulator_write_pending");
  assert.equal(platform.release, "hosting_0_4_305__signed_in_superadmin_uat_pending");
  assert.equal(platform.auditEvidence, "docs/LUKKAJA_P1_1_PLATFORM_AUDIT.md");
  assert.equal(platform.actionInventoryEvidence, "docs/LUKKAJA_P1_1_PLATFORM_ACTIONS.md");
  const actions = readFileSync(platform.actionInventoryEvidence, "utf8");
  assert.match(actions, /22 action families inventoried/);
  assert.match(actions, /18 scenario checks/);
  const audit = readFileSync(platform.auditEvidence, "utf8");
  assert.match(audit, /Source is read-only/);
  assert.match(audit, /signed-in Super Admin visual and write\/read-failure UAT remain pending/);
  assert.match(audit, /LaravelAuthProvider/);
  assert.match(audit, /platformSettingsService/);
});

test("P1.1 live Hosting evidence and P1.2 source audit do not claim completed UAT or finance", () => {
  const platform = matrix.pages.find(page => page.filename === "PlatformPage.jsx");
  const tenants = matrix.pages.find(page => page.filename === "AdminTenantsPage.jsx");
  assert.equal(platform.releaseCommit, "fb3d249f1a15cce1f24499dd2f5026f00f0abb97");
  assert.equal(platform.releaseAsset, "react/assets/index-CoVwNJEQ.js");
  assert.match(platform.browserVisual, /signed_in_visual_pending/);
  assert.match(platform.firebaseEmulator, /platform_settings_write_emulator_pending/);
  assert.equal(matrix.latestVerifiedHosting.version, "0.4.305");
  assert.equal(matrix.latestVerifiedHosting.backendDeploy, "none_this_release");
  assert.equal(matrix.latestVerifiedHosting.sha256, "62f45d8b784efd1e364862a7891abf5b29b85a555cca26ad3ef9b067f1b7d7c9");
  assert.equal(tenants.jsxReview, "source_delta_2341_vs_1578_reviewed__port_pending");
  assert.equal(tenants.release, "not_started");
  assert.equal(tenants.auditEvidence, "docs/LUKKAJA_P1_2_SUPERADMIN_TENANTS_AUDIT.md");
  const audit = readFileSync(tenants.auditEvidence, "utf8");
  assert.match(audit, /createActiveTenantWithOwner/);
  assert.match(audit, /one-step flow/);
  assert.match(audit, /no new JSX, Firebase Callables or Rules changes/);
  const verification = readFileSync("docs/LUKKAJA_LIVE_BASELINE_RECONCILIATION.md", "utf8");
  assert.match(verification, /Hosting-only release verified/);
  assert.match(verification, /17\/17 PASS/);
});
