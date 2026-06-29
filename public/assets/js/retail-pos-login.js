import {login,isLoggedIn} from "./retail-pos-auth.js?v=20260629-035";

const ROLE_KEY="retail_pos_roles_v1";
const MENU_ITEMS=[
  {key:"pos.sale",href:"/pos/"},
  {key:"pos.sales",href:"/pos/sales/"},
  {key:"pos.returns",href:"/pos/returns/"},
  {key:"pos.shifts",href:"/pos/shifts/"},
  {key:"pos.products",href:"/pos/products/"},
  {key:"pos.stock_movements",href:"/pos/stock-movements/"},
  {key:"pos.stock_counts",href:"/pos/stock-counts/"},
  {key:"pos.purchases",href:"/pos/purchases/"},
  {key:"pos.payables",href:"/pos/payables/"},
  {key:"pos.suppliers",href:"/pos/suppliers/"},
  {key:"pos.customers",href:"/pos/customers/"},
  {key:"pos.settings",href:"/pos/settings/"},
  {key:"pos.backup",href:"/pos/backup/"},
  {key:"pos.users",href:"/pos/users/"}
];
const $=selector=>document.querySelector(selector);
const form=$("#loginForm"),username=$("#loginUsername"),password=$("#loginPassword"),error=$("#loginError"),submit=$("#loginSubmitBtn"),toggle=$("#togglePasswordBtn");

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function firstAllowedPage(user){
  const role=read(ROLE_KEY,[]).find(item=>item.id===user?.roleId);
  const permissions=new Set(role?.permissions||[]);
  return MENU_ITEMS.find(item=>permissions.has(item.key))?.href||"/pos/";
}
function resetButton(){submit.disabled=false;submit.textContent="เข้าสู่ระบบ"}

if(isLoggedIn())location.replace("/pos/");

toggle.addEventListener("click",()=>{
  const visible=password.type==="text";
  password.type=visible?"password":"text";
  toggle.textContent=visible?"แสดง":"ซ่อน";
});

form.addEventListener("submit",async event=>{
  event.preventDefault();
  error.textContent="";
  submit.disabled=true;
  submit.innerHTML='<span class="login-loading">กำลังเข้าสู่ระบบ</span>';
  const timeout=setTimeout(()=>{error.textContent="การเข้าสู่ระบบใช้เวลานานเกินไป กรุณาลองใหม่";resetButton()},10000);
  try{
    const result=await login(username.value,password.value);
    if(!result.ok){error.textContent=result.message;return}
    location.href=firstAllowedPage(result.user);
  }catch(err){
    error.textContent=err?.message||"ไม่สามารถเข้าสู่ระบบได้";
  }finally{
    clearTimeout(timeout);
    resetButton();
  }
});
