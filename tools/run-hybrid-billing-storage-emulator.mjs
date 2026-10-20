#!/usr/bin/env node
// Strict localhost-only Storage + Auth + Firestore security smoke tests.
// Never touch a real Firebase project, deploy, or alter repo data.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "demo-penguin-hybrid-storage-uat";
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  || process.env.FIREBASE_STORAGE_EMULATOR_HOST || !PROJECT.startsWith("demo-")) {
  throw Error("HYBRID_STORAGE_DEMO_PROJECT_REQUIRED");
}
const homes = [process.env.JAVA_HOME,
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
  "/opt/homebrew/opt/openjdk@21"].filter(Boolean);
const javaHome = homes.find(home => {
  const bin = path.join(home, "bin/java");
  if (!existsSync(bin)) return false;
  const v = spawnSync(bin, ["-version"], { encoding: "utf8" });
  const major = Number((v.stderr || "").match(/version ["'](\d+)(?:\.|["'])/)?.[1]);
  return v.status === 0 && major >= 21;
});
if (!javaHome) throw Error("HYBRID_STORAGE_JDK21_REQUIRED");
const folder = mkdtempSync(path.join(os.tmpdir(), "penguin-hybrid-storage-uat-"));
try {
  writeFileSync(path.join(folder, "deny-all.rules"),
    "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }\n");
  const config = path.join(folder, "firebase.json");
  writeFileSync(config, JSON.stringify({
    firestore: { rules: path.join(folder, "deny-all.rules") },
    storage: { rules: path.join(ROOT, "storage.rules") },
    emulators: {
      auth: { host: "127.0.0.1", port: 9097 },
      firestore: { host: "127.0.0.1", port: 8190 },
      storage: { host: "127.0.0.1", port: 9198 },
      ui: { enabled: false },
    },
  }, null, 2));
  console.log("HYBRID STORAGE UAT | source rules, demo project, loopback only");
  const result = spawnSync("firebase", [
    "emulators:exec", "--only", "auth,firestore,storage", "--project",
    PROJECT, "--config", config, "--log-verbosity", "QUIET",
    "node --test tests/react-parity/hybrid-billing-storage-emulator.spec.mjs",
  ], {
    cwd: ROOT, stdio: "pipe", encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GCLOUD_PROJECT: PROJECT, JAVA_HOME: javaHome,
      PATH: path.join(javaHome, "bin") + path.delimiter + (process.env.PATH || "") },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  const log = String(result.stdout || "") + String(result.stderr || "");
  if (/maximum of 1000 expressions|evaluation error/i.test(log)) {
    console.error("HYBRID_STORAGE_EVALUATOR_BLOCKED");
    process.exitCode = 2;
  } else {
    process.exitCode = result.status ?? 1;
  }
} finally {
  rmSync(folder, { recursive: true, force: true });
}
