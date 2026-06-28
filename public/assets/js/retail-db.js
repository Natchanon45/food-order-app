import { db, isFirebaseConfigured, collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from './firebase-config.js';

const POS_TENANT_KEY='retail_pos_tenant_id';
const DEFAULT_TENANT_ID='13c9bb08-927b-4f9c-a2ef-b320ef7eed99';
const LEGACY_TENANT_IDS=new Set(['demo-store','main']);
const LOCAL_PREFIX='retail_db_cache_';

export function getTenantId(){
  const saved=localStorage.getItem(POS_TENANT_KEY);
  if(saved&&!LEGACY_TENANT_IDS.has(saved))return saved;
  localStorage.setItem(POS_TENANT_KEY,DEFAULT_TENANT_ID);
  return DEFAULT_TENANT_ID;
}

export function setTenantId(tenantId){
  const value=String(tenantId||'').trim()||DEFAULT_TENANT_ID;
  localStorage.setItem(POS_TENANT_KEY,value);
  return value;
}

function localKey(collectionName){return LOCAL_PREFIX+getTenantId()+'_'+collectionName}
function legacyLocalKeys(collectionName){return [...LEGACY_TENANT_IDS].map(id=>LOCAL_PREFIX+id+'_'+collectionName)}
function readLocal(collectionName){
  try{
    const current=JSON.parse(localStorage.getItem(localKey(collectionName)))||[];
    if(current.length)return current;
    for(const key of legacyLocalKeys(collectionName)){
      const legacy=JSON.parse(localStorage.getItem(key))||[];
      if(legacy.length){writeLocal(collectionName,legacy);return legacy}
    }
    return [];
  }catch{return []}
}
function writeLocal(collectionName,rows){localStorage.setItem(localKey(collectionName),JSON.stringify(rows||[]))}
function normalizeId(row){return String(row?.id||row?.code||crypto.randomUUID?.()||Date.now())}
function path(collectionName){return collection(db,'tenants',getTenantId(),collectionName)}
function ref(collectionName,id){return doc(db,'tenants',getTenantId(),collectionName,String(id))}
function withMeta(row){
  const {_documentId,_documentIds,...data}=row||{};
  return {...data,tenantId:getTenantId(),updatedAt:Date.now(),updatedAtServer:isFirebaseConfigured?serverTimestamp():null};
}
function fromSnapshot(snapshot){
  const data=snapshot.data();
  return {...data,id:String(data.id||snapshot.id),_documentId:snapshot.id};
}

export async function listRecords(collectionName,{sortBy='updatedAt',direction='desc'}={}){
  if(!isFirebaseConfigured||!db)return readLocal(collectionName);
  try{
    const q=query(path(collectionName),orderBy(sortBy,direction));
    const snap=await getDocs(q);
    const rows=snap.docs.map(fromSnapshot);
    writeLocal(collectionName,rows);
    return rows;
  }catch(error){
    console.warn('[retail-db] list fallback',collectionName,error);
    return readLocal(collectionName);
  }
}

export async function getRecord(collectionName,id){
  if(!id)return null;
  if(!isFirebaseConfigured||!db)return readLocal(collectionName).find(row=>String(row.id)===String(id))||null;
  try{
    const snap=await getDoc(ref(collectionName,id));
    return snap.exists()?fromSnapshot(snap):null;
  }catch(error){
    console.warn('[retail-db] get fallback',collectionName,id,error);
    return readLocal(collectionName).find(row=>String(row.id)===String(id))||null;
  }
}

export async function saveRecord(collectionName,row){
  const id=normalizeId(row);
  const data=withMeta({...row,id});
  const rows=readLocal(collectionName).filter(item=>String(item.id)!==String(id));
  rows.push({...data,updatedAtServer:null});
  writeLocal(collectionName,rows);
  if(isFirebaseConfigured&&db){
    try{await setDoc(ref(collectionName,id),data,{merge:true})}
    catch(error){console.warn('[retail-db] save firebase failed',collectionName,id,error)}
  }
  return {...data,updatedAtServer:null};
}

export async function saveRecords(collectionName,records){
  const saved=[];
  for(const record of records||[])saved.push(await saveRecord(collectionName,record));
  return saved;
}

export async function moveRecord(collectionName,previousId,row){
  const id=normalizeId(row);
  const oldId=String(previousId||'');
  const data=withMeta({...row,id});
  if(isFirebaseConfigured&&db){
    await setDoc(ref(collectionName,id),data,{merge:true});
    if(oldId&&oldId!==String(id))await deleteDoc(ref(collectionName,oldId));
  }
  const rows=readLocal(collectionName).filter(item=>![oldId,String(id)].includes(String(item._documentId||item.id)));
  rows.push({...data,updatedAtServer:null});
  writeLocal(collectionName,rows);
  return {...data,updatedAtServer:null};
}

export async function deleteRecord(collectionName,id){
  const rows=readLocal(collectionName).filter(item=>String(item._documentId||item.id)!==String(id));
  writeLocal(collectionName,rows);
  if(isFirebaseConfigured&&db){
    try{await deleteDoc(ref(collectionName,id))}
    catch(error){console.warn('[retail-db] delete firebase failed',collectionName,id,error)}
  }
  return true;
}

export function watchRecords(collectionName,callback,{sortBy='updatedAt',direction='desc'}={}){
  if(!isFirebaseConfigured||!db){
    callback(readLocal(collectionName));
    return()=>{};
  }
  try{
    const q=query(path(collectionName),orderBy(sortBy,direction));
    return onSnapshot(q,snap=>{
      const rows=snap.docs.map(fromSnapshot);
      writeLocal(collectionName,rows);
      callback(rows);
    },error=>{
      console.warn('[retail-db] watch fallback',collectionName,error);
      callback(readLocal(collectionName));
    });
  }catch(error){
    console.warn('[retail-db] watch failed',collectionName,error);
    callback(readLocal(collectionName));
    return()=>{};
  }
}

export const RetailCollections={
  products:'products',
  sales:'sales',
  returns:'returns',
  shifts:'shifts',
  stockMovements:'stockMovements',
  purchases:'purchases',
  stockCounts:'stockCounts',
  suppliers:'suppliers',
  customers:'customers',
  users:'users',
  roles:'roles',
  settings:'settings'
};

export async function migrateLocalArray(localStorageKey,collectionName){
  let rows=[];
  try{rows=JSON.parse(localStorage.getItem(localStorageKey))||[]}catch{rows=[]}
  if(!Array.isArray(rows)||!rows.length)return 0;
  await saveRecords(collectionName,rows);
  return rows.length;
}
