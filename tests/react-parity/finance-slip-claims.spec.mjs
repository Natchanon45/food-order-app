import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  claimIds, claimRefs, checkClaimsInTransaction, createClaimsInTransaction,
} = require("../../functions/finance-slip-claims.js");
const fileHash = value => createHash("sha256").update(value).digest("hex");

function memory() {
  const docs = new Map();
  const db = {
    collection: name => ({
      doc: id => ({ key: name + "/" + id, id }),
    }),
    runTransaction: async fn => {
      const writes = [];
      const tx = {
        get: async ref => ({ exists: docs.has(ref.key), data: () => docs.get(ref.key) }),
        create: (ref, value) => writes.push({ ref, value }),
      };
      const answer = await fn(tx);
      for (const w of writes) if (docs.has(w.ref.key)) throw Error("ALREADY_EXISTS");
      for (const w of writes) docs.set(w.ref.key, w.value);
      return answer;
    },
  };
  return { docs, db };
}

test("file and bank references produce stable cross-channel global document IDs", () => {
  const sha256 = fileHash("same-slip-bytes");
  const one = claimIds({ sha256, referenceId: "bank-123" });
  const two = claimIds({ sha256, transRef: "bank-123" });
  assert.deepEqual(one, two, "ref and transRef use one shared bank namespace");
  assert.equal(one.length, 2);
  assert.ok(one.some(id => id === "file_" + sha256));
  assert.ok(one.some(id => /^bank_[a-f0-9]{64}$/.test(id)));
  assert.equal(JSON.stringify(one).includes("bank-123"), false);
  assert.deepEqual(claimIds({ sha256, referenceId: "same", transRef: "same" }).length, 2);
});

test("sequential Wallet and Revenue Share claims cannot reuse an already-claimed slip", async () => {
  const { db, docs } = memory();
  const evidence = { sha256: fileHash("same-proof"), referenceId: "bank-xyz" };
  const reserve = async (channel, tenantId) => db.runTransaction(async tx => {
    const claims = claimRefs(db, evidence);
    await checkClaimsInTransaction(tx, claims);
    createClaimsInTransaction(tx, claims, { channel, tenantId, recordId: channel }, "serverTime");
  });
  await reserve("wallet_topup", "tenant-1");
  await assert.rejects(reserve("revenue_share", "tenant-2"),
    /FINANCE_SLIP_ALREADY_CLAIMED/);
  await assert.rejects(reserve("hybrid", "tenant-3"),
    /FINANCE_SLIP_ALREADY_CLAIMED/);
  assert.equal(docs.size, 2);
});

test("parallel stale transactions cannot both commit the same finance claim documents", async () => {
  const { db, docs } = memory();
  const claims = claimRefs(db, { sha256: fileHash("collision") });
  let readDone = 0, notify;
  const barrier = new Promise(resolve => { notify = resolve; });
  const contender = async channel => db.runTransaction(async tx => {
    const snaps = claims.map(ref => tx.get(ref));
    await Promise.all(snaps);
    if (++readDone === 2) notify();
    await barrier;
    createClaimsInTransaction(tx, claims, {
      channel, tenantId: "tenant-1", recordId: channel,
    }, "serverTime");
  });
  const results = await Promise.allSettled([
    contender("revenue_share"), contender("wallet_topup"),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected").length, 1);
  assert.equal(docs.size, 1);
});

test("invalid claim metadata, amountless proof and forged SHA values fail closed", () => {
  assert.throws(() => claimIds({ sha256: "" }), /SHA256_REQUIRED/);
  assert.throws(() => claimIds({ sha256: "abc" }), /SHA256_REQUIRED/);
  assert.throws(() => claimIds({ sha256: fileHash("x"), referenceId: "x\n" }), /INVALID_REFERENCE/);
  assert.throws(() => createClaimsInTransaction({ create: () => {} }, [], {
    channel: "client_defined", tenantId: "tenant-1", recordId: "x",
  }, "now"), /INVALID_CLAIM_METADATA/);
});

test("all three production payment channels create shared claims in the transaction", () => {
  const wallet = fs.readFileSync("functions/tenant-lalamove-wallet.js", "utf8");
  const share = fs.readFileSync("functions/revenue-share.js", "utf8");
  const hybrid = fs.readFileSync("functions/hybrid-billing-payment.js", "utf8");
  const rules = fs.readFileSync("firestore.rules", "utf8");
  for (const source of [wallet, share, hybrid]) {
    assert.match(source, /finance-slip-claims/);
    assert.match(source, /createClaimsInTransaction\(/);
    assert.match(source, /runTransaction\(async/);
  }
  assert.match(rules, /match \/financeSlipClaims\/\{claimId\}/);
  const mark = rules.indexOf("match /financeSlipClaims/{claimId}");
  assert.match(rules.slice(mark, mark + 100), /allow read, write: if false/);
});

test("the shared registry is server-only, has no standalone callable or client update/delete", () => {
  const bootstrap = fs.readFileSync("functions/bootstrap.js", "utf8");
  const module = fs.readFileSync("functions/finance-slip-claims.js", "utf8");
  assert.doesNotMatch(bootstrap, /finance-slip-claims/);
  assert.doesNotMatch(module, /onCall\(|onSchedule\(|onRequest\(|\.delete\(/);
});
