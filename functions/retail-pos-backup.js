const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const COLLECTIONS = [
  "products","categories","sales","returns","customers","loyaltyLedger",
  "purchases","suppliers","stockCounts","stockMovements","shifts",
  "taxInvoices","heldBills","settings"
];
const MANAGER_ROLES = new Set(["owner","super_admin"]);

async function context(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated","Authentication required");
  const db=getFirestore(), snap=await db.collection("users").doc(auth.uid).get(), user=snap.data()||{};
  if(user.active===false || !MANAGER_ROLES.has(String(user.role||""))) throw new HttpsError("permission-denied","Owner permission required");
  const tenantId=String(user.tenantId||"").trim();
  if(!tenantId) throw new HttpsError("failed-precondition","Tenant missing");
  return {db,user,tenantId};
}
function jsonValue(value){
  if(value instanceof Timestamp) return value.toDate().toISOString();
  if(Array.isArray(value)) return value.map(jsonValue);
  if(value && typeof value==="object") return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,jsonValue(v)]));
  return value;
}
async function readBackup(db,tenantId){
  const tenant=db.collection("tenants").doc(tenantId), data={};
  for(const name of COLLECTIONS){
    const snap=await tenant.collection(name).get();
    data[name]=snap.docs.map(doc=>({id:doc.id,...jsonValue(doc.data())}));
  }
  return data;
}
async function clearCollection(ref){
  while(true){
    const snap=await ref.limit(400).get();
    if(snap.empty) return;
    const batch=getFirestore().batch();
    snap.docs.forEach(doc=>batch.delete(doc.ref));
    await batch.commit();
  }
}
exports.exportRetailPosBackup = onCall({region:"asia-southeast1",timeoutSeconds:120,memory:"512MiB"},async request=>{
  const {db,tenantId}=await context(request.auth), data=await readBackup(db,tenantId);
  return {app:"retail-pos-react",version:1,tenantId,exportedAt:new Date().toISOString(),collections:data};
});
exports.restoreRetailPosBackup = onCall({region:"asia-southeast1",timeoutSeconds:540,memory:"1GiB"},async request=>{
  const {db,tenantId}=await context(request.auth), backup=request.data?.backup||{};
  if(request.data?.confirmation!=="REPLACE_TENANT_DATA") throw new HttpsError("failed-precondition","Restore confirmation required");
  if(backup.app!=="retail-pos-react" || Number(backup.version)!==1) throw new HttpsError("invalid-argument","Unsupported backup");
  if(String(backup.tenantId||"")!==tenantId) throw new HttpsError("permission-denied","Backup belongs to another tenant");
  const tenant=db.collection("tenants").doc(tenantId), source=backup.collections||{};
  for(const name of COLLECTIONS){
    await clearCollection(tenant.collection(name));
    const rows=Array.isArray(source[name])?source[name]:[];
    for(let offset=0;offset<rows.length;offset+=350){
      const batch=db.batch();
      rows.slice(offset,offset+350).forEach(row=>{
        const id=String(row.id||"").trim(); if(!id)return;
        const value={...row,id,tenantId,shopId:String(row.shopId||tenantId)};
        batch.set(tenant.collection(name).doc(id),value);
      });
      await batch.commit();
    }
  }
  return {ok:true,restoredAt:new Date().toISOString()};
});
