import './sweet-dialog.js?v=20260629-048';
import { dataService } from './data-service.js';
import { toast } from './ui.js';

const occupiedTables=document.querySelector('#occupiedTables');

function latestOrders(){
  return new Promise(resolve=>{
    let done=false;
    let unsubscribe=null;
    const finish=orders=>{
      if(done)return;
      done=true;
      try{unsubscribe?.()}catch{}
      resolve(orders||[]);
    };
    unsubscribe=dataService.subscribeOrders(finish);
    setTimeout(()=>finish([]),3000);
  });
}

function isUnpaidTableOrder(order){
  return order?.orderType!=='delivery'&&!['paid','cancelled'].includes(order?.status)&&order?.paymentStatus!=='paid';
}

function orderBelongsToTable(order,table){
  const orderTableToken=String(order?.tableToken||'');
  const tableToken=String(table?.orderToken||'');
  const orderTableCode=String(order?.tableCode||'');
  const tableCode=String(table?.code||table?.id||'');
  return (tableToken&&orderTableToken===tableToken)||(tableCode&&orderTableCode===tableCode);
}

async function askConfirm(message,options={}){
  if(typeof window.sweetConfirm==='function')return await window.sweetConfirm(message,options);
  return confirm(message);
}

async function closeTableSafely(button){
  const table=await dataService.getTable(button.dataset.closeTable);
  if(!table){
    toast('ไม่พบข้อมูลโต๊ะ กรุณารีเฟรชหน้าแล้วลองใหม่','error');
    return;
  }

  button.disabled=true;
  const originalText=button.textContent;
  button.textContent='กำลังตรวจสอบออเดอร์...';

  try{
    const orders=await latestOrders();
    const hasUnpaid=orders.some(order=>isUnpaidTableOrder(order)&&orderBelongsToTable(order,table));
    if(hasUnpaid){
      toast('ยังมีออเดอร์หรือยังไม่ได้ชำระเงิน ไม่สามารถปิดโต๊ะได้','error');
      button.disabled=false;
      button.textContent=originalText||'ปิดโต๊ะ';
      return;
    }

    const ok=await askConfirm(`ยืนยันปิด ${table.name||`โต๊ะ ${table.code||table.id}`} ใช่หรือไม่?\n\nQR ใบเดิมจะใช้งานไม่ได้ และโต๊ะจะกลับเป็นโต๊ะว่าง`,{title:'ปิดโต๊ะ',confirmText:'ตกลง',cancelText:'ยกเลิก',type:'warning'});
    if(!ok){
      button.disabled=false;
      button.textContent=originalText||'ปิดโต๊ะ';
      return;
    }

    button.textContent='กำลังปิดโต๊ะ...';
    await dataService.updateTable(table.id,{status:'available',orderToken:'',sessionStartedAt:null,currentRound:0});
    toast(`ปิด ${table.name||`โต๊ะ ${table.code||table.id}`} เรียบร้อยแล้ว`);
    setTimeout(()=>location.reload(),350);
  }catch(error){
    console.error('SAFE_TABLE_CLOSE_FAILED',error);
    toast('ปิดโต๊ะไม่สำเร็จ กรุณาลองใหม่','error');
    button.disabled=false;
    button.textContent=originalText||'ปิดโต๊ะ';
  }
}

if(occupiedTables){
  occupiedTables.addEventListener('click',event=>{
    const button=event.target.closest('[data-close-table]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeTableSafely(button);
  },true);
}
