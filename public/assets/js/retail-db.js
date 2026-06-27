import { db, isFirebaseConfigured, collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from './firebase-config.js';

const POS_TENANT_KEY='retail_pos_tenant_id';
const DEFAULT_TENANT_ID='demo-store';
const LOCAL_PREFIX='retail_db_cache_';

export function getTenantId(){
  const saved=localStorage.getItem(POS_TENANT_KEY);
  if(saved)return saved;
  localStorage.setItem(POS_TENANT_KEY,DEFAULT_TENANT_ID);
  return DEFAULT_TENANT_ID;
}

export function setTenantId(tenantId){
  const value=String(tenantId||'').trim()||DEFAULT_TENANT_ID;
  localStorage.setItem(POS_TENANT_KEY,value);
  return value;
}

function localKey(collectionName){return LOCAL_PREFIX+getTenantId()+'_'+collectionName}
function readLocal(collectionName){try{return JSON.parse(localStorage.getItem(localKey(collectionName)))||[]}catch{return []}}
function writeLocal(collectionName,rows){localStorage.setItem(localKey(collectionName),JSON.stringify(rows||[]))}
function normalizeId(row){return String(row?.id||row?.code||crypto.randomUUID?.()||Date.now())}
function path(collectionName){return collection(db,'retailTenants',getTenantId(),collectionName)}
function ref(collectionName,id){return doc(db,'retailTenants',getTenantId(),collectionName,String(id))}
function withMeta(row){return {...row,updatedAt:Date.now(),updatedAtServer:isFirebaseConfigured?serverTimestamp():null}}

export async function listRecords(collectionName,{sortBy='updatedAt',direction='desc'}={}){
  if(!isFirebaseConfigured||!db)return readLocal(collectionName);
  try{
    const q=query(path(collectionName),orderBy(sortBy,direction));
    const snap=await getDocs(q);
    const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
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
    return snap.exists()?{id:snap.id,...snap.data()}:null;
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

export async function deleteRecord(collectionName,id){
  const rows=readLocal(collectionName).filter(item=>String(item.id)!==String(id));
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
      const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
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
  purchases:'purchases',
  stockCounts:'stockCounts',
  suppliers:'suppliers',
  customers:'customers',
  users:'users',
  settings:'settings'
};

export async function migrateLocalArray(localStorageKey,collectionName){
  let rows=[];
  try{rows=JSON.parse(localStorage.getItem(localStorageKey))||[]}catch{rows=[]}
  if(!Array.isArray(rows)||!rows.length)return 0;
  await saveRecords(collectionName,rows);
  return rows.length;
}
