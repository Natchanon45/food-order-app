import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { evaluateSlipVerification } = require("../../functions/hybrid-billing-payment-policy.js");
const source = fs.readFileSync("functions/slip-verification.js", "utf8");
const verifiedBody = () => ({
  code: "200200",
  data: { amount: "590.00", referenceId: "trusted-bank-reference",
    transRef: "trusted-bank-transaction" },
});
const validSettings = () => ({
  provider: "slip2go", slip2GoApiUrl: "https://test-slip2go.invalid",
  slip2GoSecret: "secret-from-private-settings",
  receiverAccountNumber: "1234567890",
  receiverNameTh: "บริษัท ตัวอย่าง จำกัด",
  receiverAccountType: "bank",
});

function harness({ settings = validSettings(), response = {
  ok: true, json: async () => verifiedBody(),
} } = {}) {
  let calls = 0, payload = null;
  const context = {
    require: name => {
      assert.equal(name, "firebase-admin/firestore");
      return { getFirestore: () => ({
        collection: name => {
          assert.equal(name, "platformPrivateSettings");
          return { doc: id => {
            assert.equal(id, "slipVerification");
            return { get: async () => ({ data: () => settings }) };
          } };
        },
      }) };
    },
    module: { exports: {} }, exports: {},
    Blob, FormData, AbortSignal, Buffer,
    console: { warn: () => {} },
    fetch: async (url, opts) => {
      calls++;
      assert.equal(url, "https://test-slip2go.invalid/api/verify-slip/qr-image/info");
      assert.match(opts.headers.Authorization, /^Bearer /);
      payload = JSON.parse(opts.body.get("payload"));
      return response;
    },
  };
  runInNewContext(source, context, { filename: "slip-verification.js" });
  return {
    inspect: (opts = {}) => context.module.exports.inspectSlip(
      Buffer.from("synthetic evidence"), "image/png", "demo.png", 590,
      { providerOverride: "slip2go", requireVerifiedReceiver: true, ...opts },
    ),
    metrics: () => ({ calls, payload }),
  };
}

test("Hybrid fails closed when beneficiary account number/name is absent or malformed", async () => {
  for (const override of [
    { receiverAccountNumber: "" },
    { receiverAccountNumber: "not-an-account" },
    { receiverAccountNumber: "123" },
    { receiverNameTh: "", receiverNameEn: "" },
    { receiverAccountNumber: "1".repeat(21) },
  ]) {
    const h = harness({ settings: { ...validSettings(), ...override } });
    const result = await h.inspect();
    assert.equal(result.status, "config_required");
    assert.equal(result.reason, "slip2go_config_required");
    assert.equal(h.metrics().calls, 0, "Do not contact provider before receiver is complete");
    assert.throws(() => evaluateSlipVerification(result, 590,
      { requireVerifiedReceiver: true }), /VERIFICATION_REJECTED_config_required/);
  }
});

test("successful Slip2Go HTTP response validates exact receiver, amount, date and duplicate", async () => {
  const h = harness();
  const verified = await h.inspect();
  assert.equal(verified.receiverValidated, true);
  assert.equal(verified.status, "matched");
  assert.equal(h.metrics().calls, 1);
  const data = h.metrics().payload;
  assert.equal(data.checkDuplicate, true);
  assert.equal(data.checkAmount.type, "eq");
  assert.equal(data.checkAmount.amount, "590.00");
  assert.equal(data.checkReceiver[0].accountNumber, "1234567890");
  assert.ok(data.checkReceiver[0].accountNameTH);
  assert.equal(data.checkDate.type, "gte");
  const verdict = evaluateSlipVerification(verified, 590, {
    requireVerifiedReceiver: true,
  });
  assert.equal(verdict.bankVerified, true);
  assert.equal("receiverAccountNumber" in verdict, false);
  assert.equal("receiverValidated" in verdict, false);
});

test("a body claiming code 200200 on HTTP error can never verify a transfer", async () => {
  for (const ok of [false, null]) {
    const h = harness({ response: {
      ok, status: 401, json: async () => verifiedBody(),
    } });
    const result = await h.inspect();
    assert.notEqual(result.status, "matched");
    assert.notEqual(result.receiverValidated, true);
    assert.equal(evaluateSlipVerification(result, 590,
      { requireVerifiedReceiver: true }).bankVerified, false);
  }
});

test("provider code 200000, recipient mismatch and duplicate cannot be accepted", async () => {
  for (const [code, expected] of [
    ["200000", "manual_review"],
    ["200401", "receiver_mismatch"],
    ["200501", "duplicate"],
  ]) {
    const h = harness({ response: { ok: true, json: async () => ({
      ...verifiedBody(), code,
    }) } });
    const result = await h.inspect();
    assert.equal(result.status, expected);
    if (code === "200000") {
      assert.equal(evaluateSlipVerification(result, 590,
        { requireVerifiedReceiver: true }).bankVerified, false);
    } else {
      assert.throws(() => evaluateSlipVerification(result, 590,
        { requireVerifiedReceiver: true }), /VERIFICATION_REJECTED_/);
    }
  }
});

test("Hybrid strict verification rejects absent receiver provenance even with matching amount", () => {
  const spoof = { provider: "slip2go", code: "200200", status: "matched",
    amountMatched: true, detectedAmount: 590, referenceId: "reference",
  };
  assert.throws(() => evaluateSlipVerification(spoof, 590,
    { requireVerifiedReceiver: true }), /HYBRID_PAYMENT_RECEIVER_UNVERIFIED/);
  assert.equal(evaluateSlipVerification(spoof, 590).bankVerified, true,
    "Unrelated historical caller contract is not silently modified");
});

test("only trusted Hybrid backend requests strict receiver verification", () => {
  const payment = fs.readFileSync("functions/hybrid-billing-payment.js", "utf8");
  const demo = fs.readFileSync("functions/emulator-hybrid/index.cjs", "utf8");
  const production = fs.readFileSync("functions/bootstrap.js", "utf8") +
    fs.readFileSync("functions/index.js", "utf8");
  assert.match(payment, /providerOverride: "slip2go", requireVerifiedReceiver: true/);
  assert.match(payment, /evaluateSlipVerification\(verification, invoice.amount, \{/);
  assert.match(demo, /receiverValidated: true/);
  assert.doesNotMatch(production, /demoHybridSubmitProof|demoHybridPrepareUpload/);
});
