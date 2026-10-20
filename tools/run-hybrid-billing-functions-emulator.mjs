#!/usr/bin/env node
// End-to-end Firebase Auth + Firestore + Functions callable UAT in demo only.
// Staging wrappers are created in a temporary directory, never deployed or
// exported from real functions/index.js. App Check is OFF in this isolated
// wrapper because an emulator cannot provide genuine production attestations.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync,
  existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "functions");
const PROJECT = "demo-penguin-hybrid-callable-uat";
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  || process.env.FUNCTIONS_EMULATOR || !PROJECT.startsWith("demo-")) {
  throw Error("HYBRID_CALLABLE_TEST_REQUIRES_ISOLATED_DEMO");
}
const javaCandidates = [process.env.JAVA_HOME,
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
  "/opt/homebrew/opt/openjdk@21"].filter(Boolean);
const javaHome = javaCandidates.find(home => {
  const bin = path.join(home, "bin/java");
  if (!existsSync(bin)) return false;
  const result = spawnSync(bin, ["-version"], { encoding: "utf8" });
  return result.status === 0
    && Number((result.stderr || "").match(/version ["'](\d+)(?:\.|["'])/)?.[1]) >= 21;
});
if (!javaHome) throw Error("HYBRID_CALLABLE_JDK21_REQUIRED");
const folder = mkdtempSync(path.join(os.tmpdir(), "penguin-hybrid-callable-uat-"));
try {
  const func = path.join(folder, "functions");
  mkdirSync(func);
  symlinkSync(path.join(SOURCE, "node_modules"), path.join(func, "node_modules"), "dir");
  const config = JSON.parse(readFileSync(path.join(SOURCE, "package.json"), "utf8"));
  writeFileSync(path.join(func, "package.json"), JSON.stringify({
    name: "penguin-hybrid-demo-callable-uat", private: true, main: "index.js",
    engines: { node: "22" },
    dependencies: config.dependencies,
  }, null, 2));
  const requireFile = file => JSON.stringify(path.join(SOURCE, file));
  writeFileSync(path.join(func, "index.js"), `
"use strict";
const { initializeApp } = require("firebase-admin/app");
initializeApp({ projectId: "${PROJECT}" });
const { onCall } = require("firebase-functions/v2/https");
const { makeHybridCodCallableHandler } = require(${requireFile("hybrid-billing-cod-callable.js")});
const { makeHybridFinanceHandler } = require(${requireFile("hybrid-billing-finance-api.js")});
// ONLY demo: real source exports remain absent and live gates remain FALSE.
// Auth credentials are still validated by the Functions Emulator.
exports.hybridCodDemo = onCall({ region: "asia-southeast1",
  enforceAppCheck: false }, makeHybridCodCallableHandler());
exports.hybridFinanceDemo = onCall({ region: "asia-southeast1",
  enforceAppCheck: false }, makeHybridFinanceHandler({ ready: true }));
`);
  writeFileSync(path.join(folder, "firestore.rules"),
    "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }\n");
  writeFileSync(path.join(folder, "firebase.json"), JSON.stringify({
    functions: { source: func, codebase: "hybrid-demo" },
    firestore: { rules: path.join(folder, "firestore.rules") },
    emulators: {
      auth: { host: "127.0.0.1", port: 9096 },
      firestore: { host: "127.0.0.1", port: 8192 },
      functions: { host: "127.0.0.1", port: 5007 },
      ui: { enabled: false },
    },
  }, null, 2));
  console.log("HYBRID CALLABLE E2E | demo only | REAL Auth+Functions+Firestore emulators");
  const result = spawnSync("firebase", [
    "emulators:exec", "--only", "auth,firestore,functions",
    "--project", PROJECT, "--config", path.join(folder, "firebase.json"),
    "--log-verbosity", "QUIET",
    "node --test tests/react-parity/hybrid-billing-functions-emulator.spec.mjs",
  ], {
    cwd: ROOT, stdio: "pipe", encoding: "utf8", maxBuffer: 24 * 1024 * 1024,
    env: { ...process.env, GCLOUD_PROJECT: PROJECT, JAVA_HOME: javaHome,
      PATH: path.join(javaHome, "bin") + path.delimiter + (process.env.PATH || "") },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(folder, { recursive: true, force: true });
}
