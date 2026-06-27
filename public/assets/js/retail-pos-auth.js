import { getTenantId, setTenantId } from './retail-db.js';

const ROLE_KEY="retail_pos_roles_v1";
const USER_KEY="retail_pos_users_v1";
const SESSION_KEY="retail_pos_session_v1";
const LEGACY_CURRENT_USER_KEY="retail_pos_current_user_v1";
const DEFAULT_TENANT_ID="main";

const DEFAULT_OWNER={
  id:"owner",
  tenantId:DEFAULT_TENANT_ID,
  name:"เจ้าของร้าน",
  username:"owner",
  roleId:"owner",
  active:true,
  locked:true,
  passwordHash:"",
  passwordSalt:"",
  mustChangePassword:true
};

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function randomSalt(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,"0")).join("")}
async function sha256(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("")}

function normalizeTenantId(value){return String(value||DEFAULT_TENANT_ID).trim()||DEFAULT_TENANT_ID}
function normalizeUser(user){
  const tenantId=normalizeTenantId(user?.tenantId||DEFAULT_TENANT_ID);
  return {...user,tenantId};
}

export function ensureAuthUsers(){
  const users=read(USER_KEY,[]);
  if(!users.length){write(USER_KEY,[DEFAULT_OWNER]);return [DEFAULT_OWNER]}
  const hasOwner=users.some(user=>user.id==="owner");
  const base=hasOwner?users:[DEFAULT_OWNER,...users];
  const normalized=base.map(user=>user.id==="owner"?normalizeUser({...DEFAULT_OWNER,...user,tenantId:user.tenantId||DEFAULT_TENANT_ID}):normalizeUser(user));
  if(JSON.stringify(users)!==JSON.stringify(normalized))write(USER_KEY,normalized);
  return normalized;
}

export function getAuthUsers(){return ensureAuthUsers()}
export function getSession(){return read(SESSION_KEY,null)}
export function getSessionUser(){
  const session=getSession();
  if(!session?.userId)return null;
  return getAuthUsers().find(user=>user.id===session.userId&&user.active!==false&&normalizeTenantId(user.tenantId)===normalizeTenantId(session.tenantId))||null;
}
export function getSessionTenantId(){return normalizeTenantId(getSession()?.tenantId||getTenantId())}
export function isLoggedIn(){return Boolean(getSessionUser())}
export function logout(){localStorage.removeItem(SESSION_KEY);localStorage.removeItem(LEGACY_CURRENT_USER_KEY)}

export async function createPasswordRecord(password){
  const salt=randomSalt();
  return{passwordSalt:salt,passwordHash:await sha256(`${salt}:${password}`),mustChangePassword:false};
}

export async function verifyPassword(user,password){
  if(!user)return false;
  if(!user.passwordHash){
    if(user.id==="owner"&&password==="1234"){
      const record=await createPasswordRecord(password);
      const users=getAuthUsers().map(item=>item.id===user.id?{...item,...record,mustChangePassword:true}:item);
      write(USER_KEY,users);
      Object.assign(user,record,{mustChangePassword:true});
      return true;
    }
    return false;
  }
  const hash=await sha256(`${user.passwordSalt||""}:${password}`);
  return hash===user.passwordHash;
}

export async function login(username,password,{tenantId}={}){
  const normalized=String(username||"").trim().toLowerCase();
  const users=getAuthUsers();
  const found=users.find(item=>String(item.username||"").trim().toLowerCase()===normalized&&item.active!==false);
  if(!found)return{ok:false,message:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"};
  const resolvedTenantId=normalizeTenantId(tenantId||found.tenantId||DEFAULT_TENANT_ID);
  if(normalizeTenantId(found.tenantId)!==resolvedTenantId)return{ok:false,message:"บัญชีนี้ไม่อยู่ในร้านที่เลือก"};
  if(!await verifyPassword(found,password))return{ok:false,message:found.passwordHash?"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง":"บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน กรุณาติดต่อเจ้าของร้าน"};
  setTenantId(resolvedTenantId);
  write(SESSION_KEY,{tenantId:resolvedTenantId,userId:found.id,roleId:found.roleId,loggedInAt:new Date().toISOString()});
  write(LEGACY_CURRENT_USER_KEY,found.id);
  return{ok:true,user:{...found,tenantId:resolvedTenantId}};
}

export function sessionRole(){
  const user=getSessionUser();
  return read(ROLE_KEY,[]).find(role=>role.id===user?.roleId)||null;
}
