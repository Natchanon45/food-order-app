import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {appendThresholdVersion,thresholdForCycle,readThresholdHistory}=require('../../functions/delivery-threshold-schedule');
const {eligibleDeliveryShareCentsByDay,eligibleDeliveryShareDays}=require('../../functions/revenue-share-policy');
const raw={deliveryThreshold:10000};
const v1={effectiveOn:'2026-12-01',thresholdCents:1500000,baselineThresholdCents:1000000};
const v2={effectiveOn:'2027-01-01',thresholdCents:1200000,baselineThresholdCents:1000000};
test('future threshold history is append-only, validates Bangkok date and locks the original baseline',()=>{
 const history=appendThresholdVersion(raw,v1,'2026-11-22');
 assert.deepEqual(history,[v1]); assert.equal(raw.deliveryThresholdVersions,undefined);
 assert.deepEqual(appendThresholdVersion({...raw,deliveryThresholdVersions:history},v2,'2026-11-22'),[v1,v2]);
 for(const input of [{...v1,effectiveOn:'2026-11-22'},{...v1,effectiveOn:'2026-11-31'},{...v1,baselineThresholdCents:1},{...v1,thresholdCents:1000000},{...v1,thresholdCents:1500000.5}]) assert.throws(()=>appendThresholdVersion(raw,input,'2026-11-22'));
 assert.throws(()=>appendThresholdVersion({...raw,deliveryThresholdVersions:history},v1,'2026-11-22'));
 assert.throws(()=>readThresholdHistory({...raw,deliveryThresholdVersions:[v2,v1]}));
});
test('anniversary starting before effective date retains old cap for its entire cycle',()=>{
 assert.equal(thresholdForCycle(10000,'2026-11-18',[v1,v2]),10000);
 assert.equal(thresholdForCycle(10000,'2026-12-18',[v1,v2]),15000);
 assert.equal(thresholdForCycle(10000,'2027-01-18',[v1,v2]),12000);
 const rows=[{date:'2026-11-18',cents:1000000},{date:'2026-12-02',cents:100000},{date:'2026-12-18',cents:1400000},{date:'2026-12-19',cents:200000}];
 const actual=eligibleDeliveryShareCentsByDay(rows,10000,'2026-10-18',[v1]);
 assert.equal(actual.get('2026-12-02'),100000);
 assert.equal(actual.get('2026-12-18')||0,0);
 assert.equal(actual.get('2026-12-19'),100000);
 assert.equal(eligibleDeliveryShareDays(rows,10000,'2026-10-18',[v1]).has('2026-12-18'),false);
});
