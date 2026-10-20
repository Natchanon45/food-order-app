#!/usr/bin/env node
// Isolated Firebase Emulator UAT ONLY: synthetic project, localhost, deny-all rules.
// NO production credentials/project ID and NO Firebase deploy command.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = "demo-penguin-hybrid-uat";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
`;
const HOME_CANDIDATES = [
  process.env.JAVA_HOME,
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
  "/opt/homebrew/opt/openjdk@21",
  "/opt/homebrew/opt/openjdk",
].filter(Boolean);
function compatibleJava(home) {
  const java = path.join(home, "bin", "java");
  if (!existsSync(java)) return false;
  const result = spawnSync(java, ["-version"], { encoding: "utf8", timeout: 5000 });
  const output = (result.stderr || "") + (result.stdout || "");
  const match = output.match(/version ["'](\d+)(?:\.|["'])/);
  return result.status === 0 && match && Number(match[1]) >= 21;
}
if (process.env.FIRESTORE_EMULATOR_HOST) {
  throw Error("HYBRID_EMULATOR_AMBIENT_HOST_FORBIDDEN: stop other emulator before UAT");
}
if (!PROJECT.startsWith("demo-")) throw Error("HYBRID_EMULATOR_PROJECT_NOT_DEMO");
const home = HOME_CANDIDATES.find(compatibleJava);
if (!home) {
  console.error("Firestore Emulator requires Java 21+. Install a JDK 21+ or use Android Studio JBR.");
  process.exit(1);
}
const tmp = mkdtempSync(path.join(os.tmpdir(), "penguin-hybrid-uat-"));
const config = path.join(tmp, "firebase-emulator.json");
const ruleFile = path.join(tmp, "firestore-deny.rules");
try {
  writeFileSync(ruleFile, RULES);
  writeFileSync(config, JSON.stringify({
    firestore: { rules: ruleFile },
    emulators: {
      firestore: { host: "127.0.0.1", port: 8187 },
      ui: { enabled: false },
    },
  }, null, 2) + "\n");
  console.log("HYBRID FIRESTORE EMULATOR UAT | demo project only | localhost:8187 | deny-all client rules");
  console.log("Java:", home);
  const output = spawnSync("firebase", [
    "emulators:exec", "--only", "firestore",
    "--project", PROJECT, "--config", config,
    "--log-verbosity", "QUIET",
    "node --test tests/react-parity/hybrid-billing-firestore-emulator.spec.mjs",
  ], {
    cwd: ROOT, stdio: "inherit",
    env: {
      ...process.env, JAVA_HOME: home, GCLOUD_PROJECT: PROJECT,
      PATH: path.join(home, "bin") + path.delimiter + (process.env.PATH || ""),
    },
  });
  if (output.error) throw output.error;
  process.exitCode = output.status === null ? 1 : output.status;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
