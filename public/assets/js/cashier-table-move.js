import { dataService } from './data-service.js';
import { toast } from './ui.js';

function isUnpaid(order){
  return order?.orderType !== 'delivery' && !['paid','cancelled'].includes(order?.status) && order?.paymentStatus !== 'paid';
}

function groupKey(order){
  return order.tableToken || `table:${order.tableCode}`;
}

function moveError(error){
  const code=String(error?.code||error?.message||'UNKNOWN_ERROR');
  if(code.includes('SOURCE_TABLE_NOT_ACTIVE'))return 'โต๊ะเดิมไม่ได้เปิดอยู่ หรือมีการปิด/ย้ายไปแล้ว กรุณารีเฟรชรายการ';
  if(code.includes('TARGET_TABLE_NOT_AVAILABLE'))return 'โต๊ะใหม่ไม่ว่างแล้ว กรุณาเลือกโต๊ะอื่น';
  if(code.includes('MOVE_ORDER_NOT_UNPAID'))return 'พบออเดอร์บางรายการถูกชำระเงินหรือไม่ได้อยู่ในโต๊ะเดิมแล้ว';
  if(code.includes('permission-denied'))return 'ไม่มีสิทธิ์เปลี่ยนโต๊ะ กรุณา Deploy Firestore Rules ล่าสุด';
  return `เปลี่ยนโต๊ะไม่สำเร็จ (${code})`;
}

async function chooseTargetTable(fromTableCode){
  const tables=await dataService.listTables();
  const available=tables.filter(table=>table.active!==false&&(!table.status||table.status==='available')&&String(table.code||table.id)!==String(fromTableCode))
    .sort((a,b)=>String(a.code||a.id).localeCompare(String(b.code||b.id),'th'));
  if(!available.length){toast('ไม่มีโต๊ะว่างสำหรับย้าย','error');return null}
  const labels=available.map((table,index)=>`${index+1}. ${table.name||`โต๊ะ ${table.code||table.id}`}`).join('\n');
  const raw=window.prompt(`เลือกโต๊ะใหม่สำหรับย้ายจากโต๊ะ ${fromTableCode}\n\n${labels}\n\nพิมพ์หมายเลขโต๊ะที่ต้องการ`);
  if(raw===null)return null;
  const index=Number(String(raw).trim())-1;
  if(!Number.isInteger(index)||!available[index]){toast('หมายเลขโต๊ะไม่ถูกต้อง','error');return null}
  return available[index];
}

export function installCashierTableMove({ grid, getOrders, tableGroupKey=groupKey, icon }){
  if(!grid||typeof getOrders!=='function')return;
  grid.addEventListener('click',async event=>{
    const button=event.target.closest('[data-table-move]');
    if(!button)return;
    const key=button.dataset.tableMove;
    const rounds=(getOrders()||[]).filter(order=>isUnpaid(order)&&tableGroupKey(order)===key);
    if(!rounds.length){toast('ไม่มีออเดอร์ที่ยังไม่ชำระสำหรับย้ายโต๊ะ','error');return}
    button.disabled=true;
    try{
      const fromTableCode=rounds[0].tableCode;
      const target=await chooseTargetTable(fromTableCode);
      if(!target){button.disabled=false;return}
      const label=target.name||target.code||target.id;
      const ok=await window.sweetConfirm?.(`ยืนยันย้ายโต๊ะ ${fromTableCode} ไป ${label} ใช่หรือไม่?\n\nระบบจะปิดโต๊ะเดิมเป็นว่าง และย้ายออเดอร์ที่ยังไม่ชำระทั้งหมดไปโต๊ะใหม่`,{title:'ยืนยันเปลี่ยนโต๊ะ',confirmText:'ย้ายโต๊ะ',cancelText:'ยกเลิก',type:'warning'});
      if(!ok){button.disabled=false;return}
      await dataService.moveTableSession({fromTableCode,fromTableToken:rounds[0].tableToken,toTableId:target.id,orders:rounds});
      toast(`ย้ายโต๊ะ ${fromTableCode} ไป ${label} เรียบร้อย`);
    }catch(error){
      console.error('TABLE_MOVE_FAILED',error);
      toast(moveError(error),'error');
      button.disabled=false;
    }
  });
}

export function moveTableButton(key, iconRenderer=()=>'', label='เปลี่ยนโต๊ะ'){
  return `<button class="btn btn-warning" data-table-move="${key}">${iconRenderer('table')}<span>${label}</span></button>`;
}
