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
