const ROLE_KEY="retail_pos_roles_v1";
const USER_KEY="retail_pos_users_v1";
const SESSION_KEY="retail_pos_session_v1";
const LEGACY_CURRENT_USER_KEY="retail_pos_current_user_v1";

const DEFAULT_OWNER={id:"owner",name:"เจ้าของร้าน",username:"owner",roleId:"owner",active:true,locked:true,passwordHash:"",passwordSalt:"",mustChangePassword:true};

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function write(key,value){localStorage.setItem(key,JSON.stringify(value))}
function randomSalt(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,"0")).join("")}
async function sha256(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("")}

export function ensureAuthUsers(){
  const users=read(USER_KEY,[]);
  if(!users.length){write(USER_KEY,[DEFAULT_OWNER]);return [DEFAULT_OWNER]}
  const normalized=users.map(user=>user.id==="owner"?{...DEFAULT_OWNER,...user}:user);
  if(JSON.stringify(users)!==JSON.stringify(normalized))write(USER_KEY,normalized);
  return normalized;
}

export function getAuthUsers(){return ensureAuthUsers()}
export function getSession(){return read(SESSION_KEY,null)}
export function getSessionUser(){
  const session=getSession();
  if(!session?.userId)return null;
  return getAuthUsers().find(user=>user.id===session.userId&&user.active!==false)||null;
}
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

export async function login(username,password){
  const normalized=String(username||"").trim().toLowerCase();
  const users=getAuthUsers();
  const user=users.find(item=>String(item.username||"").trim().toLowerCase()===normalized);
  if(!user||user.active===false)return{ok:false,message:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"};
  if(!await verifyPassword(user,password))return{ok:false,message:user.passwordHash?"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง":"บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน กรุณาติดต่อเจ้าของร้าน"};
  write(SESSION_KEY,{userId:user.id,loggedInAt:new Date().toISOString()});
  write(LEGACY_CURRENT_USER_KEY,user.id);
  return{ok:true,user};
}

export function sessionRole(){
  const user=getSessionUser();
  return read(ROLE_KEY,[]).find(role=>role.id===user?.roleId)||null;
}
