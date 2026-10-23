#!/usr/bin/env node
/**
 * ARCHIVED: the owner confirmed this is a prelaunch system with no real
 * customer charges. Universal anniversary billing now applies to every store
 * without tenant-by-tenant Cutover approval. The old read-only planner below
 * is retained solely for historical audit, not a release requirement.
 */
import fs from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { generateCutoverPlan } from "./billing-anniversary-cutover-plan-core.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const arg = argv[i];
    const key = arg?.startsWith("--") ? arg.slice(2) : "";
    if (!["audit", "out", "as-of"].includes(key) || !argv[i + 1] || out[key]) {
      throw new Error("Usage: --audit INPUT.json --out OUTPUT.json [--as-of YYYY-MM-DD]");
    }
    out[key] = argv[i + 1];
  }
  if (!out.audit || !out.out || !out.audit.endsWith(".json") || !out.out.endsWith(".json")) {
    throw new Error("Provide --audit INPUT.json and --out OUTPUT.json");
  }
  const input = resolve(out.audit), output = resolve(out.out);
  if (input === output) throw new Error("Audit input and output must differ");
  if (output === repoRoot || output.startsWith(repoRoot + sep)) {
    throw new Error("Keep financial audit metadata outside the Git repository");
  }
  return { input, output, asOf: out["as-of"] || null };
}
function bangkokToday() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const parts = Object.fromEntries(p.map(x => [x.type, x.value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
}
async function main(argv = process.argv.slice(2)) {
  // Intentionally stop the obsolete workflow rather than showing misleading
  // BLOCKED_REVIEW statuses for stores now covered by the universal policy.
  if (process.env.PENGUIN_LEGACY_CUTOVER_DIAGNOSTIC !== "1") {
    throw new Error("Archived legacy cutover planner. All stores now use universal anniversary billing. See docs/UNIVERSAL_BILLING_PRELAUNCH_20261023.md");
  }
  const { input, output, asOf } = parseArgs(argv);
  const source = JSON.parse(await fs.readFile(input, "utf8"));
  const plan = generateCutoverPlan(source, asOf || bangkokToday());
  await fs.mkdir(dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(plan, null, 2) + "\n", {
    mode: 0o600, flag: "wx",
  });
  console.log("Billing cutover DRY RUN — no Firestore writes or deployments.");
  console.log("Audited shops:", plan.tenantCount, "blocked:", plan.blocked,
    "awaiting manual approval:", plan.pendingManualApproval,
    "input stale:", plan.auditExpired);
  for (const s of plan.stores) {
    console.log(s.shop, s.category, s.reviewStatus,
      "next anniversary candidate:", s.nextAnniversaryCandidate || "unknown");
    if (s.blockers.length) console.log("  reasons:", s.blockers.join(", "));
  }
  console.log("Private local plan saved:", output);
  console.log("No migration authorization has been granted; membership expirations and suspensions are unchanged.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error("Cutover dry-run failed:", err.message);
    process.exitCode = 1;
  });
}
export { parseArgs, bangkokToday };
