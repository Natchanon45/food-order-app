import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/firebase/client";
const tenantCollection=(tenantId,name)=>collection(db,"tenants",tenantId,name);
const tenantDoc=(tenantId,name,id)=>doc(db,"tenants",tenantId,name,String(id));
const row=s=>({_documentId:s.id,id:s.id,...s.data()});
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
export function watchPosSuppliers(tenantId,onRows,onError=()=>{}){
 return onSnapshot(tenantCollection(tenantId,"suppliers"),snap=>{
   onRows(snap.docs.map(row).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"th")));
 },onError);
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
export function watchPosPurchases(tenantId,onRows,onError=()=>{}){
 return onSnapshot(tenantCollection(tenantId,"purchases"),snap=>{
   onRows(snap.docs.map(row).sort((a,b)=>time(b.purchaseDate||b.createdAt)-time(a.purchaseDate||a.createdAt)));
 },onError);
}
export async function receivePosPurchase({tenantId,purchaseId="",supplierName,supplierId="",invoiceNo="",purchaseDate,note="",items=[]}){
 const userId=requireUser(),createdAt=nowIso(),id=safe(String(purchaseId||`PO-${Date.now()}`)),date=String(purchaseDate||"").trim();
 const normalizedSupplierName=String(supplierName||"").trim();
 if(!normalizedSupplierName||!date)throw new Error("PURCHASE_REQUIRED_FIELDS");
 const suppliers=await listPosSuppliers(tenantId),supplier=suppliers.find(s=>s.id===supplierId)||suppliers.find(s=>String(s.name||"").trim().toLowerCase()===normalizedSupplierName.toLowerCase())||null;
 const cleanItems=items.filter(i=>i.productId&&Number(i.qty)>0&&Number(i.unitCost)>=0).map(i=>({productId:String(i.productId),documentId:String(i.documentId||i._documentId||i.productId),productName:String(i.productName||""),qty:Number(i.qty),unitCost:Number(i.unitCost)}));
 if(!cleanItems.length)throw new Error("PURCHASE_ITEMS_REQUIRED");
 if(new Set(cleanItems.map(item=>item.productId)).size!==cleanItems.length)throw new Error("PURCHASE_DUPLICATE_PRODUCT");
 let committed=null;
 await runTransaction(db,async tx=>{
   const refs=cleanItems.map(item=>({item,ref:tenantDoc(tenantId,"products",item.documentId||item.productId)}));
   const snapshots=await Promise.all(refs.map(entry=>tx.get(entry.ref)));
   const productRows=refs.map((entry,index)=>{
     const snap=snapshots[index];
     if(!snap.exists())throw new Error("PRODUCT_NOT_FOUND");
     const p={_documentId:snap.id,id:snap.id,...snap.data()};
     const oldStock=Number(p.stock||0),known=p.cost!==null&&p.cost!==undefined&&Number.isFinite(Number(p.cost)),oldCost=known?Number(p.cost):entry.item.unitCost,newStock=oldStock+entry.item.qty,newCost=newStock?((oldStock*oldCost)+(entry.item.qty*entry.item.unitCost))/newStock:entry.item.unitCost;
     return{item:entry.item,p,ref:entry.ref,oldStock,newStock,oldCost:known?oldCost:null,newCost:Number(newCost.toFixed(4))};
   });
   const creditDays=Math.max(0,Number(supplier?.creditDays||0)),total=round2(cleanItems.reduce((a,i)=>a+i.qty*i.unitCost,0)),dueDate=addDays(date,creditDays);
   const purchase={id,tenantId,shopId:tenantId,supplierId:supplier?.id||supplierId||"",supplierName:normalizedSupplierName,invoiceNo:String(invoiceNo||"").trim(),purchaseDate:date,creditDays,dueDate,paymentStatus:total>0?"unpaid":"paid",paidAmount:0,balance:total,payments:[],note:String(note||"").trim(),createdAt,total,items:productRows.map(x=>({productId:x.item.productId,productName:x.item.productName||x.p.name||"",qty:x.item.qty,unitCost:x.item.unitCost,oldStock:x.oldStock,newStock:x.newStock,oldCost:x.oldCost,newCost:x.newCost,lineTotal:round2(x.item.qty*x.item.unitCost)})),createdBy:userId,updatedBy:userId,updatedAt:Date.now(),createdAtServer:serverTimestamp(),updatedAtServer:serverTimestamp()};
   tx.set(tenantDoc(tenantId,"purchases",id),purchase);
   productRows.forEach(x=>{
     tx.update(x.ref,{stock:x.newStock,cost:x.newCost,tenantId,shopId:x.p.shopId||tenantId,updatedAt:Date.now(),updatedAtServer:serverTimestamp()});
     const movementId=`movement-${crypto.randomUUID()}`;
     tx.set(tenantDoc(tenantId,"stockMovements",movementId),{id:movementId,tenantId,shopId:tenantId,productId:x.item.productId,productName:x.item.productName||x.p.name||"",type:"purchase",direction:"in",qty:x.item.qty,before:x.oldStock,after:x.newStock,stockBefore:x.oldStock,stockAfter:x.newStock,note:"รับสินค้าเข้า "+id,referenceType:"purchase",referenceId:id,referenceNumber:id,createdBy:userId,updatedBy:userId,createdAt,updatedAt:Date.now(),createdAtServer:serverTimestamp(),updatedAtServer:serverTimestamp()});
   });
   committed=purchase;
 });
 return committed;
}
export async function recordPosPayablePayment(tenantId,purchaseId,input={}){
 const userId=requireUser(),ref=tenantDoc(tenantId,"purchases",purchaseId);let committed=null;
 await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error("PURCHASE_NOT_FOUND");const p=row(snap),amount=round2(input.amount);if(!(amount>0)||amount>Number(p.balance||0)+0.001)throw new Error("PAYMENT_AMOUNT_INVALID");const payment={id:"payment-"+crypto.randomUUID(),date:String(input.date||new Date().toISOString().slice(0,10)),amount,method:String(input.method||"cash"),reference:String(input.reference||""),note:String(input.note||""),createdBy:userId,createdAt:nowIso()},paidAmount=round2(Number(p.paidAmount||0)+amount),balance=round2(Math.max(0,Number(p.total||0)-paidAmount)),paymentStatus=balance<=0?"paid":paidAmount>0?"partial":"unpaid";const next={...p,paidAmount,balance,paymentStatus,payments:[...(p.payments||[]),payment],updatedBy:userId,updatedAt:Date.now(),updatedAtServer:serverTimestamp()};tx.set(ref,next,{merge:true});committed=next});return committed;
}
