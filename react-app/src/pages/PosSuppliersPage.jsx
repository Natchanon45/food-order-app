import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { useAuth } from "@/auth/AuthProvider";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { sweetAlert, sweetConfirm } from "@/components/sweetDialog";
import {
  deletePosSupplier,
  listPosPurchases,
  listPosSuppliers,
  savePosSupplier,
  watchPosPurchases,
  watchPosSuppliers,
} from "@/data/retailPurchasingData";
import { loadPosRoleSettings } from "@/data/retailPosSystemData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const BUILTIN_POS_ROLES=new Set(["owner","admin","manager","cashier","stock","kitchen"]);
const ROLE_SETTINGS_TIMEOUT_MS=6000;
const INITIAL_DATA_TIMEOUT_MS=10000;
const EMPTY_SUPPLIER=Object.freeze({
  id:"",name:"",contact:"",phone:"",email:"",taxId:"",creditDays:0,address:"",note:"",active:true,
});

const cachedPosRoles=()=>{try{const rows=JSON.parse(localStorage.getItem("retail_pos_roles_v1")||"[]");return Array.isArray(rows)?rows:[]}catch{return[]}};
const withTimeout=(promise,timeoutMs,code)=>Promise.race([
  promise,
  new Promise((_,reject)=>window.setTimeout(()=>{const error=new Error(code);error.code=code;reject(error)},timeoutMs)),
]);

function hasSupplierPermission(profile,roleRows,permission){
  if(!profile)return false;
  const roleId=String(profile.roleId||profile.role||"");
  if(roleId==="owner")return true;
  const role=(Array.isArray(roleRows)?roleRows:[]).find(item=>String(item?.id||"")===roleId);
  const permissions=Array.isArray(role?.permissions)?role.permissions:[];
  if(permissions.includes("*")||permissions.includes(permission))return true;
  const hasGranular=permissions.some(key=>String(key).startsWith("pos.suppliers."));
  if(hasGranular)return false;
  if(roleId==="admin"||roleId==="manager")return ["pos.suppliers.create","pos.suppliers.edit","pos.suppliers.delete","pos.suppliers.view_purchase"].includes(permission);
  if(roleId==="stock")return ["pos.suppliers.create","pos.suppliers.edit"].includes(permission);
  return false;
}

export function PosSuppliersPage(){
  const authState=useAuth(),tenantState=useTenant();
  const {profile,user:authUser}=authState,{tenant}=tenantState;
  const {t,formatNumber}=useI18n();
  const tr=useCallback((key,replacements={})=>t(`pos_purchasing.suppliers.${key}`,replacements),[t]);
  const stylesReady=useParityPage({
    title:tr("meta.title"),
    bodyClass:"pos-suppliers-page",
    attributes:{"data-module":"retail-pos-suppliers"},
    disabledGlobalStyles:["app.css","icons.css","shared-responsive.css"],
    styles:[
      "app-version-badge-runtime.css","retail-pos-font-local.css","pos-locale-switcher-placement.css",
      "retail-pos.css","retail-suppliers.css","retail-suppliers-visual-dashboard.css",
      "retail-pos-navigation.css","sweet-dialog.css","page-ready-state.css",
    ],
  });

  const [suppliers,setSuppliers]=useState([]),[purchases,setPurchases]=useState([]),[initialReady,setInitialReady]=useState(false);
  const [roleRows,setRoleRows]=useState(()=>cachedPosRoles());
  const [rolesReady,setRolesReady]=useState(()=>{
    const session=getRetailPosSession(),roleId=String(session?.roleId||session?.role||"");
    return BUILTIN_POS_ROLES.has(roleId)||cachedPosRoles().length>0;
  });
  const [search,setSearch]=useState(""),[filter,setFilter]=useState("all");
  const [form,setForm]=useState(()=>({...EMPTY_SUPPLIER})),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [toastMessage,setToastMessage]=useState(""),[toastType,setToastType]=useState("success");
  const dialogRef=useRef(null),nameRef=useRef(null),toastTimerRef=useRef(0);

  const posSession=useMemo(()=>getRetailPosSession(),[
    authUser?.uid,profile?.id,profile?.uid,profile?.tenantId,profile?.role,profile?.roleId,
  ]);
  const posAccessProfile=useMemo(()=>({
    ...(profile||{}),...(posSession||{}),
    role:posSession?.role||profile?.role||profile?.roleId||"",
    roleId:posSession?.roleId||posSession?.role||profile?.roleId||profile?.role||"",
  }),[profile,posSession]);
  const pagePermissions=useMemo(()=>getPosPermissions(posAccessProfile,roleRows),[posAccessProfile,roleRows]);
  const canView=pagePermissions.has("pos.suppliers");
  const canCreate=hasSupplierPermission(posAccessProfile,roleRows,"pos.suppliers.create");
  const canEdit=hasSupplierPermission(posAccessProfile,roleRows,"pos.suppliers.edit");
  const canDelete=hasSupplierPermission(posAccessProfile,roleRows,"pos.suppliers.delete");
  const canViewPurchase=hasSupplierPermission(posAccessProfile,roleRows,"pos.suppliers.view_purchase");

  const redirectTarget=useMemo(()=>{
    if(authState.status==="loading"||tenantState.status==="loading"||!stylesReady)return"";
    const requested=location.pathname+location.search;
    if(!profile)return"/pos/login/?next="+encodeURIComponent(requested);
    if(!canUseRetailPos(posAccessProfile)||tenantState.status==="error"||!tenant)return"/";
    if(!rolesReady)return"";
    if(!canView){
      const first=firstAllowedPosPage(posAccessProfile,roleRows);
      return first==="/pos/forbidden"
        ?"/pos/forbidden/?permission=pos.suppliers&next="+encodeURIComponent(requested)
        :first+"?from=permission";
    }
    return"";
  },[authState.status,tenantState.status,tenant,profile,posAccessProfile,roleRows,rolesReady,canView,stylesReady]);
  useEffect(()=>{if(redirectTarget)location.replace(redirectTarget)},[redirectTarget]);

  useEffect(()=>{
    let alive=true;
    if(!tenant?.id||!profile){setRoleRows([]);setRolesReady(true);return()=>{alive=false}};
    const cached=cachedPosRoles(),roleId=String(posAccessProfile?.roleId||posAccessProfile?.role||"");
    if(cached.length)setRoleRows(cached);
    setRolesReady(BUILTIN_POS_ROLES.has(roleId)||cached.length>0);
    withTimeout(loadPosRoleSettings(tenant.id),ROLE_SETTINGS_TIMEOUT_MS,"POS_ROLE_SETTINGS_TIMEOUT")
      .then(next=>{if(!alive)return;const rows=Array.isArray(next)?next:[];setRoleRows(rows);try{localStorage.setItem("retail_pos_roles_v1",JSON.stringify(rows))}catch{}})
      .catch(loadError=>{console.warn("POS_SUPPLIERS_ROLE_SETTINGS_LOAD_FAILED",loadError);if(alive&&!cached.length&&!BUILTIN_POS_ROLES.has(roleId))setRoleRows([])})
      .finally(()=>{if(alive)setRolesReady(true)});
    return()=>{alive=false};
  },[tenant?.id,profile,posAccessProfile?.roleId,posAccessProfile?.role]);

  const refresh=useCallback(async()=>{
    if(!tenant?.id||!profile||!canView)return;
    const [nextSuppliers,nextPurchases]=await Promise.all([listPosSuppliers(tenant.id),listPosPurchases(tenant.id)]);
    setSuppliers(nextSuppliers);setPurchases(nextPurchases);
  },[tenant?.id,profile,canView]);
  useEffect(()=>{
    let alive=true;
    if(!tenant?.id||!profile||!rolesReady||!canView||redirectTarget){setInitialReady(false);return()=>{alive=false}};
    withTimeout(refresh(),INITIAL_DATA_TIMEOUT_MS,"POS_SUPPLIERS_INITIAL_LOAD_TIMEOUT")
      .catch(loadError=>console.warn("POS_SUPPLIERS_LOAD_FAILED",loadError))
      .finally(()=>{if(alive)setInitialReady(true)});
    return()=>{alive=false};
  },[tenant?.id,profile,rolesReady,canView,redirectTarget,refresh]);
  useEffect(()=>{
    if(!tenant?.id||!profile||!rolesReady||!canView||redirectTarget||!initialReady)return undefined;
    const onError=watchError=>console.warn("POS_SUPPLIERS_WATCH_FAILED",watchError);
    const stopSuppliers=watchPosSuppliers(tenant.id,setSuppliers,onError);
    const stopPurchases=watchPosPurchases(tenant.id,setPurchases,onError);
    return()=>{stopSuppliers();stopPurchases()};
  },[tenant?.id,profile,rolesReady,canView,redirectTarget,initialReady]);

  const money=useCallback(value=>formatNumber(Number(value||0),{minimumFractionDigits:2,maximumFractionDigits:2}),[formatNumber]);
  const amountText=useCallback(value=>t("pos_purchasing.common.amount_thb",{amount:money(value)}),[t,money]);

  const purchaseSummary=useMemo(()=>{
    const map=new Map();
    purchases.forEach(purchase=>{
      const keys=[String(purchase.supplierId||""),String(purchase.supplierName||"").trim().toLowerCase()].filter(Boolean);
      const primary=keys[0]||keys[1];
      if(!primary)return;
      const current=map.get(primary)||{count:0,total:0};
      current.count+=1;current.total+=Number(purchase.total||0);map.set(primary,current);
      keys.slice(1).forEach(key=>{if(!map.has(key))map.set(key,current)});
    });
    return map;
  },[purchases]);

  const summaryFor=useCallback(supplier=>
    purchaseSummary.get(String(supplier?.id||""))
    ||purchaseSummary.get(String(supplier?.name||"").trim().toLowerCase())
    ||{count:0,total:0},
  [purchaseSummary]);

  const supplierRows=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return suppliers.filter(supplier=>{
      const summary=summaryFor(supplier),hasHistory=summary.count>0;
      const match=!q||[supplier.name,supplier.contact,supplier.phone,supplier.email,supplier.taxId]
        .some(value=>String(value||"").toLowerCase().includes(q));
      return match&&(filter==="all"||(filter==="active"&&hasHistory)||(filter==="inactive"&&!hasHistory));
    }).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"th"));
  },[suppliers,search,filter,summaryFor]);

  const stats=useMemo(()=>{
    const withHistory=suppliers.filter(item=>summaryFor(item).count>0).length;
    const purchaseTotal=purchases.reduce((sum,item)=>sum+Number(item.total||0),0);
    const creditValues=suppliers.map(item=>Math.max(0,Number(item.creditDays||0)));
    const averageCredit=creditValues.length?creditValues.reduce((a,b)=>a+b,0)/creditValues.length:0;
    return{total:suppliers.length,withHistory,purchaseTotal,purchaseCount:purchases.length,averageCredit};
  },[suppliers,purchases,summaryFor]);

  const showToast=useCallback((message,variant="success")=>{
    setToastType(variant==="error"?"error":"success");setToastMessage(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current=window.setTimeout(()=>setToastMessage(""),2200);
  },[]);
  useEffect(()=>()=>window.clearTimeout(toastTimerRef.current),[]);

  const closeDialog=useCallback(()=>{if(busy)return;if(dialogRef.current?.open)dialogRef.current.close();setError("")},[busy]);
  const openAdd=useCallback(()=>{
    if(!canCreate)return;
    setForm({...EMPTY_SUPPLIER});setError("");dialogRef.current?.showModal?.();
    window.setTimeout(()=>nameRef.current?.focus?.(),50);
  },[canCreate]);
  const openEdit=useCallback(supplier=>{
    if(!canEdit)return;
    setForm({...EMPTY_SUPPLIER,...supplier});setError("");dialogRef.current?.showModal?.();
    window.setTimeout(()=>nameRef.current?.focus?.(),50);
  },[canEdit]);
  const change=useCallback((key,value)=>setForm(current=>({...current,[key]:value})),[]);

  const submit=useCallback(async event=>{
    event.preventDefault();
    const editing=Boolean(form.id),allowed=editing?canEdit:canCreate;
    if(!allowed||busy)return;
    const name=String(form.name||"").trim();
    if(!name){setError(tr("runtime.name_required"));return}
    const duplicate=suppliers.some(item=>String(item.id||"")!==String(form.id||"")
      &&String(item.name||"").trim().toLowerCase()===name.toLowerCase());
    if(duplicate){setError(tr("runtime.duplicate_name"));return}
    setBusy(true);setError("");
    try{
      const saved=await savePosSupplier(tenant.id,{...form,name,creditDays:Math.max(0,Number(form.creditDays||0))},form.id);
      setSuppliers(current=>{
        const exists=current.some(item=>String(item.id)===String(saved.id));
        return (exists?current.map(item=>String(item.id)===String(saved.id)?saved:item):[...current,saved])
          .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"th"));
      });
      if(dialogRef.current?.open)dialogRef.current.close();
      showToast(tr(editing?"runtime.edited_synced":"runtime.added_synced"));
    }catch(submitError){
      console.error("POS_SUPPLIER_SAVE_FAILED",submitError);
      const message=String(submitError?.message||"");
      const translated=message.includes("SUPPLIER_NAME_REQUIRED")?tr("runtime.name_required"):(message||tr("runtime.server_conflict",{error:"SAVE_FAILED"}));
      setError(translated);showToast(translated,"error");
    }finally{setBusy(false)}
  },[form,canEdit,canCreate,busy,suppliers,tenant?.id,tr,showToast]);

  const remove=useCallback(async supplier=>{
    if(!canDelete||busy)return;
    const summary=summaryFor(supplier);
    if(summary.count>0){await sweetAlert(tr("runtime.delete_used"),{confirmText:t("shared.action.ok"),type:"warning"});return}
    const approved=await sweetConfirm(tr("runtime.delete_confirm",{name:supplier.name}),{
      confirmText:tr("runtime.delete"),
      cancelText:tr("form.cancel"),
      type:"warning",
    });
    if(!approved)return;
    setBusy(true);
    try{
      await deletePosSupplier(tenant.id,supplier.id);
      setSuppliers(current=>current.filter(item=>String(item.id)!==String(supplier.id)));
      showToast(tr("runtime.deleted_synced"));
    }catch(deleteError){
      console.error("POS_SUPPLIER_DELETE_FAILED",deleteError);
      const message=tr("runtime.delete_failed",{error:String(deleteError?.message||"DELETE_FAILED")});
      showToast(message,"error");await sweetAlert(message,{confirmText:t("shared.action.ok"),type:"error"});
    }finally{setBusy(false)}
  },[canDelete,busy,summaryFor,tenant?.id,tr,t,showToast]);

  const needsReady=authState.status==="loading"||tenantState.status==="loading"||!stylesReady
    ||Boolean(redirectTarget)||!rolesReady||(tenant?.id&&profile&&canView&&!initialReady);
  if(needsReady)return <PageReadyOverlay title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;

  return <>
    <header className="pos-header" data-pos-management-header>
      <div className="app-title"><div><strong>{tr("header.title")}</strong><small>{tr("header.subtitle")}</small></div></div>
      <div className="header-actions"><LocaleSwitcher/><PosNavigation profile={posAccessProfile} currentKey="pos.suppliers"/></div>
    </header>

    <main data-pos-management className="supplier-container">
      <section className="supplier-visual-hero">
        <span className="supplier-hero-orbit supplier-hero-orbit-one"></span><span className="supplier-hero-orbit supplier-hero-orbit-two"></span>
        <div className="supplier-hero-grid">
          <div className="supplier-hero-copy">
            <div className="supplier-hero-kicker"><i className="bi bi-buildings" aria-hidden="true"></i><span>{tr("visual.kicker")}</span></div>
            <h1>{tr("header.title")}</h1><p>{tr("visual.hero_description")}</p>
            <div className="supplier-hero-status"><i className="bi bi-link-45deg" aria-hidden="true"></i><span>{tr("visual.integrated")}</span></div>
          </div>
          <div className="supplier-hero-metrics">
            <article><span><i className="bi bi-building" aria-hidden="true"></i>{tr("stats.total")}</span><strong>{formatNumber(stats.total)}</strong></article>
            <article><span><i className="bi bi-clock-history" aria-hidden="true"></i>{tr("stats.active")}</span><strong>{formatNumber(stats.withHistory)}</strong></article>
            <article><span><i className="bi bi-calendar2-week" aria-hidden="true"></i>{tr("visual.average_credit")}</span><strong>{tr("runtime.days",{count:formatNumber(Math.round(stats.averageCredit))})}</strong></article>
            <article><span><i className="bi bi-receipt" aria-hidden="true"></i>{tr("stats.purchase_count")}</span><strong>{canViewPurchase?formatNumber(stats.purchaseCount):"—"}</strong></article>
          </div>
        </div>
      </section>

      <section className="supplier-stats">
        <article className="supplier-stat-card supplier-stat-total"><span className="supplier-stat-icon"><i className="bi bi-buildings" aria-hidden="true"></i></span><span>{tr("stats.total")}</span><strong id="supplierTotal">{formatNumber(stats.total)}</strong><small>{tr("visual.total_hint")}</small></article>
        <article className="supplier-stat-card supplier-stat-history"><span className="supplier-stat-icon"><i className="bi bi-check2-circle" aria-hidden="true"></i></span><span>{tr("stats.active")}</span><strong id="activeSupplierTotal">{formatNumber(stats.withHistory)}</strong><small>{tr("visual.history_hint")}</small></article>
        <article className="supplier-stat-card supplier-stat-value"><span className="supplier-stat-icon"><i className="bi bi-cash-stack" aria-hidden="true"></i></span><span>{tr("stats.purchase_total")}</span><strong id="supplierPurchaseTotal" hidden={!canViewPurchase}>{amountText(stats.purchaseTotal)}</strong><strong className="supplier-purchase-mask" hidden={canViewPurchase}>—</strong><small>{tr("visual.purchase_value_hint")}</small></article>
        <article className="supplier-stat-card supplier-stat-purchases"><span className="supplier-stat-icon"><i className="bi bi-receipt-cutoff" aria-hidden="true"></i></span><span>{tr("stats.purchase_count")}</span><strong id="supplierPurchaseCount" hidden={!canViewPurchase}>{formatNumber(stats.purchaseCount)}</strong><strong className="supplier-purchase-mask" hidden={canViewPurchase}>—</strong><small>{tr("visual.purchase_count_hint")}</small></article>
      </section>

      <section className="panel supplier-panel">
        <div className="section-heading supplier-list-heading">
          <div className="supplier-list-title"><span className="supplier-list-title-icon"><i className="bi bi-person-vcard" aria-hidden="true"></i></span><div><h2>{tr("panel.title")}</h2><p>{tr("panel.subtitle")}</p></div></div>
          <button id="addSupplierBtn" className="btn btn-pay" type="button" hidden={!canCreate} onClick={openAdd}><i className="bi bi-plus-lg" aria-hidden="true"></i><span>{tr("add")}</span></button>
        </div>
        <div className="supplier-toolbar">
          <label><span><i className="bi bi-search" aria-hidden="true"></i>{tr("visual.search_label")}</span><input id="supplierSearch" value={search} onChange={event=>setSearch(event.target.value)} placeholder={tr("search_placeholder")}/></label>
          <label><span><i className="bi bi-filter-circle" aria-hidden="true"></i>{tr("visual.filter_label")}</span><select id="supplierFilter" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">{tr("filters.all")}</option><option value="active">{tr("filters.active")}</option><option value="inactive">{tr("filters.inactive")}</option></select></label>
        </div>

        <div id="supplierGrid" className="supplier-grid">
          {supplierRows.map(supplier=>{
            const summary=summaryFor(supplier),hasHistory=summary.count>0;
            return <article className={`supplier-card ${hasHistory?"has-history":"no-history"}`} key={supplier.id}>
              <div className="supplier-card-head">
                <div className="supplier-card-identity"><span className="supplier-avatar"><i className="bi bi-building" aria-hidden="true"></i></span><div><h3>{supplier.name}</h3><span>{supplier.taxId?tr("runtime.tax_id",{tax_id:supplier.taxId}):tr("runtime.no_tax_id")}</span></div></div>
                <span className={`supplier-history-badge ${hasHistory?"is-active":"is-new"}`}><i className={`bi bi-${hasHistory?"check-circle":"sparkles"}`} aria-hidden="true"></i>{hasHistory?tr("filters.active"):tr("filters.inactive")}</span>
              </div>
              <div className="supplier-contact">
                {supplier.contact?<span><i className="bi bi-person" aria-hidden="true"></i>{tr("runtime.contact",{contact:supplier.contact})}</span>:null}
                {supplier.phone?<span><i className="bi bi-telephone" aria-hidden="true"></i>{tr("runtime.phone",{phone:supplier.phone})}</span>:null}
                {supplier.email?<span><i className="bi bi-envelope" aria-hidden="true"></i>{supplier.email}</span>:null}
                {supplier.address?<span><i className="bi bi-geo-alt" aria-hidden="true"></i>{supplier.address}</span>:null}
              </div>
              <div className="supplier-credit-strip"><span><i className="bi bi-calendar2-week" aria-hidden="true"></i>{tr("form.credit_days")}</span><strong>{tr("runtime.days",{count:formatNumber(Number(supplier.creditDays||0))})}</strong></div>
              <div className="supplier-summary" hidden={!canViewPurchase}>
                <div><span>{tr("runtime.purchase_count")}</span><strong>{formatNumber(summary.count)}</strong></div>
                <div><span>{tr("runtime.purchase_total")}</span><strong>{amountText(summary.total)}</strong></div>
              </div>
              <div className="supplier-actions">
                <button data-action="edit" type="button" hidden={!canEdit} onClick={()=>openEdit(supplier)}><i className="bi bi-pencil-square" aria-hidden="true"></i><span>{tr("runtime.edit")}</span></button>
                <button className="delete" data-action="delete" type="button" hidden={!canDelete} onClick={()=>remove(supplier)}><i className="bi bi-trash3" aria-hidden="true"></i><span>{tr("runtime.delete")}</span></button>
              </div>
            </article>;
          })}
        </div>
        <div id="supplierEmpty" className="empty-state supplier-empty" hidden={supplierRows.length>0}><span className="supplier-empty-icon"><i className="bi bi-buildings" aria-hidden="true"></i></span><strong>{tr("empty")}</strong><small>{tr("visual.empty_hint")}</small></div>
      </section>
    </main>

    <dialog id="supplierDialog" ref={dialogRef} className="supplier-dialog supplier-editor-dialog" onCancel={event=>event.preventDefault()}>
      <form id="supplierForm" className="payment-form" onSubmit={submit}>
        <div className="dialog-head supplier-dialog-head">
          <div className="supplier-dialog-title"><span className="supplier-dialog-title-icon"><i className="bi bi-building-add" aria-hidden="true"></i></span><div><h2 id="supplierDialogTitle">{form.id?tr("form.edit_title"):tr("form.add_title")}</h2><p>{tr("visual.form_description")}</p></div></div>
          <button id="closeSupplierDialog" type="button" className="icon-btn" aria-label={tr("form.close")} disabled={busy} onClick={closeDialog}><i className="bi bi-x-lg" aria-hidden="true"></i></button>
        </div>
        <input id="editingSupplierId" type="hidden" value={form.id||""} readOnly/>
        <div className="supplier-form-grid">
          <label className="full">{tr("form.name")}<span className="supplier-field"><i className="bi bi-building" aria-hidden="true"></i><input id="supplierName" ref={nameRef} maxLength={120} required value={form.name} onChange={event=>change("name",event.target.value)}/></span></label>
          <label>{tr("form.contact")}<span className="supplier-field"><i className="bi bi-person" aria-hidden="true"></i><input id="supplierContact" maxLength={100} value={form.contact} onChange={event=>change("contact",event.target.value)}/></span></label>
          <label>{tr("form.phone")}<span className="supplier-field"><i className="bi bi-telephone" aria-hidden="true"></i><input id="supplierPhone" maxLength={30} inputMode="tel" value={form.phone} onChange={event=>change("phone",event.target.value)}/></span></label>
          <label>{tr("form.email")}<span className="supplier-field"><i className="bi bi-envelope" aria-hidden="true"></i><input id="supplierEmail" maxLength={120} type="email" value={form.email} onChange={event=>change("email",event.target.value)}/></span></label>
          <label>{tr("form.tax_id")}<span className="supplier-field"><i className="bi bi-card-text" aria-hidden="true"></i><input id="supplierTaxId" maxLength={20} inputMode="numeric" value={form.taxId} onChange={event=>change("taxId",event.target.value)}/></span></label>
          <label>{tr("form.credit_days")}<span className="supplier-field"><i className="bi bi-calendar2-week" aria-hidden="true"></i><input id="supplierCreditDays" type="number" min="0" step="1" value={form.creditDays} onChange={event=>change("creditDays",event.target.value)}/></span></label>
          <label className="full">{tr("form.address")}<span className="supplier-field supplier-field-area"><i className="bi bi-geo-alt" aria-hidden="true"></i><textarea id="supplierAddress" rows={3} maxLength={500} value={form.address} onChange={event=>change("address",event.target.value)}></textarea></span></label>
          <label className="full">{tr("form.note")}<span className="supplier-field supplier-field-area"><i className="bi bi-sticky" aria-hidden="true"></i><textarea id="supplierNote" rows={2} maxLength={300} value={form.note} onChange={event=>change("note",event.target.value)}></textarea></span></label>
        </div>
        <p id="supplierFormError" className="error-text">{error}</p>
        <div className="dialog-actions supplier-form-actions">
          <button id="cancelSupplierBtn" type="button" className="btn btn-secondary" disabled={busy} onClick={closeDialog}><i className="bi bi-x-circle" aria-hidden="true"></i><span>{tr("form.cancel")}</span></button>
          <button type="submit" className="btn btn-pay" disabled={busy||(!form.id&&!canCreate)||(Boolean(form.id)&&!canEdit)}><i className="bi bi-floppy" aria-hidden="true"></i><span>{busy?tr("runtime.saving"):tr("form.save")}</span></button>
        </div>
      </form>
    </dialog>

    <div id="toast" className={`toast ${toastType}${toastMessage?" show":""}`} role={toastType==="error"?"alert":"status"} aria-live="polite"><span className="app-toast-icon" aria-hidden="true"><i className={`bi bi-${toastType==="error"?"x-circle":"check-circle"} app-icon`}></i></span><span className="app-toast-message">{toastMessage}</span></div>
    <AppDeveloperPanel/>
  </>;
}
