import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/client";

const clean=value=>String(value||"").trim();
const lower=value=>clean(value).toLowerCase();

function isRetailPosStaff(user={}){
  const scope=lower(user.businessScope||user.business_scope);
  const unit=lower(user.businessUnit||user.business_unit);
  const units=[...(Array.isArray(user.businessUnits)?user.businessUnits:[])].map(lower);
  return scope==="retail_pos"||scope==="both"||unit==="retail_pos"||unit==="all"||unit==="both"
    ||units.includes("retail_pos")||lower(user.staffScope)==="pos"||lower(user.source)==="pos"
    ||lower(user.userType)==="retail_pos_staff";
}

function normalize(user={}){
  const role=clean(user.roleId||user.role||"cashier");
  const scope=lower(user.businessScope||user.business_scope)||"retail_pos";
  return {
    ...user,
    uid:clean(user.uid||user.id),
    id:clean(user.uid||user.id),
    displayName:clean(user.displayName||user.name||user.email),
    email:lower(user.email||user.username),
    role,
    roleId:role,
    businessScope:scope==="both"?"both":"retail_pos",
    active:user.active!==false,
  };
}

export async function listRetailPosStaff(tenantId){
  const snap=await getDocs(collection(db,"tenants",tenantId,"memberships"));
  return snap.docs
    .map(doc=>normalize({uid:doc.id,...doc.data()}))
    .filter(user=>user.uid&&user.email&&isRetailPosStaff(user)&&!["owner","super_admin"].includes(lower(user.role)))
    .sort((a,b)=>String(a.displayName||a.email).localeCompare(String(b.displayName||b.email),"th"));
}

export async function upsertRetailPosStaff(payload={}){
  const response=await httpsCallable(functions,"upsertRetailPosStaff")({
    uid:clean(payload.uid)||undefined,
    email:lower(payload.email),
    displayName:clean(payload.displayName),
    password:String(payload.password||"")||undefined,
    roleId:clean(payload.roleId||payload.role),
    active:payload.active!==false,
    businessScope:payload.businessScope==="both"?"both":"retail_pos",
  });
  return response?.data||{};
}
