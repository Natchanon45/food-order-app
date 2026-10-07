import test from "node:test";
import assert from "node:assert/strict";
import {
  isKitchenLocked,
  isLalamoveDelivery,
  lalamoveDispatchActive,
} from "../../react-app/src/utils/kitchenOrderLock.js";

const base = {
  id: "delivery-test",
  orderType: "delivery",
  status: "ready",
  deliveryProvider: "lalamove",
};

test("active Lalamove dispatch locks kitchen edits", () => {
  for (const status of ["ASSIGNING_DRIVER", "ON_GOING", "PICKED_UP"]) {
    const order = { ...base, lalamoveOrderId: "ll-123", lalamoveOrderStatus: status };
    assert.equal(isLalamoveDelivery(order), true);
    assert.equal(lalamoveDispatchActive(order), true);
    assert.equal(isKitchenLocked(order), true);
  }
});

test("legacy dispatch evidence still identifies and locks a Lalamove delivery", () => {
  const legacy = {
    id: "legacy-delivery",
    orderType: "delivery",
    status: "ready",
    deliveryProvider: "",
    lalamoveDispatchPlacedAt: "2026-10-08T00:00:00.000Z",
    lalamoveOrderStatus: "ASSIGNING_DRIVER",
  };
  assert.equal(isLalamoveDelivery(legacy), true);
  assert.equal(lalamoveDispatchActive(legacy), true);
  assert.equal(isKitchenLocked(legacy), true);
});

test("cancelled/rejected/expired dispatch can be edited again when order itself is still active", () => {
  for (const status of ["CANCELED", "CANCELLED", "REJECTED", "EXPIRED"]) {
    const order = { ...base, lalamoveOrderId: "ll-123", lalamoveOrderStatus: status };
    assert.equal(lalamoveDispatchActive(order), false);
    assert.equal(isKitchenLocked(order), false);
  }
});

test("terminal kitchen order states stay locked", () => {
  for (const status of ["served", "paid", "completed", "cancelled"]) {
    assert.equal(isKitchenLocked({ ...base, status, lalamoveOrderId: "" }), true);
  }
});
