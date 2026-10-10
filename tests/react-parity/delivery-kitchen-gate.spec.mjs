import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryKitchenAdmitted } from '../../react-app/src/data/deliveryKitchenGate.js';
import fs from 'node:fs';
test('COD is immediate but prepayment is held until verified paid', () => {
  assert.equal(deliveryKitchenAdmitted({orderType:'delivery',paymentMethod:'cod',paymentStatus:'unpaid'}),true);
  assert.equal(deliveryKitchenAdmitted({orderType:'delivery',paymentMethod:'promptpay',paymentStatus:'pending_verification'}),false);
  assert.equal(deliveryKitchenAdmitted({orderType:'delivery',paymentMethod:'promptpay',paymentStatus:'paid'}),true);
  assert.equal(deliveryKitchenAdmitted({orderType:'delivery',paymentMethod:'promptpay',paymentStatus:'unpaid'}),false);
  assert.equal(deliveryKitchenAdmitted({orderType:'table',paymentStatus:'unpaid'}),true);
});
test('Kitchen cards honor admission gate', () => {
  const source=fs.readFileSync('react-app/src/pages/KitchenPage.jsx','utf8');
  assert.match(source,/deliveryKitchenAdmitted\(order\)/);
});

test('Kitchen reads only restaurant collections and settles both data sources before readiness', () => {
  const kitchen=fs.readFileSync('react-app/src/pages/KitchenPage.jsx','utf8');
  const data=fs.readFileSync('react-app/src/data/operationalData.js','utf8');
  const scope=data.split('export async function loadKitchenMenus(tenantId) {')[1]?.split('export function watchOperationalOrders')[0];
  assert.ok(scope);
  assert.match(scope,/tenantCollection\(id, "menus"\)/);
  assert.doesNotMatch(scope,/heldBills|tenantCollection\(id, "tables"\)/);
  assert.match(kitchen,/loadKitchenMenus\(tenant.id\)/);
  assert.ok(kitchen.includes('setOrderLoadError("")'));
  assert.match(kitchen, /menusSettled && ordersSettled/);
  assert.doesNotMatch(kitchen,/loadOperationalSnapshot\(tenant.id\)/);
});
