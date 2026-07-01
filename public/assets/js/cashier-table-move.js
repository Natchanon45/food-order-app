import { dataService } from './data-service.js';
import { toast } from './ui.js?v=20260701-001';
import { iconMarkup } from './bootstrap-icons.js?v=20260701-001';

const grid=document.querySelector('#orderGrid');
let currentOrders=[];

function icon(name){
  return iconMarkup(name);
}

function groupKey(order){
  return order.tableToken||`table:${order.tableCode}`;
}

function isUnpaid(order){
  return order?.orderType!=='delivery'&&!['paid','cancelled'].includes(order?.status)&&order?.paymentStatus!=='paid';
}

function errorText(error){
  const code=String(error?.code||error?.message||'UNKNOWN_ERROR');
  if(code.includes('SOURCE_TABLE_NOT_ACTIVE'))return 'โต๊ะเดิมไม่ได้เปิดอยู่ หรือมีการปิด/ย้ายไปแล้ว กรุณารีเฟรชรายการ';
  if(code.includes('TARGET_TABLE_NOT_AVAILABLE'))return 'โต๊ะใหม่ไม่ว่างแล้ว กรุณาเลือกโต๊ะอื่น';
  if(code.includes('MOVE_ORDER_NOT_UNPAID'))return 'พบออเดอร์บางรายการถูกชำระเงินหรือไม่ได้อยู่ในโต๊ะเดิมแล้ว';
  if(code.includes('permission-denied'))return 'ไม่มีสิทธิ์เปลี่ยนโต๊ะ กรุณา Deploy Firestore Rules ล่าสุด';
  return `เปลี่ยนโต๊ะไม่สำเร็จ (${code})`;
}

function installButtons(){
  if(!grid)return;
  grid.querySelectorAll('[data-table-payment]').forEach(paymentButton=>{
    const key=paymentButton.dataset.tablePayment;
    const actions=paymentButton.parentElement;
    if(!actions||actions.querySelector(`[data-table-move="${CSS.escape(key)}"]`))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='btn btn-warning';
    button.dataset.tableMove=key;
    button.innerHTML=`${icon('easel2')}<span>เปลี่ยนโต๊ะ</span>`;
    actions.insertBefore(button,paymentButton);
  });
}

function showTargetDialog(fromTableCode,tables){
  if(!tables.length){
    toast('ไม่มีโต๊ะว่างสำหรับย้าย','error');
    return Promise.resolve(null);
  }
  return new Promise(resolve=>{
    const root=document.createElement('div');
    root.className='sweet-dialog-backdrop show';
    root.innerHTML=[
      '<div class="sweet-dialog" role="dialog" aria-modal="true">',
      '<div class="sweet-dialog-icon warning">!</div>',
      '<h2 class="sweet-dialog-title">เปลี่ยนโต๊ะ</h2>',
      `<p class="sweet-dialog-message">ย้ายออเดอร์ที่ยังไม่ชำระจากโต๊ะ ${fromTableCode} ไปยังโต๊ะว่าง</p>`,
      '<select id="moveTableTarget" style="width:100%;padding:12px;border:1px solid #dfe8e2;border-radius:12px;font:inherit"></select>',
      '<div class="sweet-dialog-actions has-cancel" style="margin-top:18px">',
      '<button id="moveTableCancel" class="sweet-dialog-button sweet-dialog-cancel" type="button">ยกเลิก</button>',
      '<button id="moveTableConfirm" class="sweet-dialog-button sweet-dialog-confirm" type="button">ยืนยันย้ายโต๊ะ</button>',
      '</div></div>'
    ].join('');
    const select=root.querySelector('#moveTableTarget');
    tables.forEach(table=>{
      const option=document.createElement('option');
      option.value=table.id;
      option.textContent=table.name||`โต๊ะ ${table.code||table.id}`;
      select.appendChild(option);
    });
    document.body.appendChild(root);
    const close=value=>{
      root.classList.remove('show');
      setTimeout(()=>{root.remove();resolve(value)},120);
    };
    root.querySelector('#moveTableCancel').addEventListener('click',()=>close(null));
    root.querySelector('#moveTableConfirm').addEventListener('click',()=>close(select.value));
    root.addEventListener('click',event=>{if(event.target===root)close(null)});
    select.focus({preventScroll:true});
  });
}

async function moveTable(key,button){
  const rounds=currentOrders.filter(order=>isUnpaid(order)&&groupKey(order)===key);
  if(!rounds.length){
    toast('ไม่มีออเดอร์ที่ยังไม่ชำระสำหรับย้ายโต๊ะ','error');
    return;
  }
  button.disabled=true;
  try{
    const fromTableCode=rounds[0].tableCode;
    const tables=await dataService.listTables();
    const available=tables.filter(table=>table.active!==false&&(!table.status||table.status==='available')&&String(table.code||table.id)!==String(fromTableCode))
      .sort((a,b)=>String(a.code||a.id).localeCompare(String(b.code||b.id),'th'));
    const targetId=await showTargetDialog(fromTableCode,available);
    if(!targetId){button.disabled=false;return}
    const target=available.find(table=>String(table.id)===String(targetId));
    const label=target?.name||target?.code||targetId;
    const ok=await window.sweetConfirm?.(`ยืนยันย้ายโต๊ะ ${fromTableCode} ไป ${label} ใช่หรือไม่?\n\nระบบจะปิดโต๊ะเดิมเป็นว่าง และย้ายออเดอร์ที่ยังไม่ชำระทั้งหมดไปโต๊ะใหม่`,{title:'ยืนยันเปลี่ยนโต๊ะ',confirmText:'ย้ายโต๊ะ',cancelText:'ยกเลิก',type:'warning'});
    if(!ok){button.disabled=false;return}
    await dataService.moveTableSession({fromTableCode,fromTableToken:rounds[0].tableToken,toTableId:targetId,orders:rounds});
    toast(`ย้ายโต๊ะ ${fromTableCode} ไป ${label} เรียบร้อย`);
  }catch(error){
    console.error('TABLE_MOVE_FAILED',error);
    toast(errorText(error),'error');
    button.disabled=false;
  }
}

if(grid){
  grid.addEventListener('click',event=>{
    const button=event.target.closest('[data-table-move]');
    if(button)moveTable(button.dataset.tableMove,button);
  });
  new MutationObserver(installButtons).observe(grid,{childList:true,subtree:true});
}

dataService.subscribeOrders(orders=>{
  currentOrders=orders||[];
  setTimeout(installButtons,0);
});

installButtons();
