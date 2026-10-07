import { useEffect, useMemo, useRef, useState } from "react";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { listRetailPosStaff, upsertRetailPosStaff } from "@/data/retailPosStaffData";
import { loadPosRoleSettings, savePosRoleSettings } from "@/data/retailPosSystemData";
import { POS_MENU_GROUPS } from "@/components/PosNavigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PosNavigation } from "@/components/PosNavigation";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { useI18n } from "@/i18n/I18nProvider";

const ACTION_GROUPS=[
  {id:"sale_actions",label:"การขายหน้าร้าน",items:[
    {key:"pos.sale.checkout",label:"ยืนยันการขาย"},{key:"pos.sale.discount",label:"ให้ส่วนลด"},
    {key:"pos.sale.hold",label:"พักและเรียกบิล"},{key:"pos.sale.clear",label:"ล้างบิลปัจจุบัน"},
    {key:"pos.sale.seed",label:"โหลดสินค้าตัวอย่าง"}]},
  {id:"sales_history_actions",label:"ประวัติการขาย",items:[
    {key:"pos.sales.view_bill",label:"ดูรายละเอียดบิล"},{key:"pos.sales.print_bill",label:"พิมพ์ใบเสร็จย้อนหลัง"},
    {key:"pos.sales.export",label:"ส่งออกข้อมูลการขาย CSV"}]},
  {id:"return_actions",label:"คืนสินค้า",items:[
    {key:"pos.returns.create",label:"ยืนยันคืนสินค้าและคืนเงิน"},{key:"pos.returns.print",label:"ดูและพิมพ์ใบรับคืน"}]},
  {id:"shift_actions",label:"กะพนักงาน",items:[
    {key:"pos.shifts.open",label:"เปิดกะ"},{key:"pos.shifts.close",label:"ปิดกะ"},
    {key:"pos.shifts.view_amount",label:"ดูยอดเงินและผลต่าง"},{key:"pos.shifts.view_history",label:"ดูประวัติกะ"},
    {key:"pos.shifts.clear_history",label:"ล้างประวัติกะ"}]},
  {id:"product_actions",label:"การจัดการสินค้าและสต็อก",items:[
    {key:"pos.products.create",label:"เพิ่มสินค้า"},{key:"pos.products.edit",label:"แก้ไขสินค้า"},
    {key:"pos.products.delete",label:"ลบสินค้า"},{key:"pos.products.adjust_stock",label:"ปรับสต็อก"},
    {key:"pos.products.view_cost",label:"ดูราคาทุน"},{key:"pos.products.clear_history",label:"ล้างประวัติสต็อก"}]},
  {id:"stock_count_actions",label:"ตรวจนับสต็อก",items:[
    {key:"pos.stock_counts.perform",label:"กรอกและยืนยันตรวจนับ"},{key:"pos.stock_counts.view_value",label:"ดูต้นทุนและมูลค่าผลต่าง"},
    {key:"pos.stock_counts.view_history",label:"ดูประวัติการตรวจนับ"}]},
  {id:"stock_movement_actions",label:"ความเคลื่อนไหวสต็อก",items:[
    {key:"pos.stock_movements.view_quantity",label:"ดูยอดก่อน–หลังและจำนวนเปลี่ยนแปลง"},
    {key:"pos.stock_movements.export",label:"ส่งออกความเคลื่อนไหว CSV"}]},
  {id:"purchase_actions",label:"รับสินค้าเข้า",items:[
    {key:"pos.purchases.create",label:"บันทึกรับสินค้าเข้า"},{key:"pos.purchases.view_cost",label:"ดูราคาทุนและยอดซื้อ"}]},
  {id:"payable_actions",label:"เจ้าหนี้",items:[
    {key:"pos.payables.pay",label:"บันทึกชำระเจ้าหนี้"},{key:"pos.payables.view_amount",label:"ดูยอดเจ้าหนี้"}]},
  {id:"supplier_actions",label:"ผู้จำหน่าย",items:[
    {key:"pos.suppliers.create",label:"เพิ่มผู้จำหน่าย"},{key:"pos.suppliers.edit",label:"แก้ไขผู้จำหน่าย"},
    {key:"pos.suppliers.delete",label:"ลบผู้จำหน่าย"},{key:"pos.suppliers.view_purchase",label:"ดูยอดซื้อสะสม"}]},
  {id:"customer_actions",label:"ลูกค้าและสมาชิก",items:[
    {key:"pos.customers.create",label:"เพิ่มลูกค้า"},{key:"pos.customers.edit",label:"แก้ไขลูกค้า"},
    {key:"pos.customers.delete",label:"ลบลูกค้า"},{key:"pos.customers.view_history",label:"ดูประวัติการซื้อ"},
    {key:"pos.customers.view_points",label:"ดูคะแนนและประวัติแต้ม"},{key:"pos.customers.view_sales",label:"ดูยอดซื้อสะสม"}]},
  {id:"settings_actions",label:"ตั้งค่าร้าน",items:[
    {key:"pos.settings.edit_store",label:"แก้ไขข้อมูลร้านและใบเสร็จ"},{key:"pos.settings.edit_loyalty",label:"แก้ไขระบบคะแนนสมาชิก"},
    {key:"pos.settings.reset",label:"คืนค่าการตั้งค่าเริ่มต้น"}]},
  {id:"backup_actions",label:"สำรองและกู้คืน",items:[
    {key:"pos.backup.export",label:"ดาวน์โหลดไฟล์สำรอง"},{key:"pos.backup.restore",label:"กู้คืนและเขียนทับข้อมูล"}]},
  {id:"user_actions",label:"ผู้ใช้และสิทธิ์",items:[
    {key:"pos.users.manage_roles",label:"เพิ่ม แก้ไข และลบบทบาท"},{key:"pos.users.manage_users",label:"เพิ่มและแก้ไขบัญชีผู้ใช้"}]},
];

const EMPTY_USER={uid:"",displayName:"",email:"",password:"",confirmPassword:"",role:"cashier",businessScope:"retail_pos",active:true};
const permissionKey=key=>`pos_users.permission_items.${String(key||"").replaceAll(".","_")}`;
const roleId=()=>`role-${globalThis.crypto?.randomUUID?.()||Date.now()}`;

export function PosUsersPage(){
  const authState=useAuth(),tenantState=useTenant(),{profile}=authState,{tenant}=tenantState,{t}=useI18n();
  const stylesReady=useParityPage({title:t("pos_users.meta_title"),bodyClass:"pos-users-page pos-users-visual-page",disabledGlobalStyles:["app.css","icons.css","shared-responsive.css"],styles:["retail-pos-font-local.css","pos-locale-switcher-placement.css","retail-pos.css","retail-pos-navigation.css","retail-pos-users-layout.css","retail-pos-users-mobile.css","retail-pos-users-visual-dashboard.css"]});
  const dialogRef=useRef(null);
  const [users,setUsers]=useState([]),[roles,setRoles]=useState([]),[selectedRole,setSelectedRole]=useState("cashier");
  const [ready,setReady]=useState(false),[form,setForm]=useState(EMPTY_USER),[busy,setBusy]=useState(""),[error,setError]=useState("");

  const tr=(key,fallback,vars)=>{
    const value=t(key,vars);
    return value&&value!==key?value:fallback;
  };
  const menuGroups=useMemo(()=>POS_MENU_GROUPS.map(group=>({...group,label:tr(`pos_users.groups.${group.id}`,group.label),
    items:group.items.map(item=>({...item,label:tr(permissionKey(item.key),item.label)}))})),[t]);
  const actionGroups=useMemo(()=>ACTION_GROUPS.map(group=>({...group,label:tr(`pos_users.groups.${group.id}`,group.label),
    items:group.items.map(item=>({...item,label:tr(permissionKey(item.key),item.label)}))})),[t]);
  const allItems=useMemo(()=>[...menuGroups,...actionGroups].flatMap(group=>group.items),[menuGroups,actionGroups]);

  const load=async()=>{
    if(!tenant?.id)return;
    setReady(false);setError("");
    try{
      const [u,r]=await Promise.all([listRetailPosStaff(tenant.id),loadPosRoleSettings(tenant.id)]);
      setUsers(u);setRoles(r);
      setSelectedRole(current=>r.some(row=>row.id===current)?current:(r[0]?.id||""));
    }catch(e){console.error("POS_USERS_LOAD_FAILED",e);setError(String(e?.message||"โหลดข้อมูลผู้ใช้ไม่สำเร็จ"))}
    finally{setReady(true)}
  };
  useEffect(()=>{load()},[tenant?.id]);

  const role=roles.find(row=>row.id===selectedRole)||roles[0]||null;
  const permissions=new Set(role?.permissions||[]);
  const allAllowed=permissions.has("*");

  const patchRole=patch=>role&&setRoles(rows=>rows.map(row=>row.id===role.id?{...row,...patch}:row));
  const togglePermission=key=>{
    if(!role||role.locked&&allAllowed)return;
    const next=new Set(allAllowed?allItems.map(item=>item.key):role.permissions||[]);
    next.has(key)?next.delete(key):next.add(key);
    patchRole({permissions:[...next]});
  };
  const toggleGroup=group=>{
    if(!role||role.locked&&allAllowed)return;
    const keys=group.items.map(item=>item.key);
    const next=new Set(allAllowed?allItems.map(item=>item.key):role.permissions||[]);
    const allChecked=keys.every(key=>next.has(key));
    keys.forEach(key=>allChecked?next.delete(key):next.add(key));
    patchRole({permissions:[...next]});
  };
  const addRole=()=>{
    const id=roleId(),next={id,name:tr("pos_users.roles.add","เพิ่มบทบาท"),permissions:[],locked:false};
    setRoles(rows=>[...rows,next]);setSelectedRole(id);setError("");
  };
  const deleteRole=async()=>{
    if(!role||role.locked)return;
    if(users.some(user=>user.role===role.id||user.roleId===role.id)){setError(tr("pos_users.roles.in_use","ยังมีผู้ใช้ที่ใช้บทบาทนี้อยู่"));return}
    if(!window.confirm(tr("pos_users.roles.delete_confirm",`ลบบทบาท “${role.name}” หรือไม่?`,{name:role.name})))return;
    const next=roles.filter(row=>row.id!==role.id);
    setBusy("roles");setError("");
    try{await savePosRoleSettings(tenant.id,next);setRoles(next);setSelectedRole(next[0]?.id||"")}
    catch(e){console.error(e);setError(String(e?.message||"ลบบทบาทไม่สำเร็จ"))}
    finally{setBusy("")}
  };
  const saveRoles=async()=>{
    if(!role?.name?.trim()){setError(tr("pos_users.roles.name_required","กรุณากรอกชื่อบทบาท"));return}
    setBusy("roles");setError("");
    try{await savePosRoleSettings(tenant.id,roles);setRoles(rows=>rows.map(row=>({...row,name:String(row.name||row.id).trim()})))}
    catch(e){console.error(e);setError(String(e?.message||"บันทึกสิทธิ์ไม่สำเร็จ"))}
    finally{setBusy("")}
  };

  const openUser=user=>{
    setForm(user?{uid:user.uid,displayName:user.displayName||"",email:user.email||"",password:"",confirmPassword:"",role:user.roleId||user.role||"cashier",businessScope:user.businessScope==="both"?"both":"retail_pos",active:user.active!==false}:{...EMPTY_USER,role:roles.find(row=>row.id!=="owner")?.id||"cashier"});
    setError("");dialogRef.current?.showModal?.();
  };
  const saveUser=async event=>{
    event.preventDefault();
    const editing=Boolean(form.uid),email=String(form.email||"").trim().toLowerCase();
    if(!form.displayName.trim()||!email){setError(tr("pos_users.validation.name_email","กรุณากรอกชื่อและอีเมลสำหรับเข้าสู่ระบบ"));return}
    if(!/^\S+@\S+\.\S+$/.test(email)){setError(tr("pos_users.validation.email","กรุณากรอกอีเมลให้ถูกต้อง"));return}
    if(!editing&&!form.password){setError(tr("pos_users.validation.password_required","ผู้ใช้ใหม่ต้องกำหนดรหัสผ่าน"));return}
    if(form.password&&form.password.length<6){setError(tr("pos_users.validation.password_short","รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"));return}
    if(form.password!==form.confirmPassword){setError(tr("pos_users.validation.password_mismatch","ยืนยันรหัสผ่านไม่ตรงกัน"));return}
    if(form.role==="owner"){setError(tr("pos_users.validation.owner","ไม่สามารถสร้างหรือแก้ไขบัญชีเจ้าของร้านจากหน้านี้"));return}
    setBusy("user");setError("");
    try{
      await upsertRetailPosStaff({uid:form.uid,email,displayName:form.displayName,password:form.password,roleId:form.role,active:form.active,businessScope:form.businessScope});
      dialogRef.current?.close?.();await load();
    }catch(e){console.error("POS_USER_SAVE_FAILED",e);setError(String(e?.message||tr("pos_users.validation.save_failed","บันทึกผู้ใช้ไม่สำเร็จ กรุณาลองใหม่")))}
    finally{setBusy("")}
  };

  if(authState.status==="loading"||tenantState.status==="loading"||!stylesReady||(tenant?.id&&!ready))return <PageReadyOverlay/>;
  if(!profile)return <Navigate to="/login?next=%2Fpos%2Fusers" replace/>;
  if(!tenant)return <Navigate to="/" replace/>;
  if(!["owner","super_admin"].includes(profile.role))return <Navigate to="/pos" replace/>;

  const renderPermissionBlock=(titleKey,descKey,groups)=>(
    <section className="permission-block">
      <div className="permission-block-head"><div><h4>{tr(titleKey,titleKey.includes("actions")?"สิทธิ์การทำงานภายในเมนู":"สิทธิ์เข้าเมนู")}</h4>
        <p>{tr(descKey,"กำหนดสิทธิ์ของบทบาทนี้")}</p></div>
        <span className="permission-block-count">{tr("pos_users.permissions.selected",`เลือก ${allAllowed?groups.flatMap(g=>g.items).length:groups.flatMap(g=>g.items).filter(item=>permissions.has(item.key)).length}/${groups.flatMap(g=>g.items).length}`,{checked:allAllowed?groups.flatMap(g=>g.items).length:groups.flatMap(g=>g.items).filter(item=>permissions.has(item.key)).length,total:groups.flatMap(g=>g.items).length})}</span>
      </div>
      <div className="permission-group-grid">{groups.map(group=>{
        const keys=group.items.map(item=>item.key),checked=allAllowed?keys.length:keys.filter(key=>permissions.has(key)).length,allChecked=checked===keys.length;
        return <section className="permission-group-card" key={group.id} data-permission-group={group.id}>
          <div className="permission-group-head"><strong>{group.label}</strong>
            <button type="button" className={"permission-group-toggle "+(allChecked?"is-clear":"is-select")} onClick={()=>toggleGroup(group)} disabled={role?.locked&&allAllowed}>
              <i className={"bi "+(allChecked?"bi-x-circle":"bi-check-circle")} aria-hidden="true"></i><span>{tr(allChecked?"pos_users.permissions.clear_all":"pos_users.permissions.select_all",allChecked?"ยกเลิกทั้งหมด":"เลือกทั้งหมด")}</span>
            </button></div>
          <div className="permission-group-items">{group.items.map(item=><label className="permission-checkbox" key={item.key}><input type="checkbox" checked={allAllowed||permissions.has(item.key)} disabled={allAllowed} onChange={()=>togglePermission(item.key)}/><span>{item.label}</span></label>)}</div>
        </section>;
      })}</div>
    </section>
  );

  return <><header className="pos-header" data-pos-supporting-header><div className="app-title"><div><strong>{tr("pos_users.header.title","ผู้ใช้และสิทธิ์")}</strong><small>{tr("pos_users.header.subtitle","กำหนดบัญชีเข้าสู่ระบบ บทบาท ระบบที่เข้าใช้งาน และสิทธิ์เข้าถึง POS")}</small></div></div><div className="header-actions"><LocaleSwitcher/><PosNavigation profile={profile} currentKey="pos.users"/></div></header>
    <main className="permission-container" data-pos-supporting="users">
      <section className="permission-current">
        <span className="permission-current-icon" aria-hidden="true"><i className="bi bi-shield-check"></i></span>
        <strong>{tr("pos_users.current",`ผู้ใช้งานปัจจุบัน: ${profile.displayName||profile.name||profile.email||"-"} • ${roles.find(row=>row.id===(profile.roleId||profile.role))?.name||profile.role||"-"}`,{user:profile.displayName||profile.name||profile.email||"-",role:roles.find(row=>row.id===(profile.roleId||profile.role))?.name||profile.role||"-"})}</strong>
      </section>

      <section className="permission-grid">
        <section className="panel permission-panel users-role-list-panel">
          <div className="section-heading"><div><h2>{tr("pos_users.roles.title","บทบาท")}</h2><p>{tr("pos_users.roles.description","ชุดสิทธิ์ที่นำไปใช้กับผู้ใช้")}</p></div><button id="newRoleBtn" className="btn btn-pay" type="button" onClick={addRole}>{tr("pos_users.roles.add","เพิ่มบทบาท")}</button></div>
          <div className="permission-list">{roles.map(row=><button type="button" className={"permission-card role-card"+(row.id===selectedRole?" is-selected":"")} key={row.id} data-role-id={row.id} onClick={()=>setSelectedRole(row.id)}>
            <span className="role-card-icon" aria-hidden="true"><i className="bi bi-shield-check"></i></span>
            <div className="role-card-copy"><strong>{row.name}</strong><span>{row.permissions?.includes("*")?"ทุกสิทธิ์":tr("pos_users.roles.count",`${row.permissions?.length||0} สิทธิ์`,{count:row.permissions?.length||0})}{row.locked?" • "+tr("pos_users.roles.core","บทบาทหลัก"):""}</span></div>
            <span className="permission-actions" aria-hidden="true"><i className="bi bi-chevron-right"></i></span>
          </button>)}</div>
        </section>

        <section className="panel permission-panel users-role-editor-panel">
          {role?<form id="roleForm" onSubmit={event=>{event.preventDefault();saveRoles()}}>
            <input id="roleId" type="hidden" value={role.id}/>
            <div className="permission-form-grid"><label className="full">{tr("pos_users.roles.name","ชื่อบทบาท")}<input id="roleName" value={role.name||""} disabled={role.id==="owner"} onChange={event=>patchRole({name:event.target.value})}/></label></div>
            <h3 className="permission-section-title">{tr("pos_users.roles.permissions","กำหนดสิทธิ์")}</h3>
            <div id="permissionCheckboxes" className="permission-checkboxes">{renderPermissionBlock("pos_users.permissions.menu_title","pos_users.permissions.menu_description",menuGroups)}{renderPermissionBlock("pos_users.permissions.actions_title","pos_users.permissions.actions_description",actionGroups)}</div>
            <div className="dialog-actions"><button id="deleteRoleBtn" type="button" className="btn btn-danger" hidden={role.locked} onClick={deleteRole}>{tr("pos_users.roles.delete","ลบบทบาท")}</button><button className="btn btn-pay" disabled={busy==="roles"}>{tr("pos_users.roles.save","บันทึกบทบาท")}</button></div>
          </form>:null}
        </section>
      </section>

      <section className="panel permission-panel users-account-panel">
        <div className="section-heading"><div><h2>{tr("pos_users.users.title","บัญชีผู้ใช้งาน")}</h2><p>{tr("pos_users.users.description","กำหนดอีเมลเข้าสู่ระบบ รหัสผ่าน บทบาท ระบบ และสถานะ")}</p></div><button id="newUserBtn" className="btn btn-pay" type="button" onClick={()=>openUser(null)}>{tr("pos_users.users.add","เพิ่มผู้ใช้")}</button></div>
        <div id="userList" className="permission-list">{users.map(user=>{const userRole=roles.find(row=>row.id===(user.roleId||user.role));return <article className="permission-card user-account-card" key={user.uid}><span className="user-card-avatar" aria-hidden="true"><i className="bi bi-person"></i></span><div className="user-card-copy"><strong>{user.displayName||user.email}</strong><span className="user-card-email">{user.email}</span><div className="user-card-badges"><span className="user-role-badge">{userRole?.name||user.role}</span><span className={"user-status-badge "+(user.active?"is-active":"is-suspended")}>{tr(user.active?"pos_users.users.active":"pos_users.users.suspended",user.active?"เปิดใช้งาน":"ระงับใช้งาน")}</span><span className="user-auth-badge">{user.businessScope==="both"?tr("pos_users.scope.both","ทั้ง 2 ระบบ"):tr("pos_users.scope.retail_pos","Retail POS เท่านั้น")}</span></div></div><div className="permission-actions"><button type="button" data-user-id={user.uid} onClick={()=>openUser(user)}>{tr("pos_users.roles.edit","แก้ไข")}</button></div></article>})}</div>
        {!users.length?<div className="empty">{tr("pos_users.users.empty","ยังไม่มีพนักงาน POS ในธุรกิจนี้")}</div>:null}
      </section>
      <p className="error-text">{error}</p>
    </main>

    <dialog ref={dialogRef} id="userDialog" data-pos-management-dialog className="user-dialog users-editor-dialog">
      <form id="userForm" className="user-form payment-form" onSubmit={saveUser}>
        <div className="dialog-head users-dialog-head"><div className="users-dialog-title"><span className="users-dialog-icon" aria-hidden="true"><i className="bi bi-person-plus"></i></span><div><h2>{tr(form.uid?"pos_users.users.edit":"pos_users.users.add",form.uid?"แก้ไขผู้ใช้":"เพิ่มผู้ใช้")}</h2><small>{tr(form.uid?"pos_users.users.edit_hint":"pos_users.users.new_hint",form.uid?"อีเมลสำหรับเข้าสู่ระบบไม่สามารถแก้ไขได้ เว้นว่างรหัสผ่านหากไม่ต้องการเปลี่ยน":"ผู้ใช้ใหม่ต้องกำหนดรหัสผ่าน")}</small></div></div><button type="button" className="icon-btn" onClick={()=>dialogRef.current?.close?.()}><i className="bi bi-x-lg"/></button></div>
        <div className="permission-form-grid user-form-grid"><label>{tr("pos_users.users.name","ชื่อผู้ใช้")}<input required value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/></label><label>{tr("pos_users.users.email","อีเมลสำหรับเข้าสู่ระบบ")}<input required type="email" readOnly={Boolean(form.uid)} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>{tr("pos_users.users.password","รหัสผ่าน")}<input type="password" minLength={form.uid?0:6} value={form.password} placeholder={form.uid?"เว้นว่างหากไม่เปลี่ยน":tr("pos_users.users.password_placeholder","อย่างน้อย 6 ตัวอักษร")} onChange={e=>setForm({...form,password:e.target.value})}/></label><label>{tr("pos_users.users.confirm_password","ยืนยันรหัสผ่าน")}<input type="password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})}/></label><label>{tr("pos_users.users.role","บทบาท")}<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{roles.filter(row=>row.id!=="owner").map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label>{tr("pos_users.scope.label","ระบบที่เข้าใช้งาน")}<select value={form.businessScope} onChange={e=>setForm({...form,businessScope:e.target.value})}><option value="retail_pos">{tr("pos_users.scope.retail_pos","Retail POS เท่านั้น")}</option><option value="both">{tr("pos_users.scope.both","ทั้ง 2 ระบบ")}</option></select></label><label>{tr("pos_users.users.status","สถานะ")}<select value={form.active?"1":"0"} onChange={e=>setForm({...form,active:e.target.value==="1"})}><option value="1">{tr("pos_users.users.active","เปิดใช้งาน")}</option><option value="0">{tr("pos_users.users.suspended","ระงับใช้งาน")}</option></select></label></div>
        <small id="passwordHint">{tr(form.uid?"pos_users.users.edit_hint":"pos_users.users.new_hint",form.uid?"อีเมลสำหรับเข้าสู่ระบบไม่สามารถแก้ไขได้ เว้นว่างรหัสผ่านหากไม่ต้องการเปลี่ยน":"ผู้ใช้ใหม่ต้องกำหนดรหัสผ่านอย่างน้อย 6 ตัวอักษร")}</small>
        <p className="error-text">{error}</p><div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={()=>dialogRef.current?.close?.()}>{tr("pos_users.users.cancel","ยกเลิก")}</button><button type="submit" className="btn btn-pay" disabled={busy==="user"}>{busy==="user"?tr("pos_users.users.saving","กำลังบันทึก..."):tr("pos_users.users.save","บันทึกผู้ใช้")}</button></div>
      </form>
    </dialog>
    <AppDeveloperPanel/></>;
}
