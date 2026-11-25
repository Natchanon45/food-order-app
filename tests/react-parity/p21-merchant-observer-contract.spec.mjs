import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectMerchantObserver} from "../../react-app/src/data/merchantCompanionObserver.mjs";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");
const flags={paymentVerified:false,bankConfirmed:false,canSettleInvoice:false,canReleaseKitchen:false};
const base={id:"one",deviceId:"device-A",deviceLabel:"Owner Android",amountSatang:19900,source:"line_scb_connect",receiverSuffix:"X-1234",bankTimeUTC:"2026-11-25T05:00:00Z",receivedUTC:"2026-11-25T05:00:02Z",...flags};
const canonical={...flags,enabled:true,
 devices:[{id:"device-A",label:"Owner Android",enabled:true},{id:"device-B",label:"Secondary",enabled:false}],
 items:[base,{...base,id:"two"},{...base,id:"three",amountSatang:25000}],
 matches:[{orderId:"bill-A",amountSatang:19900,status:"candidate",orderTimeUTC:"2026-11-25T05:02:00Z",hasSlip:false}],
 matchStatus:"advisory"};
test("P2.1 source observer groups repeated Android alerts but never settles money",()=>{
 const r=projectMerchantObserver(canonical);
 assert.equal(r.groupedNotices.length,2);
 assert.equal(r.duplicateGroups,1);
 assert.equal(r.groupedNotices[0].notificationCount,2);
 assert.equal(r.activeCount,1);
 assert.equal(r.bankVerified,false);
 assert.equal(r.canAutoSettle,false);
 assert.equal(r.lkHistoryAvailable,false);
 assert.equal(r.matches[0].status,"candidate");
});
test("P2.1 strict read-model refuses forged Paid/bank claims, malformed events and duplicate IDs",()=>{
 for(const x of [
  {...canonical,paymentVerified:true},{...canonical,bankConfirmed:true},
  {...canonical,canSettleInvoice:true},{...canonical,canReleaseKitchen:true},
  {...canonical,items:[base,base]},
  {...canonical,items:[{...base,amountSatang:-1}]},
  {...canonical,items:[{...base,paymentVerified:true}]},
  {...canonical,items:[{...base,canReleaseKitchen:undefined}]},
  {...canonical,devices:"invalid"},
  {...canonical,items:Array(51).fill(base)},
 ])assert.throws(()=>projectMerchantObserver(x),/COMPANION_OBSERVER_/);
});
test("P2.1 latest Source independent Owner observer after Sales Report; pairing keeps its authority without duplicate history",()=>{
 const page=read("react-app/src/pages/AdminPage.jsx");
 const observer=read("react-app/src/components/PaymentCompanionObserverCard.jsx");
 const pairing=read("react-app/src/components/PaymentCompanionPairingCard.jsx");
 const css=read("react-app/src/ui/merchant-companion-observer.css");
 assert.ok(page.indexOf('data-admin-card-role="sales-report"')<page.indexOf('cardKey="companion-observer"'));
 assert.ok(page.indexOf('cardKey="companion-observer"')<page.indexOf("<AdminDeliveryQr "));
 assert.match(page,/profile\?\.role === "owner"/);
 assert.match(page,/id="paymentCompanionObserverCard"/);
 assert.match(page,/PaymentCompanionObserverCard isOwner/);
 assert.match(observer,/data-companion-observer-readonly/);
 assert.match(observer,/getPaymentCompanionDashboard/);
 assert.match(observer,/groupedNotices/);
 assert.doesNotMatch(observer,/(setPaymentCompanionReceiver|pairPaymentCompanionDevice|recordPaymentCompanionCashierReview|setCompanionAutoKitchenConsent)/);
 assert.doesNotMatch(pairing,/<div className="payment-companion-overview"/);
 assert.doesNotMatch(pairing,/className="payment-companion-panel payment-companion-activity"/);
 assert.match(pairing,/pairPaymentCompanionDevice/);
 assert.match(pairing,/setPaymentCompanionReceiver/);
 assert.match(css,/companion-observer/);
});
test("P2.1 unsupported Go Line topup and LK Shop outbox are not fabricated in Firebase",()=>{
 const page=read("react-app/src/pages/AdminPage.jsx");
 const observer=read("react-app/src/components/PaymentCompanionObserverCard.jsx");
 assert.doesNotMatch(page,/PlatformLineWalletTopup/);
 assert.doesNotMatch(observer,/api\/tenant\/lalamove\/line-topup/);
 assert.match(observer,/LK Shop Outbox/);
 assert.match(observer,/ไม่ใช่ยอดเงินที่ธนาคารยืนยัน/);
});
