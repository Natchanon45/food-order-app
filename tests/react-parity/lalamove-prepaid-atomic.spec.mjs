import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);
const source = fs.readFileSync("functions/lalamove-dispatch.js", "utf8");
const DELETED = Symbol("FieldValue.delete");

function harness({ balance = 100, mode = "fod_central", placeStatus = 201, finalFee = 59, failNetwork = false } = {}) {
  const path = "tenants/tenant-one/orders/order-one";
  const walletPath = "tenants/tenant-one/settings/lalamoveWallet";
  const expiry = new Date(Date.now() + 600000).toISOString();
  const docs = new Map(Object.entries({
    "users/cashier": { role: "cashier", tenantId: "tenant-one", active: true },
    "tenants/tenant-one/settings/store": {
      storeLatitude: 13.7, storeLongitude: 100.5, shopName: "Test Shop", shopPhone: "0812345678",
    },
    "tenants/tenant-one/settings/lalamove": {
      accountMode: mode === "fod_central" ? "fod_central" : "partner",
      fodCentralApproved: true,
    },
    "tenants/tenant-one/privateSettings/lalamove": {
      environment: "sandbox", apiKey: "pk_test_test", apiSecret: "sk_test_test",
      connectionVerifiedAt: "verified",
    },
    "platformPrivateSettings/lalamove": {
      environment: "sandbox", apiKey: "pk_test_test", apiSecret: "sk_test_test",
      connectionVerifiedAt: "verified",
    },
    [walletPath]: { balance, currency: "THB" },
    [path]: {
      id: "order-one", status: "ready", paymentStatus: "paid",
      paymentMethod: "promptpay", orderType: "delivery", deliveryProvider: "lalamove",
      deliveryBaseFee: 59, deliveryLatitude: 13.8, deliveryLongitude: 100.6,
      deliveryAddress: "Test Customer", recipientName: "Customer", recipientPhone: "0891234567",
      lalamoveDispatchQuote: { quotationId: "quote-1", expiresAt: expiry },
    },
  }));
  const update = (key, patch, merge = true) => {
    const result = merge ? { ...(docs.get(key) || {}) } : {};
    for (const [field, value] of Object.entries(patch)) {
      if (value === DELETED) delete result[field];
      else result[field] = value;
    }
    docs.set(key, result);
  };
  const ref = key => ({
    key,
    id: key.split("/").at(-1),
    get: async () => ({
      exists: docs.has(key), id: key.split("/").at(-1),
      data: () => docs.get(key), ref: ref(key),
    }),
    set: async (data, options = {}) => update(key, data, options.merge === true),
    collection: name => ({ doc: id => ref(key + "/" + name + "/" + id) }),
  });
  let serial = Promise.resolve();
  const db = {
    collection: name => ({ doc: id => ref(name + "/" + id) }),
    runTransaction(fn) {
      const work = serial.then(async () => {
        const writes = [];
        const tx = {
          get: r => r.get(),
          set: (r, data, options) => writes.push({ r, data, options }),
        };
        const result = await fn(tx);
        for (const { r, data, options } of writes) update(r.key, data, options?.merge === true);
        return result;
      });
      serial = work.catch(() => {});
      return work;
    },
  };
  const posts = [];
  const postedBalances = [];
  let nextPlaceStatus = placeStatus;
  let nextFinalFee = finalFee;
  let networkFailure = failNetwork;
  const fakeFetch = async (url, options) => {
    if (url.endsWith("/v3/quotations/quote-1")) {
      return { ok: true, status: 200, json: async () => ({
        data: {
          quotationId: "quote-1", expiresAt: expiry,
          priceBreakdown: { total: 59, currency: "THB" },
          stops: [{ stopId: "pickup" }, { stopId: "dropoff" }],
          specialRequests: [],
        },
      }) };
    }
    if (url.endsWith("/v3/orders") && options.method === "POST") {
      posts.push(JSON.parse(options.body));
      postedBalances.push(docs.get(walletPath).balance);
      if (networkFailure) throw new Error("Connection timed out after request");
      return {
        ok: nextPlaceStatus === 201,
        status: nextPlaceStatus,
        json: async () => nextPlaceStatus === 201
          ? { data: {
              orderId: "ll-placed-1", status: "ASSIGNING_DRIVER",
              priceBreakdown: { total: nextFinalFee, currency: "THB" },
            } }
          : { errors: [{ id: "REJECTED", message: "Validation rejected" }] },
      };
    }
    throw new Error("Unexpected provider URL " + url);
  };
  const mocks = {
    "firebase-functions/v2/https": {
      HttpsError: class HttpsError extends Error {
        constructor(code, message, details) { super(message); this.code = code; this.details = details; }
      },
      onCall: (_options, handler) => handler,
    },
    "firebase-admin/firestore": {
      getFirestore: () => db,
      FieldValue: {
        serverTimestamp: () => new Date(),
        delete: () => DELETED,
      },
    },
    "./lalamove-order-lifecycle": nodeRequire("../../functions/lalamove-order-lifecycle.js"),
  };
  const module = { exports: {} };
  new Function("require", "fetch", "module", "exports", source)(
    name => mocks[name] || nodeRequire(name), fakeFetch, module, module.exports,
  );
  return {
    api: module.exports,
    docs, path, walletPath, posts, postedBalances,
    request: () => ({ auth: { uid: "cashier" }, data: { orderId: "order-one" } }),
    setPlaceStatus: value => { nextPlaceStatus = value; },
    setFinalFee: value => { nextFinalFee = value; },
    setFailNetwork: value => { networkFailure = value; },
    transactions: () => [...docs].filter(([key]) => key.startsWith("tenants/tenant-one/lalamoveWalletTransactions/"))
      .map(([key, value]) => ({ id: key.split("/").at(-1), ...value })),
  };
}

test("central prepaid dispatch atomically debits before provider POST and settles one ledger entry", async () => {
  const h = harness();
  const answer = await h.api.placeTenantLalamoveDispatch(h.request());
  assert.equal(answer.created, true);
  assert.deepEqual(h.postedBalances, [41], "provider must never be called before wallet is debited");
  assert.equal(h.docs.get(h.walletPath).balance, 41);
  assert.equal(h.docs.get(h.path).lalamoveWalletDebitedAmount, 59);
  assert.equal(h.docs.get(h.path).lalamoveWalletDebitPending, false);
  assert.equal(h.docs.get(h.path).lalamoveDispatchReservation, undefined);
  assert.equal(h.transactions().filter(row => row.type === "delivery_debit" && row.status === "settled").length, 1);
  const again = await h.api.placeTenantLalamoveDispatch(h.request());
  assert.equal(again.alreadyPlaced, true);
  assert.equal(h.posts.length, 1);
});

test("insufficient credit fails closed without contacting provider or creating a debit", async () => {
  const h = harness({ balance: 40 });
  await assert.rejects(h.api.placeTenantLalamoveDispatch(h.request()), error =>
    error.code === "failed-precondition" && error.message === "FOD_WALLET_INSUFFICIENT_BALANCE");
  assert.equal(h.posts.length, 0);
  assert.equal(h.docs.get(h.walletPath).balance, 40);
  assert.equal(h.transactions().length, 0);
});

test("concurrent requests can never double-book or double-debit the same order", async () => {
  const h = harness();
  const results = await Promise.allSettled([
    h.api.placeTenantLalamoveDispatch(h.request()),
    h.api.placeTenantLalamoveDispatch(h.request()),
  ]);
  assert.equal(results.filter(item => item.status === "fulfilled" && item.value?.created === true).length, 1);
  assert.ok(results.every(item => item.status === "rejected"
    || item.value?.created === true || item.value?.alreadyPlaced === true));
  assert.equal(h.posts.length, 1);
  assert.equal(h.docs.get(h.walletPath).balance, 41);
  assert.equal(h.transactions().filter(item => item.type === "delivery_debit").length, 1);
});

test("definitive provider rejection reverses reservation exactly once and permits a new attempt", async () => {
  const h = harness({ placeStatus: 422 });
  await assert.rejects(h.api.placeTenantLalamoveDispatch(h.request()), /LALAMOVE_ORDER_CREATE_FAILED/);
  assert.equal(h.docs.get(h.walletPath).balance, 100);
  assert.equal(h.docs.get(h.path).lalamoveDispatchReservation, undefined);
  assert.equal(h.transactions().filter(row => row.status === "reversed").length, 1);
  assert.equal(h.transactions().filter(row => row.type === "delivery_refund").length, 1);
  h.setPlaceStatus(201);
  const result = await h.api.placeTenantLalamoveDispatch(h.request());
  assert.equal(result.created, true);
  assert.equal(h.docs.get(h.walletPath).balance, 41);
});

test("unknown provider outcome retains funds and blocks automatic retry to avoid duplicate dispatch", async () => {
  const h = harness({ failNetwork: true });
  await assert.rejects(h.api.placeTenantLalamoveDispatch(h.request()), /LALAMOVE_ORDER_CREATE_FAILED/);
  assert.equal(h.docs.get(h.walletPath).balance, 41);
  assert.equal(h.docs.get(h.path).lalamoveDispatchReservation.state, "review_required");
  h.setFailNetwork(false);
  await assert.rejects(h.api.placeTenantLalamoveDispatch(h.request()), /LALAMOVE_DISPATCH_IN_PROGRESS/);
  assert.equal(h.posts.length, 1);
  assert.equal(h.transactions().filter(row => row.type === "delivery_refund").length, 0);
});

test("provider final fee increase is atomically taken from available Wallet funds", async () => {
  const h = harness({ finalFee: 60 });
  const result = await h.api.placeTenantLalamoveDispatch(h.request());
  assert.equal(result.created, true);
  assert.deepEqual(h.postedBalances, [41]);
  assert.equal(h.docs.get(h.walletPath).balance, 40);
  assert.equal(h.docs.get(h.path).lalamoveWalletDebitedAmount, 60);
  assert.equal(h.docs.get(h.path).lalamoveDispatchReservation, undefined);
  assert.equal(h.transactions().filter(row => row.type === "delivery_debit" && row.status === "settled").length, 2);
});

test("provider final fee decrease is refunded to the prepaid Wallet exactly once", async () => {
  const h = harness({ finalFee: 58 });
  await h.api.placeTenantLalamoveDispatch(h.request());
  assert.equal(h.docs.get(h.walletPath).balance, 42);
  assert.equal(h.docs.get(h.path).lalamoveWalletDebitedAmount, 58);
  assert.equal(h.transactions().filter(row => row.type === "delivery_refund").length, 1);
});

test("insufficient Wallet for provider final fee increase requires review without debt", async () => {
  const h = harness({ balance: 59, finalFee: 60 });
  await assert.rejects(h.api.placeTenantLalamoveDispatch(h.request()), /LALAMOVE_DISPATCH_RECONCILIATION_REQUIRED/);
  assert.equal(h.docs.get(h.walletPath).balance, 0);
  assert.equal(h.docs.get(h.path).lalamoveDispatchReservation.state, "review_required");
  assert.equal(h.posts.length, 1);
  assert.equal(h.transactions().filter(row => row.type === "delivery_refund").length, 0);
});

test("tenant's own Lalamove account remains independent of central prepaid wallet", async () => {
  const h = harness({ mode: "partner", balance: 0 });
  const result = await h.api.placeTenantLalamoveDispatch(h.request());
  assert.equal(result.created, true);
  assert.equal(h.docs.get(h.walletPath).balance, 0);
  assert.equal(h.transactions().length, 0);
  assert.equal(h.posts.length, 1);
});
