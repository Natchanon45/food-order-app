import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {groupCompanionObservations} from "../../react-app/src/utils/companionObservationGrouping.mjs";
const require=createRequire(import.meta.url),p=require("../../functions/payment-companion-policy");
const now=Date.parse("2026-11-22T07:00:00Z"),sample={eventId:"a".repeat(64),source:"line_scb_connect",amount:"100.25",receiverSuffix:"X-1234",bankDisplayTime:"2026-11-22T13:59:00+07:00",deviceObservedAt:"2026-11-22T13:59:30+07:00"};
test("strict structured observation, UTC transformation, privacy and invalid timestamp",()=>{
 const n=p.notice(sample,now);assert.equal(n.amountSatang,10025);assert.equal(n.bankMs,now-60000);
 for(const patch of [{amount:"100.255"},{amount:"0.00"},{receiverSuffix:"1234561234"},{source:"__proto__"},{bankDisplayTime:"2026-02-30T12:00:00Z"},{deviceObservedAt:"2026-11-21T00:00:00Z"},{bankConfirmed:true},{notificationText:"OTP raw text"}])assert.throws(()=>p.notice({...sample,...patch},now));
 assert.throws(()=>p.notice({kind:"raw_notification",notificationText:"sensitive"},now),/RAW_NOT_SUPPORTED/);
});
test("only matching bank, masked recipient, exact satang and preceding 15-minute interval; duplicate/shared observations never unique",()=>{
 const recipient=p.receiver({bankName:"ธนาคารไทยพาณิชย์",bankAccountNumber:"1234561234",bankAccountName:"Demo",promptPayId:"0900009876"}),n={...p.notice(sample,now),id:"a"};
 const order={id:"one",amountSatang:10025,createdMs:now,hasSlip:true};
 assert.equal(recipient.storePaymentReady,true);assert.equal(recipient.promptPayLast4,"9876");
 assert.equal(p.rank([order],[n],recipient)[0].status,"candidate");
 for(const patch of [{source:"line_kbank_live"},{receiverSuffix:"X-9999"},{amountSatang:10024},{bankMs:now+1},{bankMs:now-900001}])assert.equal(p.rank([order],[{...n,...patch}],recipient)[0].status,"no_match");
 assert.ok(p.rank([order,{...order,id:"two"}],[n],recipient).every(m=>m.status==="ambiguous"));
 assert.equal(p.rank([order],[n,{...n,id:"b"}],recipient)[0].status,"ambiguous");
 assert.equal(p.rank([order],[n],recipient,{truncated:true})[0].status,"unavailable");
 assert.equal(p.rank([order],[n],recipient)[0].paymentVerified,false);
 const groups=groupCompanionObservations([{id:"a",deviceId:"d",amountSatang:10025,receiverSuffix:"X-1234",bankTimeUTC:sample.bankDisplayTime},{id:"b",deviceId:"d",amountSatang:10025,receiverSuffix:"X-1234",bankTimeUTC:sample.bankDisplayTime}]);
 assert.equal(groups[0].possibleDuplicate,true);assert.equal(groups[0].notificationCount,2);
});

test("source QR after-confirm candidates are advisory; bank timestamp within original five-minute window only",()=>{
 const recipient=p.receiver({bankName:"SCB",bankAccountNumber:"0000001234",bankAccountName:"Synthetic",promptPayId:"0912345678"});
 const created=Date.parse("2026-11-22T10:25:25Z");
 const order={id:"qr-order",amountSatang:20000,createdMs:created,paymentQrMode:"confirmed_order_5m",
   qrStartedMs:created,qrExpiryMs:created+300000,hasSlip:false};
 const notice={id:"qr-notice",source:"line_scb_connect",receiverSuffix:"X-1234",amountSatang:20000,
   bankMs:created+25000,observedMs:created+26000,receivedMs:created+27000};
 assert.equal(p.rank([order],[notice],recipient)[0].status,"candidate");
 assert.equal(p.rank([order],[{...notice,bankMs:created-90000}],recipient)[0].status,"no_match");
 assert.equal(p.rank([order],[{...notice,bankMs:created+300001}],recipient)[0].status,"no_match");
 assert.equal(p.rank([order],[{...notice,receivedMs:created+361000}],recipient)[0].status,"no_match");
 assert.equal(p.rank([order],[{...notice,bankMs:created+30000,receivedMs:created+20000}],recipient)[0].status,"no_match");
 assert.equal(p.rank([{...order,qrExpiryMs:created+600000}],[notice],recipient)[0].status,"no_match");
 const minute={...notice,bankMs:Math.floor(created/60000)*60000,observedMs:created+20000,receivedMs:created+25000};
 assert.equal(p.rank([order],[minute],recipient)[0].status,"time_precision_review");
 assert.equal(p.rank([order],[{...minute,observedMs:created-1}],recipient)[0].status,"no_match");
 assert.equal(p.rank([order, {...order,id:"same-amount-order"}],[notice],recipient)[0].status,"ambiguous");
 assert.equal(p.rank([order],[notice,{...notice,id:"another"}],recipient)[0].status,"ambiguous");
 assert.ok(p.rank([order],[notice],recipient).every(m=>m.paymentVerified===false));
});
