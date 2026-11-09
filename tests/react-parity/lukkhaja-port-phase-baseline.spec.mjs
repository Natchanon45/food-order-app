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
    assert.equal(page.release, "not_started", page.filename);
    assert.ok(["pending", "inventory_started", "source_form_markup_compared__firebase_read_guard_adapted__visual_pending"].includes(page.jsxReview), page.filename);
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
  assert.equal(platform.release, "not_started");
  assert.equal(platform.auditEvidence, "docs/LUKKAJA_P1_1_PLATFORM_AUDIT.md");
  assert.equal(platform.actionInventoryEvidence, "docs/LUKKAJA_P1_1_PLATFORM_ACTIONS.md");
  const actions = readFileSync(platform.actionInventoryEvidence, "utf8");
  assert.match(actions, /22 action families inventoried/);
  assert.match(actions, /18 scenario checks/);
  const audit = readFileSync(platform.auditEvidence, "utf8");
  assert.match(audit, /Source is read-only/);
  assert.match(audit, /not fully visually or runtime verified/);
  assert.match(audit, /LaravelAuthProvider/);
  assert.match(audit, /platformSettingsService/);
});
