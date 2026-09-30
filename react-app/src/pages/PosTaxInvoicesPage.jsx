import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { useTenant } from "@/tenant/TenantProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { listPosSales, listPosTaxInvoices } from "@/data/retailPosData";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PosNavigation } from "@/components/PosNavigation";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
const asDate=v=>v?.toDate?.()||new Date(v||0);
export function PosTaxInvoicesPage(){
 const authState=useAuth(),tenantState=useTenant(),{profile}=authState,{tenant}=tenantState,{formatNumber}=useI18n();
 const stylesReady=useParityPage({title:"ใบกำกับภาษี",bodyClass:"pos-tax-invoices-page",disabledGlobalStyles:["app.css","icons.css","shared-responsive.css"],styles:["retail-pos-font-local.css","pos-locale-switcher-placement.css","retail-pos.css","retail-pos-navigation.css","pos-tax-invoices-page.css"]});
 const [invoices,setInvoices]=useState([]),[sales,setSales]=useState([]),[ready,setReady]=useState(false),[search,setSearch]=useState(""),[saleSearch,setSaleSearch]=useState("");
 const money=v=>formatNumber(Number(v||0),{minimumFractionDigits:2,maximumFractionDigits:2});
 const refresh=async()=>{if(!tenant?.id)return;setReady(false);try{const [i,s]=await Promise.all([listPosTaxInvoices(tenant.id),listPosSales(tenant.id)]);setInvoices(i);setSales(s)}finally{setReady(true)}};
 useEffect(()=>{refresh()},[tenant?.id]);
 const filtered=useMemo(()=>{const q=search.toLowerCase().trim();return invoices.filter(i=>!q||[i.invoiceNumber,i.saleNumber,i.buyer?.buyerName,i.buyer?.buyerTaxId,i.status].join(" ").toLowerCase().includes(q))},[invoices,search]);
 const candidate=useMemo(()=>{const q=saleSearch.trim().toLowerCase();if(!q)return null;return sales.find(s=>String(s.saleNumber||s.id).toLowerCase().includes(q))||null},[sales,saleSearch]);
 const openReceipt=s=>window.open("/pos/receipt?saleId="+encodeURIComponent(s.id)+"&auto=0&paper=80","pos_tax_issue_"+String(s.id).replace(/\W/g,"_"),"popup=yes,width=720,height=820,noopener,noreferrer");
 const printInvoice=i=>window.open("/pos/tax-invoice?invoiceId="+encodeURIComponent(i.id)+"&auto=1","pos_tax_invoice_"+String(i.id).replace(/\W/g,"_"),"popup=yes,width=920,height=760,noopener,noreferrer");
 if(authState.status==="loading"||tenantState.status==="loading"||!stylesReady||(tenant?.id&&!ready))return null;if(!profile)return <Navigate to="/login?next=%2Freact%2Fpos%2Ftax-invoices" replace/>;if(!tenant)return <Navigate to="/" replace/>;
 return <><header className="pos-header no-print" data-pos-supporting-header><div className="app-title"><div><strong>ใบกำกับภาษี</strong><small>จัดการและพิมพ์ใบกำกับภาษีจากการขาย POS</small></div></div><div className="header-actions"><a className="btn btn-secondary" href="/pos"><i className="bi bi-arrow-left"/><span>กลับหน้าขาย</span></a><button className="btn btn-primary" onClick={refresh}><i className="bi bi-arrow-clockwise"/><span>รีเฟรช</span></button><LocaleSwitcher/><PosNavigation profile={profile} currentKey="pos.tax_invoices"/></div></header>
 <main className="shell"><section className="panel issue-panel"><h2>ออกใบกำกับภาษีจากบิล</h2><p>ค้นหาเลขที่บิล POS แล้วเปิดข้อมูลผู้ซื้อเพื่อออกใบกำกับภาษี</p><div className="issue-row"><label>เลขที่บิล<input value={saleSearch} onChange={e=>setSaleSearch(e.target.value)} placeholder="เช่น POS-20260929-00001"/></label>{candidate?<button className="btn btn-primary" onClick={()=>openReceipt(candidate)}><i className="bi bi-file-earmark-text"/><span>ออกใบกำกับภาษี</span></button>:<button className="btn btn-secondary" disabled>ค้นหาบิล</button>}</div>{saleSearch&&candidate?<div className="issue-sale-card"><div><strong>{candidate.saleNumber||candidate.id}</strong><div>{asDate(candidate.createdAt).toLocaleString("th-TH")} • {money(candidate.totalAmount||candidate.total)} บาท</div></div><button className="btn btn-primary" onClick={()=>openReceipt(candidate)}>เปิดบิล</button></div>:null}</section>
 <section className="panel"><div className="filter-row"><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาเลขที่ใบกำกับ บิลเดิม ชื่อหรือเลขผู้เสียภาษี"/><span className="summary">ทั้งหมด {filtered.length} รายการ</span></div><div className="list">{filtered.map(i=><article className="tax-card" key={i.id}><div><div className="tax-card-badges"><span className="tax-doc-no">{i.invoiceNumber||i.id}</span>{i.status==="void"?<span className="sync-badge is-error">ยกเลิก</span>:null}</div><h2>{i.buyer?.buyerName||"ไม่ระบุผู้ซื้อ"}</h2><div className="tax-meta"><span>{i.buyer?.buyerTaxId||"-"}</span><span>{i.saleNumber||i.saleId||"-"}</span><span>{asDate(i.issuedAt||i.createdAt).toLocaleString("th-TH")}</span></div><p>{i.buyer?.buyerAddress||""}</p></div><div className="tax-card-side"><strong>{money(i.totalAmount)} บาท</strong><span>VAT {money(i.vatAmount)}</span><div className="tax-actions"><button className="btn btn-primary" onClick={()=>printInvoice(i)}><i className="bi bi-printer"/><span>พิมพ์</span></button></div></div></article>)}</div>{!filtered.length?<div className="empty">ยังไม่มีใบกำกับภาษี</div>:null}</section></main><AppDeveloperPanel/></>;
}
