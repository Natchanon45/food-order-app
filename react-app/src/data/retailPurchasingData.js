import { collection, deleteDoc, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/client";
const tenantCollection=(tenantId,name)=>collection(db,"tenants",tenantId,name);
const tenantDoc=(tenantId,name,id)=>doc(db,"tenants",tenantId,name,String(id));
const row=s=>({id:s.id,...s.data()});
const nowIso=()=>new Date().toISOString();
const round2=v=>Math.round((Number(v||0)+Number.EPSILON)*100)/100;
const requireUser=()=>{const id=auth.currentUser?.uid||"";if(!id)throw new Error("AUTH_REQUIRED");return id};
const safe=v=>String(v||"").replace(/[^a-zA-Z0-9_-]/g,"_");
const addDays=(value,days)=>{const d=new Date(String(value||new Date().toISOString().slice(0,10))+"T00:00:00");d.setDate(d.getDate()+Number(days||0));return d.toISOString().slice(0,10)};
const time=v=>v?.toMillis?.()||new Date(v||0).getTime()||Number(v||0);

export async function listPosSuppliers(tenantId){
 const snap=await getDocs(tenantCollection(tenantId,"suppliers"));
 return snap.docs.map(row).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"th"));
}
export async function savePosSupplier(tenantId,input={},editingId=""){
 const userId=requireUser(), id=String(editingId||input.id||("supplier-"+crypto.randomUUID())).trim(), name=String(input.name||"").trim();
 if(!name)throw new Error("SUPPLIER_NAME_REQUIRED");
 const payload={id,tenantId,shopId:tenantId,name,contact:String(input.contact||"").trim(),phone:String(input.phone||"").trim(),email:String(input.email||"").trim(),taxId:String(input.taxId||"").trim(),creditDays:Math.max(0,Number(input.creditDays||0)),address:String(input.address||"").trim(),note:String(input.note||"").trim(),active:input.active!==false,updatedBy:userId,updatedAt:Date.now(),updatedAtServer:serverTimestamp(),...(!editingId?{createdBy:userId,createdAt:Date.now(),createdAtServer:serverTimestamp()}: {})};
 await setDoc(tenantDoc(tenantId,"suppliers",id),payload,{merge:true}); return payload;
}
export async function deletePosSupplier(tenantId,id){if(!id)return;await deleteDoc(tenantDoc(tenantId,"suppliers",id))}
export async function listPosPurchases(tenantId){
 const snap=await getDocs(tenantCollection(tenantId,"purchases"));
 return snap.docs.map(row).sort((a,b)=>time(b.purchaseDate||b.createdAt)-time(a.purchaseDate||a.createdAt));
}
export async function receivePosPurchase({tenantId,supplierName,supplierId="",invoiceNo="",purchaseDate,note="",items=[]}){
 const userId=requireUser(),createdAt=nowIso(),purchaseId=safe("purchase-"+crypto.randomUUID()),date=String(purchaseDate||createdAt.slice(0,10));
 const suppliers=await listPosSuppliers(tenantId),supplier=suppliers.find(s=>s.id===supplierId)||suppliers.find(s=>String(s.name||"").toLowerCase()===String(supplierName||"").trim().toLowerCase())||null;
 const cleanItems=items.filter(i=>i.productId&&Number(i.qty)>0&&Number(i.unitCost)>=0).map(i=>({productId:String(i.productId),productName:String(i.productName||""),qty:Number(i.qty),unitCost:Number(i.unitCost)}));
 if(!String(supplierName||"").trim())throw new Error("SUPPLIER_REQUIRED"); if(!cleanItems.length)throw new Error("PURCHASE_ITEMS_REQUIRED");
 let committed=null;
 await runTransaction(db,async tx=>{
   const productRows=[];
   for(const item of cleanItems){const ref=tenantDoc(tenantId,"products",item.productId),snap=await tx.get(ref);if(!snap.exists())throw new Error("PRODUCT_NOT_FOUND");const p={id:snap.id,...snap.data()},oldStock=Number(p.stock||0),known=p.cost!==null&&p.cost!==undefined&&Number.isFinite(Number(p.cost)),oldCost=known?Number(p.cost):item.unitCost,newStock=oldStock+item.qty,newCost=newStock?((oldStock*oldCost)+(item.qty*item.unitCost))/newStock:item.unitCost;productRows.push({item,p,ref,oldStock,newStock,oldCost:known?oldCost:null,newCost:Number(newCost.toFixed(4))})}
   const total=round2(cleanItems.reduce((a,i)=>a+i.qty*i.unitCost,0)),dueDate=addDays(date,supplier?.creditDays||0);
   const purchase={id:purchaseId,tenantId,shopId:tenantId,supplierId:supplier?.id||supplierId||"",supplierName:String(supplierName).trim(),invoiceNo:String(invoiceNo||"").trim(),purchaseDate:date,dueDate,note:String(note||"").trim(),items:productRows.map(x=>({...x.item,oldStock:x.oldStock,newStock:x.newStock,oldCost:x.oldCost,newCost:x.newCost,lineTotal:round2(x.item.qty*x.item.unitCost)})),total,paidAmount:0,balance:total,paymentStatus:total>0?"unpaid":"paid",payments:[],createdBy:userId,updatedBy:userId,createdAt,updatedAt:Date.now(),createdAtServer:serverTimestamp(),updatedAtServer:serverTimestamp()};
   tx.set(tenantDoc(tenantId,"purchases",purchaseId),purchase);
   productRows.forEach(x=>{tx.update(x.ref,{stock:x.newStock,cost:x.newCost,tenantId,shopId:x.p.shopId||tenantId,updatedAt:Date.now(),updatedAtServer:serverTimestamp()});const movementId=crypto.randomUUID();tx.set(tenantDoc(tenantId,"stockMovements",movementId),{id:movementId,tenantId,shopId:tenantId,productId:x.p.id,productName:x.p.name,type:"purchase",direction:"in",qty:x.item.qty,before:x.oldStock,after:x.newStock,stockBefore:x.oldStock,stockAfter:x.newStock,note:"รับสินค้าเข้า "+purchaseId,referenceType:"purchase",referenceId:purchaseId,referenceNumber:invoiceNo||purchaseId,createdBy:userId,updatedBy:userId,createdAt,updatedAt:Date.now(),createdAtServer:serverTimestamp(),updatedAtServer:serverTimestamp()})});
   committed=purchase;
 }); return committed;
}
export async function recordPosPayablePayment(tenantId,purchaseId,input={}){
 const userId=requireUser(),ref=tenantDoc(tenantId,"purchases",purchaseId);let committed=null;
 await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error("PURCHASE_NOT_FOUND");const p=row(snap),amount=round2(input.amount);if(!(amount>0)||amount>Number(p.balance||0)+0.001)throw new Error("PAYMENT_AMOUNT_INVALID");const payment={id:"payment-"+crypto.randomUUID(),date:String(input.date||new Date().toISOString().slice(0,10)),amount,method:String(input.method||"cash"),reference:String(input.reference||""),note:String(input.note||""),createdBy:userId,createdAt:nowIso()},paidAmount=round2(Number(p.paidAmount||0)+amount),balance=round2(Math.max(0,Number(p.total||0)-paidAmount)),paymentStatus=balance<=0?"paid":paidAmount>0?"partial":"unpaid";const next={...p,paidAmount,balance,paymentStatus,payments:[...(p.payments||[]),payment],updatedBy:userId,updatedAt:Date.now(),updatedAtServer:serverTimestamp()};tx.set(ref,next,{merge:true});committed=next});return committed;
}
