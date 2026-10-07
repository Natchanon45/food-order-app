import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/firebase/client";

const DEFAULT_POS_ROLES = Object.freeze([
  { id: "admin", name: "ผู้ดูแล POS", permissions: ["*"], locked: true },
  { id: "manager", name: "ผู้จัดการ", permissions: ["pos.sale","pos.sales","pos.tax_invoices","pos.returns","pos.shifts","pos.products","pos.stock_movements","pos.stock_counts","pos.purchases","pos.payables","pos.suppliers","pos.customers","pos.settings"], locked: true },
  { id: "cashier", name: "แคชเชียร์", permissions: ["pos.sale","pos.sales","pos.returns","pos.customers"], locked: true },
  { id: "stock", name: "สต็อก", permissions: ["pos.products","pos.stock_movements","pos.stock_counts","pos.purchases","pos.suppliers"], locked: true },
  { id: "kitchen", name: "ครัว", permissions: [], locked: true },
]);
const roleRef=tenantId=>doc(db,"tenants",tenantId,"settings","pos-roles");
const legacyRoleRef=tenantId=>doc(db,"tenants",tenantId,"settings","roles");

export async function loadPosRoleSettings(tenantId){
  const snap=await getDoc(roleRef(tenantId));
  let roles=Array.isArray(snap.data()?.roles)?snap.data().roles:[];
  if(!roles.length){
    const legacySnap=await getDoc(legacyRoleRef(tenantId));
    roles=Array.isArray(legacySnap.data()?.roles)?legacySnap.data().roles:[];
  }
  return roles.length?roles.map(r=>({...r,id:String(r.id),name:String(r.name||r.id),permissions:Array.isArray(r.permissions)?r.permissions:[],locked:r.locked===true})):DEFAULT_POS_ROLES.map(r=>({...r,permissions:[...r.permissions]}));
}
export async function savePosRoleSettings(tenantId,roles=[]){
  const normalized=roles.map(r=>({id:String(r.id),name:String(r.name||r.id),permissions:[...new Set(r.permissions||[])],locked:r.locked===true}));
  await setDoc(roleRef(tenantId),{id:"pos-roles",tenantId,shopId:tenantId,roles:normalized,updatedBy:auth.currentUser?.uid||"",updatedAt:Date.now(),updatedAtServer:serverTimestamp()},{merge:true});
  try{localStorage.setItem("retail_pos_roles_v1",JSON.stringify(normalized))}catch{}
  return normalized;
}
export async function exportRetailPosBackup(){
  const response=await httpsCallable(functions,"exportRetailPosBackup")({});
  return response?.data||{};
}
export async function restoreRetailPosBackup(backup){
  const response=await httpsCallable(functions,"restoreRetailPosBackup")({backup,confirmation:"REPLACE_TENANT_DATA"});
  return response?.data||{};
}
