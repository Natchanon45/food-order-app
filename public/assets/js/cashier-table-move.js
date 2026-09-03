import { dataService } from './data-service.js?v=20260718-021';
import { toast } from './ui.js?v=20260805-081';
import { iconMarkup } from './bootstrap-icons.js?v=20260701-001';
import { t } from './i18n.js?v=20260812-099';

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
  if(code.includes('SOURCE_TABLE_NOT_ACTIVE'))return t('cashier.table_move.source_not_active');
  if(code.includes('TARGET_TABLE_NOT_AVAILABLE'))return t('cashier.table_move.target_not_available');
  if(code.includes('MOVE_ORDER_NOT_UNPAID'))return t('cashier.table_move.order_not_unpaid');
  if(code.includes('permission-denied'))return t('cashier.table_move.permission_denied');
  return t('cashier.table_move.failed',{code});
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
    button.innerHTML=`${icon('arrow-left-right')}<span>${t('cashier.table_move.button')}</span>`;
    actions.insertBefore(button,paymentButton);
  });
}

function showTargetDialog(fromTableCode,tables){
  if(!tables.length){
    toast(t('cashier.table_move.no_available_tables'),'error');
    return Promise.resolve(null);
  }
  return new Promise(resolve=>{
    const root=document.createElement('div');
    root.className='sweet-dialog-backdrop show';
    root.innerHTML=[
      '<div class="sweet-dialog" role="dialog" aria-modal="true">',
      '<div class="sweet-dialog-icon warning">!</div>',
      `<h2 class="sweet-dialog-title">${t('cashier.table_move.dialog_title')}</h2>`,
      `<p class="sweet-dialog-message">${t('cashier.table_move.dialog_message',{table:fromTableCode})}</p>`,
      '<select id="moveTableTarget" style="width:100%;padding:12px;border:1px solid #dfe8e2;border-radius:12px;font:inherit"></select>',
      '<div class="sweet-dialog-actions has-cancel" style="margin-top:18px">',
      `<button id="moveTableCancel" class="sweet-dialog-button sweet-dialog-cancel" type="button">${t('cashier.common.cancel')}</button>`,
      `<button id="moveTableConfirm" class="sweet-dialog-button sweet-dialog-confirm" type="button">${t('cashier.table_move.confirm_selection')}</button>`,
      '</div></div>'
    ].join('');
    const select=root.querySelector('#moveTableTarget');
    tables.forEach(table=>{
      const option=document.createElement('option');
      option.value=table.id;
      option.textContent=table.name||t('cashier.table_move.table_fallback',{table:table.code||table.id});
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
    toast(t('cashier.table_move.no_unpaid_orders'),'error');
    return;
  }
  button.disabled=true;
  try{
    const fromTableCode=rounds[0].tableCode;
    const tables=await dataService.listTables();
    const available=tables.filter(table=>table.active!==false&&(!table.status||table.status==='available')&&String(table.code||table.id)!==String(fromTableCode))
      .sort((a,b)=>String(a.code||a.id).localeCompare(String(b.code||b.id),document.documentElement.lang||undefined));
    const targetId=await showTargetDialog(fromTableCode,available);
    if(!targetId){button.disabled=false;return}
    const target=available.find(table=>String(table.id)===String(targetId));
    const label=target?.name||target?.code||targetId;
    const ok=await window.sweetConfirm?.(`${t('cashier.table_move.confirm_message',{from:fromTableCode,to:label})}\n\n${t('cashier.table_move.confirm_warning')}`,{title:t('cashier.table_move.confirm_title'),confirmText:t('cashier.table_move.confirm_action'),cancelText:t('cashier.common.cancel'),type:'warning'});
    if(!ok){button.disabled=false;return}
    await dataService.moveTableSession({fromTableCode,fromTableToken:rounds[0].tableToken,toTableId:targetId,orders:rounds});
    toast(t('cashier.table_move.success',{from:fromTableCode,to:label}));
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
