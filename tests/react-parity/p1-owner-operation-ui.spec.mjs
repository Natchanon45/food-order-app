import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";
import * as P from "../../react-app/src/data/ownerAccountRecovery.mjs";
const actor="p13c-superadmin",tenant="p13c-tenant",op=randomUUID();
const storage=()=>{const map=new Map();return{
 getItem:key=>map.has(key)?map.get(key):null,
 setItem:(key,value)=>map.set(key,value),
 removeItem:key=>map.delete(key),map,
}};
const good={ok:true,readOnly:true,operationId:op,tenantId:tenant,kind:"create",
 status:"complete_verified",ownerUid:"p13c-owner123",ownerRevision:1,
 displayName:"New Owner",mayRetryWithNewOperationId:false,
 canIssueInvoice:false,canSettleMoney:false,canChangeSubscription:false,
 emailSent:false};
test("only owner-scoped UUID is retained; cross-tenant/reload and corrupted storage fail closed",()=>{
 const box=storage();
 assert.equal(P.readOwnerOperation(box,actor,tenant),"");
 P.holdOwnerOperation(box,actor,tenant,op);
 assert.equal(P.readOwnerOperation(box,actor,tenant),op);
 assert.equal(P.readOwnerOperation(box,actor,"another-tenant"),"");
 assert.equal(box.map.size,1);
 assert.equal(box.map.get(P.ownerOperationKey(actor,tenant)),op);
 assert.throws(()=>P.holdOwnerOperation(box,actor,tenant,randomUUID()),/OWNER_/);
 assert.throws(()=>P.releaseOwnerOperation(box,actor,tenant,randomUUID()),/OWNER_/);
 P.releaseOwnerOperation(box,actor,tenant,op);
 assert.equal(P.readOwnerOperation(box,actor,tenant),"");
 box.setItem(P.ownerOperationKey(actor,tenant),"broken");
 assert.throws(()=>P.readOwnerOperation(box,actor,tenant),/OWNER_/);
 const blocked={getItem(){throw Error("storage disabled")}};
 assert.throws(()=>P.readOwnerOperation(blocked,actor,tenant),/storage disabled/);
});
test("only authenticated read-only operation matching tenant, actor and finance-denial flags can certify success",()=>{
 assert.equal(P.verifyOwnerOperation(good,tenant,op).status,"complete_verified");
 for(const patch of [{readOnly:false},{operationId:randomUUID()},
  {canIssueInvoice:true},{canSettleMoney:true},{canChangeSubscription:true},
  {emailSent:true},{ownerUid:"x"},{ownerRevision:0},{kind:"payment"},
  {status:"paid"},{mayRetryWithNewOperationId:true}]){
  assert.throws(()=>P.verifyOwnerOperation({...good,...patch},tenant,op),/OWNER_/);
 }
 for(const status of ["pending_review","review_required","not_found"])
 assert.equal(P.verifyOwnerOperation({...good,status,displayName:null},tenant,op).status,status);
 assert.equal(P.verifyOwnerOperation({...good,status:"failed_released",
  mayRetryWithNewOperationId:true,displayName:null},tenant,op).status,"failed_released");
});
test("canonical independent list must match Owner UID/name/revision and onboarding",()=>{
 const row={id:tenant,ownerUid:good.ownerUid,ownerDisplayName:good.displayName,
  ownerRevision:1,onboardingRequired:false,active:true};
 assert.equal(P.canonicalOwnerMatches([row],good),true);
 for(const change of [{ownerUid:"other"},{ownerDisplayName:"Wrong Name"},
  {ownerRevision:2},{onboardingRequired:true}]){
  assert.equal(P.canonicalOwnerMatches([{...row,...change}],good),false);
 }
 assert.equal(P.canonicalOwnerMatches([],good),false);
});
test("Source Owner screen routes both writes through UUID, read-only status and canonical reload; browser rules protect receipts",()=>{
 const page=readFileSync(new URL("../../react-app/src/pages/PlatformOwnersPage.jsx",import.meta.url),"utf8");
 const service=readFileSync(new URL("../../functions/tenant-owner-operation.js",import.meta.url),"utf8");
 const rules=readFileSync(new URL("../../firestore.rules",import.meta.url),"utf8");
 for(const token of ["holdOwnerOperation(window.sessionStorage",
  "getPlatformTenantOwnerOperation({","canonicalOwnerMatches(nextTenants,status)",
  "OwnerOperationRecoveryNotice","expectedOnboardingRequired:selected.onboardingRequired===true",
  "expectedRevision:selected.ownerRevision ?? 0"])
  assert.ok(page.includes(token),token);
 for(const token of ["tx.create(operation,","tx.create(lock,",
  "nativeAuth.createUser({uid:ownerUid","policy.billingDigest(t)",
  "nativeAuth.updateUser(input.ownerUid","tx.delete(lock)"])
  assert.ok(service.includes(token),token);
 for(const name of ["ownerEmailReservations","ownerAccountOperations","ownerAccountLocks"])
  assert.match(rules,new RegExp("match /"+name+"/\\{"));
});
test("Owner recovery notice stacks without horizontal overflow on four sizes",async()=>{
 const css=readFileSync(new URL("../../react-app/src/ui/owner-account-recovery.css",import.meta.url),"utf8");
 const browser=await chromium.launch({channel:"chrome",headless:true});
 try{
  for(const width of [320,390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:860}});
   try{
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0}main{max-width:1100px;margin:auto;padding:12px}.btn{padding:9px 12px;border:0;border-radius:10px;background:#12633d;color:white}</style>
<style>${css}</style></head><body><main><section class="owner-op-recovery" role="alert"><span class="owner-op-recovery-icon">!</span><div class="owner-op-recovery-copy"><strong>ยังยืนยันผลการจัดการ Owner — ร้านค้า A ไม่ได้</strong><p>ระบบเก็บหมายเลขคำสั่งเดิมไว้แล้ว และจะไม่ส่งคำสั่งสร้างหรือแก้ไข Owner ซ้ำจนกว่า Firebase จะยืนยันผล</p></div><button class="btn owner-op-recovery-action">ตรวจสถานะคำสั่งเดิม</button></section></main></body></html>`);
    const geom=await page.evaluate(()=>({
     overflow:document.documentElement.scrollWidth-innerWidth,
     button:document.querySelector("button").getBoundingClientRect().width,
     viewport:innerWidth,
    }));
    assert.ok(geom.overflow<=2,JSON.stringify({width,...geom}));
    assert.ok(geom.button>100&&geom.button<=width-20);
   }finally{await page.close();}
  }
 }finally{await browser.close();}
});
