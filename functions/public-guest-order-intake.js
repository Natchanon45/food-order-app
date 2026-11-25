"use strict";
// P3.3 public Table/Takeaway: never accept a browser-supplied payment,
// order status, menu price, total, or Tenant flag as financial authority.
const {randomUUID,createHash,randomBytes}=require("node:crypto");
const {onCall,HttpsError}=require("./managed-email-callable");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const REGION="asia-southeast1";
const ID=/^[A-Za-z0-9_-]{4,128}$/;
const DOC_ID=/^[A-Za-z0-9_-]{1,128}$/;
const CLOSED=new Set(["suspended","expired"]);
function fail(message,code="failed-precondition"){
 throw new HttpsError(code,message);
}
function trim(value,max=300){return String(value||"").trim().slice(0,max);}
function cents(value){
 const amount=Number(value);
 if(!Number.isFinite(amount)||amount<0||
   Math.abs(amount*100-Math.round(amount*100))>0.000001||
   !Number.isSafeInteger(Math.round(amount*100)))
   fail("PUBLIC_MENU_PRICE_INVALID");
 return Math.round(amount*100);
}
function openTenant(tenant={}){
 return tenant.active!==false&&
  tenant.operationalSuspended!==true&&
  tenant.revenueShareSuspended!==true&&
  !CLOSED.has(trim(tenant.subscriptionStatus).toLowerCase())&&
  trim(tenant.status).toLowerCase()!=="suspended"&&
  ["both","restaurant_cafe"].includes(trim(tenant.businessType||"both"));
}
function parse(data,kind){
 const tenantId=trim(data?.tenantId,128);
 const id=trim(data?.orderId,128);
 const raw=Array.isArray(data?.items)?data.items:[];
 if(!ID.test(tenantId)||!ID.test(id)||raw.length<1||raw.length>100)
   fail("PUBLIC_ORDER_INPUT_INVALID","invalid-argument");
 const items=raw.map(item=>{
  const menuId=trim(item?.menuId||item?.id,128);
  const qty=item?.qty;
  const note=trim(item?.note,300);
  if(!DOC_ID.test(menuId)||!Number.isSafeInteger(qty)||qty<1||qty>999||
    String(item?.note||"").length>300)fail("PUBLIC_ORDER_ITEM_INVALID","invalid-argument");
  return {menuId,qty,note};
 });
 const recipient=kind==="takeaway"?{
  customerName:trim(data?.customerName,80),
  customerPhone:trim(data?.customerPhone,24),
 }:{
  tableId:trim(data?.tableId,128),
  tableToken:trim(data?.tableToken,300),
 };
 if(kind==="takeaway"){
  if(!recipient.customerName&&!recipient.customerPhone)
    fail("TAKEAWAY_CUSTOMER_REQUIRED","invalid-argument");
  if(String(data?.customerName||"").length>80||String(data?.customerPhone||"").length>24)
    fail("TAKEAWAY_CUSTOMER_INVALID","invalid-argument");
 }else if(!DOC_ID.test(recipient.tableId)||!recipient.tableToken||
   recipient.tableToken.length>300)fail("INVALID_TABLE_SESSION","invalid-argument");
 const orderNote=trim(data?.orderNote,300);
 const fingerprint=createHash("sha256").update(JSON.stringify({
  tenantId,id,kind,items,recipient,orderNote,
 })).digest("hex");
 return {tenantId,id,items,recipient,orderNote,fingerprint};
}
async function intake(db,kind,data){
 const payload=parse(data,kind);
 const {tenantId,id,items,recipient,fingerprint,orderNote}=payload;
 const tenantRef=db.collection("tenants").doc(tenantId);
 const orders=tenantRef.collection("orders");
 const ref=orders.doc(id);
 const menus=tenantRef.collection("menus");
 const menuIds=[...new Set(items.map(row=>row.menuId))];
 const tableRef=kind==="table"?
  tenantRef.collection("tables").doc(recipient.tableId):null;
 const now=new Date();
 const nowIso=now.toISOString();
 const localTime=new Intl.DateTimeFormat("en-GB",{
  timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit",
  hourCycle:"h23",
 }).format(now).replace(/\D/g,"");
 const queueNo="TA-"+localTime+"-"+randomBytes(3).toString("hex").toUpperCase();
 return db.runTransaction(async tx=>{
  const [tenantSnap,prior,tableSnap,...menuDocs]=await Promise.all([
   tx.get(tenantRef),tx.get(ref),tableRef?tx.get(tableRef):Promise.resolve(null),
   ...menuIds.map(menuId=>tx.get(menus.doc(menuId))),
  ]);
  if(!tenantSnap.exists||!openTenant(tenantSnap.data()))
   fail("TENANT_INACTIVE");
  if(prior.exists){
   const old=prior.data()||{};
   if(old.publicOrderFingerprint===fingerprint&&old.orderType===kind)
    return {id,alreadyRecorded:true,
     ...(kind==="takeaway"?{queueNo:String(old.queueNo||"")}:{} )};
   fail("PUBLIC_ORDER_ID_CONFLICT","already-exists");
  }
  const menuMap=new Map();
  for(let i=0;i<menuDocs.length;i++){
   if(!menuDocs[i].exists)fail("PUBLIC_MENU_NOT_FOUND");
   const menu=menuDocs[i].data()||{};
   if(menu.active===false||menu.isActive===false||menu.is_active===false)
    fail("PUBLIC_MENU_NOT_AVAILABLE");
   const price=Number(menu.price);
   const priceSatang=cents(price);
   const name=trim(menu.name,240);
   if(!name)fail("PUBLIC_MENU_NAME_REQUIRED");
   menuMap.set(menuIds[i],{name,price:priceSatang/100,priceSatang});
  }
  const canonical=items.map(item=>{
   const menu=menuMap.get(item.menuId);
   return {menuId:item.menuId,name:menu.name,price:menu.price,
    qty:item.qty,note:item.note,cancelled:false};
  });
  const totalSatang=items.reduce((sum,item)=>sum+
   menuMap.get(item.menuId).priceSatang*item.qty,0);
  if(!Number.isSafeInteger(totalSatang)||totalSatang<0||totalSatang>1e11)
   fail("PUBLIC_ORDER_TOTAL_INVALID");
  const amount=totalSatang/100;
  const common={
   id,tenantId,shopId:tenantId,orderType:kind,items:canonical,
   subtotalAmount:amount,totalAmount:amount,
   status:"pending",paymentStatus:"unpaid",
   note:orderNote,publicOrderFingerprint:fingerprint,
   createdAt:FieldValue.serverTimestamp(),
   createdAtText:nowIso,updatedAt:FieldValue.serverTimestamp(),
  };
  let specific;
  if(kind==="table"){
   if(!tableSnap?.exists)fail("INVALID_TABLE_SESSION");
   const table=tableSnap.data()||{};
   if(table.active===false||table.isActive===false||
      table.status!=="occupied"||table.orderToken!==recipient.tableToken)
    fail("INVALID_TABLE_SESSION");
   const currentRound=Number(table.currentRound||0);
   if(!Number.isSafeInteger(currentRound)||currentRound<0||currentRound>=1000)
    fail("TABLE_ROUND_EXCEEDED");
   const existingIds=Array.isArray(table.orderIds)?table.orderIds:[];
   if(existingIds.length>=1000)fail("TABLE_ROUND_EXCEEDED");
   specific={tableCode:trim(table.code||recipient.tableId,120),
    tableName:trim(table.name||table.code||recipient.tableId,160),
    tableToken:recipient.tableToken,roundNumber:currentRound+1};
   tx.update(tableRef,{currentRound:currentRound+1,
    orderIds:[...new Set([...existingIds,id])],
    updatedAt:FieldValue.serverTimestamp()});
  }else{
   specific={tableCode:"",tableToken:"",tableName:"",
    customerName:recipient.customerName,customerPhone:recipient.customerPhone,
    queueNo,pickupStatus:"waiting",paymentMethod:"cash"};
  }
  tx.create(ref,{...common,...specific});
  return {id,alreadyRecorded:false,...(kind==="takeaway"?{queueNo}:{})};
 });
}
exports.submitPublicTableOrder=onCall({region:REGION,timeoutSeconds:35},async request=>
 intake(getFirestore(),"table",request.data));
exports.submitPublicTakeawayOrder=onCall({region:REGION,timeoutSeconds:35},async request=>
 intake(getFirestore(),"takeaway",request.data));
exports.__test={parse,openTenant,intake,cents};
