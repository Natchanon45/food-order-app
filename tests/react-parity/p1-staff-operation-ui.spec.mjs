import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";
import {
 staffPendingKey,readStaffPending,persistStaffPending,clearStaffPending,
 verifiedStaffRow,
} from "../../react-app/src/data/staffOperationRecovery.mjs";
const owner="p13b-owner-123",tenant="p13b-tenant-123",id=randomUUID();
function storage(){
 const map=new Map();
 return {getItem:key=>map.has(key)?map.get(key):null,
   setItem:(key,value)=>map.set(key,value),
   removeItem:key=>map.delete(key),map};
}
test("pending lock is only UUID in owner+tenant-scoped session and survives reload",()=>{
 const store=storage();
 assert.equal(readStaffPending(store,owner,tenant),"");
 persistStaffPending(store,owner,tenant,id);
 assert.equal(readStaffPending(store,owner,tenant),id);
 assert.equal(store.map.size,1);
 assert.equal(store.map.get(staffPendingKey(owner,tenant)),id);
 assert.equal(readStaffPending(store,owner,"p13b-other-tenant"),"");
 assert.throws(()=>persistStaffPending(store,owner,tenant,randomUUID()),
   /STAFF_PREVIOUS_OPERATION_UNRESOLVED/);
 assert.throws(()=>clearStaffPending(store,owner,tenant,randomUUID()),/STAFF_OPERATION_ID_CHANGED/);
 clearStaffPending(store,owner,tenant,id);
 assert.equal(readStaffPending(store,owner,tenant),"");
});
test("storage unavailable or corrupted UUID fails closed",()=>{
 const fail={getItem(){throw Error("storage-blocked")}};
 assert.throws(()=>readStaffPending(fail,owner,tenant),/storage-blocked/);
 const store=storage();
 store.setItem(staffPendingKey(owner,tenant),"NOT_UUID");
 assert.throws(()=>readStaffPending(store,owner,tenant),/STAFF_PENDING_STORAGE_CORRUPT/);
 assert.throws(()=>persistStaffPending(store,owner,tenant,"invalid"),/STAFF_OPERATION_ID_INVALID/);
});
test("a verified response plus an independent canonical staff list is mandatory",()=>{
 const status={status:"complete_verified",readOnly:true,
   kind:"create",uid:"staffmember",operationId:id,staffRevision:1};
 assert.equal(verifiedStaffRow(status,[{uid:"staffmember",staffRevision:1}]),true);
 for(const modified of [{status:"pending_review"},{readOnly:false},{uid:"other"},
   {staffRevision:0},{operationId:"fake"},{kind:"owner"}]){
  assert.equal(verifiedStaffRow({...status,...modified},
    [{uid:"staffmember",staffRevision:1}]),false);
 }
 assert.equal(verifiedStaffRow(status,[{uid:"staffmember",staffRevision:2}]),false);
 assert.equal(verifiedStaffRow(status,[]),false);
});
test("Admin Users has a persistent recovery gate and does not treat Callable ack as success",()=>{
 const page=readFileSync(new URL("../../react-app/src/pages/AdminUsersPage.jsx",import.meta.url),"utf8");
 const service=readFileSync(new URL("../../react-app/src/data/adminStaff.js",import.meta.url),"utf8");
 const server=readFileSync(new URL("../../functions/staff-admin.js",import.meta.url),"utf8");
 const rules=readFileSync(new URL("../../firestore.rules",import.meta.url),"utf8");
 assert.match(page,/StaffOperationRecoveryNotice/);
 assert.match(page,/persistStaffPending\(window.sessionStorage/);
 assert.match(page,/getTenantStaffOperationStatus\(tenantId, operationId\)/);
 assert.match(page,/verifiedStaffRow\(status, rows\)/);
 assert.match(page,/pendingReadyTenantId !== currentTenantId/);
 assert.match(page,/await completeStaffOperation\(tenantId, operationId\)/);
 assert.match(service,/expectedRevision: patch.expectedRevision/);
 assert.match(service,/getTenantStaffOperationStatus/);
 assert.match(server,/emailVerified:false/);
 assert.match(server,/staffAccountLocks/);
 for(const block of ["staffEmailReservations","staffOperations","staffAccountLocks"]){
  assert.match(rules,new RegExp("match /"+block+"/\\{"));
 }
});
test("recovery warning and read-only status action fit four widths",async()=>{
 const componentCss=readFileSync(new URL("../../react-app/src/ui/staff-operation-recovery.css",import.meta.url),"utf8");
 const browser=await chromium.launch({channel:"chrome",headless:true});
 try{
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:780}});
   try{
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0}main{max-width:1150px;margin:auto;padding:12px}.btn{padding:8px 12px;border-radius:10px;border:0;background:#145d37;color:#fff}</style>
<style>${componentCss}</style></head><body><main><section class="staff-op-recovery" role="alert">
<span class="staff-op-recovery-icon">!</span><div class="staff-op-recovery-copy">
<strong>มีคำสั่งจัดการบัญชีพนักงานที่ยังไม่ได้ยืนยันผล</strong><p>ระบบเก็บหมายเลขคำสั่งเดิมไว้แล้ว จะไม่ส่งคำสั่งสร้าง/แก้ไขซ้ำจนกว่าจะตรวจสถานะจาก Firebase</p>
</div><button class="btn staff-op-recovery-button" type="button">ตรวจสถานะคำสั่งเดิม</button>
</section></main></body></html>`);
    const values=await page.evaluate(()=>{
     const button=document.querySelector("button").getBoundingClientRect();
     return {overflow:document.documentElement.scrollWidth-innerWidth,
      buttonWidth:button.width, viewport:innerWidth};
    });
    assert.ok(values.overflow<=2,`overflow at ${width}: ${values.overflow}`);
    assert.ok(values.buttonWidth>120&&values.buttonWidth<=width-20);
   }finally{await page.close();}
  }
 }finally{await browser.close();}
});
