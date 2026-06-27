import { getTenantId, setTenantId } from './retail-db.js';
import { auth, db, signInWithEmailAndPassword, signOut, collection, doc, getDoc, getDocs, query, where } from './firebase-config.js';

const ROLE_KEY="retail_pos_roles_v1";
const SESSION_KEY="retail_pos_session_v1";
const LEGACY_CURRENT_USER_KEY="retail_pos_current_user_v1";
const DEFAULT_TENANT_ID="13c9bb08-927b-4f9c-a2ef-b320ef7eed99";

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function normalizeTenantId(value){return String(value||DEFAULT_TENANT_ID).trim()||DEFAULT_TENANT_ID}
function normalizeRole(value){return String(value||"owner").trim()||"owner"}
function normalizeUser(user){
  const tenantId=normalizeTenantId(user?.tenantId||user?.shopId||DEFAULT_TENANT_ID);
  return {
    id:user?.id||user?.uid||auth?.currentUser?.uid||"",
    uid:user?.uid||user?.id||auth?.currentUser?.uid||"",
    tenantId,
    name:user?.name||user?.displayName||user?.ownerDisplayName||auth?.currentUser?.displayName||"ผู้ใช้งาน",
    email:user?.email||auth?.currentUser?.email||"",
    username:user?.username||user?.email||auth?.currentUser?.email||"",
    roleId:normalizeRole(user?.roleId||user?.role),
    role:normalizeRole(user?.role||user?.roleId),
    active:user?.active!==false
  };
}

async function findTenantByOwnerUid(uid){
  if(!db||!uid)return null;
  try{
    const snap=await getDocs(query(collection(db,'tenants'),where('ownerUid','==',uid)));
    if(snap.empty)return null;
    const first=snap.docs[0];
    return {id:first.id,...first.data()};
  }catch(error){
    console.warn('[retail-auth] tenant owner lookup failed',error);
    return null;
  }
}

async function getFirebaseProfile(firebaseUser){
  const uid=firebaseUser?.uid;
  if(!uid||!db)return null;
  try{
    const userSnap=await getDoc(doc(db,'users',uid));
    if(userSnap.exists())return normalizeUser({id:userSnap.id,uid,...userSnap.data()});
  }catch(error){
    console.warn('[retail-auth] users profile lookup failed',error);
  }
  const tenant=await findTenantByOwnerUid(uid);
  if(tenant){
    return normalizeUser({
      id:uid,
      uid,
      tenantId:tenant.id,
      name:tenant.ownerDisplayName||firebaseUser.displayName||tenant.name,
      email:firebaseUser.email||tenant.ownerEmail,
      username:firebaseUser.email||tenant.ownerEmail,
      role:'owner',
      roleId:'owner',
      active:tenant.active!==false
    });
  }
  return normalizeUser({id:uid,uid,email:firebaseUser.email,role:'owner',roleId:'owner',tenantId:getTenantId()});
}

export function getSession(){return read(SESSION_KEY,null)}
export function getSessionUser(){
  const session=getSession();
  if(!session?.userId)return null;
  return normalizeUser({
    id:session.userId,
    uid:session.uid||session.userId,
    tenantId:session.tenantId,
    name:session.name,
    email:session.email,
    username:session.email,
    role:session.role,
    roleId:session.roleId,
    active:true
  });
}
export function getSessionTenantId(){return normalizeTenantId(getSession()?.tenantId||getTenantId())}
export function isLoggedIn(){return Boolean(getSessionUser())}
export async function logout(){
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LEGACY_CURRENT_USER_KEY);
  try{if(auth)await signOut(auth)}catch(error){console.warn('[retail-auth] sign out failed',error)}
}

export async function login(email,password){
  const normalizedEmail=String(email||"").trim().toLowerCase();
  if(!auth||!db)return{ok:false,message:"Firebase ยังไม่พร้อมใช้งาน"};
  if(!normalizedEmail.includes('@'))return{ok:false,message:"กรุณาเข้าสู่ระบบด้วยอีเมล"};
  try{
    const credential=await signInWithEmailAndPassword(auth,normalizedEmail,password);
    const profile=await getFirebaseProfile(credential.user);
    if(!profile||profile.active===false)return{ok:false,message:"บัญชีนี้ถูกปิดใช้งานหรือไม่พบข้อมูลร้าน"};
    const tenantId=normalizeTenantId(profile.tenantId);
    setTenantId(tenantId);
    write(SESSION_KEY,{
      tenantId,
      userId:profile.id||credential.user.uid,
      uid:credential.user.uid,
      email:credential.user.email||normalizedEmail,
      name:profile.name,
      role:profile.role,
      roleId:profile.roleId,
      loggedInAt:new Date().toISOString()
    });
    write(LEGACY_CURRENT_USER_KEY,profile.id||credential.user.uid);
    return{ok:true,user:profile};
  }catch(error){
    const code=String(error?.code||'');
    if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found'))return{ok:false,message:"อีเมลหรือรหัสผ่านไม่ถูกต้อง"};
    return{ok:false,message:error?.message||"ไม่สามารถเข้าสู่ระบบได้"};
  }
}

export function sessionRole(){
  const user=getSessionUser();
  return read(ROLE_KEY,[]).find(role=>role.id===user?.roleId)||{id:user?.roleId||'owner',name:user?.role||'owner',permissions:[]};
}
