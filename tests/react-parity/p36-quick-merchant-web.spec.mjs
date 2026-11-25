import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {orderQuickOrderMenus,quickOrderCategoryNames} from "../../react-app/src/data/quickOrderAdminMenuOrder.mjs";
const read=p=>readFileSync("react-app/src/"+p,"utf8");
test("quick order respects admin category and menu ordering without mutating source rows",()=>{
 const menus=[{id:"1",category:"B",name:"b",sortOrder:0},{id:"2",category:"A",name:"z",sortOrder:2},{id:"3",category:"A",name:"a",sortOrder:1}];
 const sorted=orderQuickOrderMenus(menus,["A","B"]);
 assert.deepEqual(sorted.map(m=>m.id),["3","2","1"]);
 assert.deepEqual(menus.map(m=>m.id),["1","2","3"]);
 assert.deepEqual(quickOrderCategoryNames(sorted),["A","B"]);
});
test("quick order readback uses server, display version is monotonic, append controls locked",()=>{
 const page=read("pages/QuickOrderPage.jsx"),data=read("data/operationalData.js");
 assert.match(page,/getOperationalOrderFromServer\(tenant.id,id\)/);
 assert.match(page,/if\(error\?\.message==="ORDER_NOT_FOUND"\)return null;throw error/);
 assert.match(page,/Math.max\(Date.now\(\),displayVersion.current\+1\)/);
 assert.match(page,/disabled=\{serviceType !== "dine_in" \|\| Boolean\(appendToId\)\}/);
 assert.match(data,/if\(current>version\)throw stale\(\)/);
 assert.match(data,/snapshotUpdatedAt:version/);
});
test("merchant QR waits for decoded image, support address follows enabled public contact",()=>{
 const qr=read("pages/AdminQrPage.jsx"),legal=read("pages/LegalPage.jsx");
 assert.match(qr,/await qrImage.decode\(\)/);
 assert.match(qr,/setLoadError\(""\)/);
 assert.match(legal,/row\?\.enabled===true&&row\?\.emailEnabled===true/);
});
test("verification refuses missing/mixed round IDs and only reflects canonical paid status",()=>{
 const page=read("pages/VerifyPage.jsx");
 assert.match(page,/valid.length!==ids.length/);
 assert.match(page,/row.tableToken!==valid\[0\].tableToken/);
 assert.match(page,/order\?\.paymentStatus === "paid" && order\?\.status !== "cancelled"/);
 assert.match(page,/<RevisedOrderNet/);
});
