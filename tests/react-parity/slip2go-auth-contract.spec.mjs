import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sources = [
  "functions/slip-verification.js",
  "functions/platform-settings.js",
  "functions/tenant-lalamove-wallet.js",
];

test("All Slip2Go REST calls send Bearer Secret Key per Slip2Go account Authentication examples", () => {
  for (const filename of sources) {
    const source = readFileSync(filename, "utf8");
    assert.match(source, /Authorization: `Bearer \${secret}`/, filename);
    assert.ok(!source.includes("Authorization: secret"), filename);
  }
});

test("Only provider-confirmed checks auto-approve, found-only response remains manual", () => {
  for (const filename of ["functions/slip-verification.js", "functions/tenant-lalamove-wallet.js"]) {
    const source = readFileSync(filename, "utf8");
    assert.match(source, /if \(code === "200200"\) return \{/);
    assert.match(source, /"200000": \["manual_review", "slip2go_found_unverified", false\]/);
    assert.match(source, /"400400": \["manual_review", "slip2go_condition_request_invalid", false\]/);
    assert.match(source, /checkDuplicate: true/);
    assert.match(source, /checkAmount: \{ type: "eq"/);
    assert.match(source, /checkReceiver:/);
  }
});
