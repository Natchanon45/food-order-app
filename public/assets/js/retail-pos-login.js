import {login,isLoggedIn} from "./retail-pos-auth.js?v=20260624-1";
import {MENU_GROUPS,getRoles,getUsers} from "./retail-pos-navigation.js?v=20260624-4";

const $=selector=>document.querySelector(selector);
const form=$("#loginForm"),username=$("#loginUsername"),password=$("#loginPassword"),error=$("#loginError"),submit=$("#loginSubmitBtn"),toggle=$("#togglePasswordBtn");

function firstAllowedPage(user){
  const role=getRoles().find(item=>item.id===user?.roleId);
  const permissions=new Set(role?.permissions||[]);
  return MENU_GROUPS.flatMap(group=>group.items).find(item=>permissions.has(item.key))?.href||"/pos/forbidden/";
}

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
  try{
    const result=await login(username.value,password.value);
    if(!result.ok){error.textContent=result.message;return}
    location.replace(firstAllowedPage(result.user));
  }catch(err){
    error.textContent=err?.message||"ไม่สามารถเข้าสู่ระบบได้";
  }finally{
    submit.disabled=false;
    submit.textContent="เข้าสู่ระบบ";
  }
});
