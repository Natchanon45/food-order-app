const SALES_KEY='retail_pos_sales_v1';
const q=s=>document.querySelector(s);
const els={body:q('#salesTableBody'),before:q('#beforeVatTotal'),vat:q('#vatTotal'),count:q('#vatBillCount'),search:q('#saleSearch'),from:q('#dateFrom'),to:q('#dateTo'),payment:q('#paymentFilter')};
function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function money(v){return Number(v||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})}
function dateKey(v){const d=new Date(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function saleNo(s){return String(s.saleNumber||s.number||s.id||'')}
function pay(s){return s.payment?.method||s.paymentMethod||'cash'}
function isVat(s){return s.vatRegistered===true||s.vatRegistered==='yes'||Number(s.vatAmount||0)>0}
function mode(s){return isVat(s)?(String(s.vatMode)==='exclude'?'exclude':'include'):'-'}
function before(s){return isVat(s)?Number(s.beforeVat??s.taxableBase??s.discountedBase??s.subtotal??0):0}
function all(){const rows=read(SALES_KEY,[]);return Array.isArray(rows)?rows:[]}
function filtered(){const key=(els.search?.value||'').trim().toLowerCase(),from=els.from?.value||'',to=els.to?.value||'',method=els.payment?.value||'all';return all().filter(s=>{const d=dateKey(s.createdAt),items=(s.items||[]).map(i=>`${i.name||''} ${i.id||''} ${i.barcode||''}`).join(' ').toLowerCase();return(!key||saleNo(s).toLowerCase().includes(key)||String(s.id||'').toLowerCase().includes(key)||items.includes(key))&&(!from||d>=from)&&(!to||d<=to)&&(method==='all'||pay(s)===method)})}
function findSale(text){const t=String(text||'').trim();return all().find(s=>saleNo(s)===t||String(s.id||'')===t)}
function td(text,cls,label){const el=document.createElement('td');if(cls)el.className=cls;if(label)el.dataset.label=label;el.textContent=text;return el}
function patchRows(){if(!els.body)return;[...els.body.querySelectorAll('tr')].forEach(row=>{if(row.children.length>=10)return;const s=findSale(row.querySelector('.sale-id')?.textContent);if(!s||!row.children[3])return;const m=td(mode(s),'','VAT'),b=td(isVat(s)?money(before(s)):'-','number','ยอดก่อน VAT'),v=td(isVat(s)?money(s.vatAmount):'-','number','VAT');row.children[3].after(m,b,v)})}
function updateCards(){const rows=filtered();if(els.before)els.before.textContent=money(rows.reduce((a,s)=>a+before(s),0));if(els.vat)els.vat.textContent=money(rows.reduce((a,s)=>a+Number(s.vatAmount||0),0));if(els.count)els.count.textContent=rows.filter(isVat).length.toLocaleString('th-TH')}
function refresh(){setTimeout(()=>{patchRows();updateCards()},0)}
[els.search,els.from,els.to,els.payment].forEach(el=>el?.addEventListener(el.tagName==='INPUT'?'input':'change',refresh));document.addEventListener('click',e=>{if(e.target.closest('#todayBtn,#monthBtn,#clearFilterBtn'))refresh()},true);window.addEventListener('storage',refresh);refresh();
