// DEV-ONLY read-only sanitized financial review export.
// Auth/environment guards MUST run before ANY firebase-admin import.
// Use with the already running LOCAL Firestore Emulator.
import { createRequire } from "node:module";

const PROJECT = "demo-penguin-hybrid";
const REQUIRED_HOST = new Set(["127.0.0.1:8080", "localhost:8080"]);
const HELP = [
  "Usage: node tools/audit-hybrid-finance-demo.mjs [--format=text|json|packet] [--max=1..500]",
  "Local demo Firestore only. Set HYBRID_FINANCE_AUDIT_DEMO_ACK=1,",
  "FIRESTORE_EMULATOR_HOST=127.0.0.1:8080, GCLOUD_PROJECT=demo-penguin-hybrid.",
  "Outputs a redacted worklist; never confirms a real refund or settlement.",
].join("\n");

function parseOptions(argv) {
  let format = "text", maxPerSource = 100;
  const seen = new Set();
  for (const arg of argv) {
    if (arg === "--help" && argv.length === 1) return { help: true };
    const match = /^--(format|max)=(.+)$/.exec(arg);
    if (!match || seen.has(match[1])) throw new Error("HYBRID_FINANCE_AUDIT_INVALID_ARGUMENT");
    seen.add(match[1]);
    if (match[1] === "format") {
      if (!["json", "text", "packet"].includes(match[2])) {
        throw new Error("HYBRID_FINANCE_AUDIT_INVALID_FORMAT");
      }
      format = match[2];
    } else {
      if (!/^[1-9]\d{0,2}$/.test(match[2])
        || Number(match[2]) > 500) {
        throw new Error("HYBRID_FINANCE_AUDIT_INVALID_LIMIT");
      }
      maxPerSource = Number(match[2]);
    }
  }
  return { format, maxPerSource };
}
function assertDemoEnvironment(env) {
  if (env.HYBRID_FINANCE_AUDIT_DEMO_ACK !== "1"
    || !REQUIRED_HOST.has(env.FIRESTORE_EMULATOR_HOST)
    || env.GCLOUD_PROJECT !== PROJECT
    || (env.GCP_PROJECT && env.GCP_PROJECT !== PROJECT)
    || (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== PROJECT)
    || env.FIREBASE_DATABASE_EMULATOR_HOST && !env.FIREBASE_DATABASE_EMULATOR_HOST.startsWith("127.0.0.1:")
    || env.FIRESTORE_EMULATOR_HOST?.includes("://")) {
    throw new Error("HYBRID_FINANCE_AUDIT_REFUSES_NONDEMO_ENV");
  }
  let config = {};
  try { config = JSON.parse(env.FIREBASE_CONFIG || "{}"); }
  catch { throw new Error("HYBRID_FINANCE_AUDIT_INVALID_CONFIG"); }
  if (config.projectId && config.projectId !== PROJECT) {
    throw new Error("HYBRID_FINANCE_AUDIT_REFUSES_NONDEMO_CONFIG");
  }
}

const options = parseOptions(process.argv.slice(2));
if (options.help) {
  process.stdout.write(HELP + "\n");
} else {
  // fail BEFORE importing firebase-admin or initializing Firestore.
  assertDemoEnvironment(process.env);
  const fnRequire = createRequire(new URL("../functions/package.json", import.meta.url));
  const { initializeApp, deleteApp } = fnRequire("firebase-admin/app");
  const { getFirestore } = fnRequire("firebase-admin/firestore");
  const { auditDemoHybridRefundHistory } =
    fnRequire("./hybrid-billing-refund-history-audit.js");
  const { buildDemoHybridFinanceWorklist, formatHybridFinanceWorklistTH } =
    fnRequire("./hybrid-billing-finance-worklist.js");
  const { createDemoHybridFinanceReviewPacket } =
    fnRequire("./hybrid-billing-finance-review-packet.js");
  const app = initializeApp({ projectId: PROJECT },
    "local-hybrid-finance-audit-report");
  try {
    const db = getFirestore(app);
    const audit = await auditDemoHybridRefundHistory({
      db, maxPerSource: options.maxPerSource,
    });
    const worklist = buildDemoHybridFinanceWorklist(audit);
    process.stdout.write(options.format === "packet"
      ? JSON.stringify(createDemoHybridFinanceReviewPacket(worklist), null, 2) + "\n"
      : options.format === "json"
        ? JSON.stringify(worklist, null, 2) + "\n"
        : formatHybridFinanceWorklistTH(worklist));
    // Always a nonzero process exit status for unresolved finance blockers,
    // so CI/shell users can never confuse the output with "ready to settle."
    process.exitCode = 2;
  } finally {
    await deleteApp(app);
  }
}
