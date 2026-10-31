import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=x=>readFileSync(x,"utf8");
const source=read("react-app/src/pages/AdminSalesReportPage.jsx");
const rev=read("react-app/src/pages/RevenueShareReportPage.jsx");
const term=read("react-app/src/components/MerchantServiceTerms.jsx");
const style=read("react-app/public/parity/css/merchant-service-terms-port.css");
test("PENGUIN cancellation band precedes receipt identity like LUKKAJA",()=>{
 const modal=source.slice(source.indexOf('<dialog id="receiptDialog"'));
 assert.ok(modal.indexOf('className="receipt-cancelled-banner"') < modal.indexOf('className="receipt-detail-head"'));
 assert.match(modal,/sales_report.cancel.source_/);
});
test("new reusable report service terms match LUKKAJA heading, notes and policy geometry",()=>{
 assert.match(rev,/MerchantServiceTerms/);
 assert.match(rev,/merchant-service-terms-port.css/);
 assert.match(rev,/threshold=\{Number\.isFinite\(centralThreshold\)/);
 assert.match(rev,/shareRate=\{Number\.isFinite\(centralRate\)/);
 assert.match(term,/เงื่อนไขการใช้งานและค่าบริการ PENGUIN/);
 for(const snippet of ["30 วันแรกหลังเปิดใช้งาน","100 รายการต่อรอบบิล","ยังต้องยืนยันความพร้อมของบริการ"])assert.ok(term.includes(snippet),snippet);
 assert.match(style,/\.merchant-service-terms h3/);
 assert.match(style,/@media \(max-width: 640px\)/);
 assert.doesNotMatch(term,/const monthly = 590|const annual = 5900/);
});
