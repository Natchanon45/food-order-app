let activeResolve=null;
let previousAlert=window.alert?.bind(window);
let previousConfirm=window.confirm?.bind(window);

function ensureDialog(){
  let root=document.querySelector('#sweetDialogRoot');
  if(root)return root;
  root=document.createElement('div');
  root.id='sweetDialogRoot';
  root.className='sweet-dialog-backdrop';
  root.innerHTML=`<div class="sweet-dialog" role="dialog" aria-modal="true" aria-labelledby="sweetDialogTitle" aria-describedby="sweetDialogMessage"><div id="sweetDialogIcon" class="sweet-dialog-icon">✓</div><h2 id="sweetDialogTitle" class="sweet-dialog-title">แจ้งเตือน</h2><p id="sweetDialogMessage" class="sweet-dialog-message"></p><div id="sweetDialogActions" class="sweet-dialog-actions"><button id="sweetDialogCancel" class="sweet-dialog-button sweet-dialog-cancel" type="button">ยกเลิก</button><button id="sweetDialogConfirm" class="sweet-dialog-button sweet-dialog-confirm" type="button">ตกลง</button></div></div>`;
  document.body.appendChild(root);
  root.querySelector('#sweetDialogConfirm').addEventListener('click',()=>closeDialog(true));
  root.querySelector('#sweetDialogCancel').addEventListener('click',()=>closeDialog(false));
  root.addEventListener('click',event=>{if(event.target===root)closeDialog(false)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.classList.contains('show'))closeDialog(false)});
  return root;
}

function closeDialog(value){
  const root=document.querySelector('#sweetDialogRoot');
  root?.classList.remove('show');
  const resolve=activeResolve;
  activeResolve=null;
  setTimeout(()=>resolve?.(value),120);
}

export function sweetAlert(message,options={}){
  if(!document.body){previousAlert?.(message);return Promise.resolve(true)}
  const root=ensureDialog();
  const title=root.querySelector('#sweetDialogTitle');
  const msg=root.querySelector('#sweetDialogMessage');
  const icon=root.querySelector('#sweetDialogIcon');
  const actions=root.querySelector('#sweetDialogActions');
  const cancel=root.querySelector('#sweetDialogCancel');
  const confirm=root.querySelector('#sweetDialogConfirm');
  title.textContent=options.title||'แจ้งเตือน';
  msg.textContent=String(message??'');
  icon.textContent=options.iconText||'✓';
  icon.className=`sweet-dialog-icon ${options.type||''}`.trim();
  confirm.textContent=options.confirmText||'ตกลง';
  cancel.hidden=true;
  actions.classList.remove('has-cancel');
  root.classList.add('show');
  confirm.focus({preventScroll:true});
  return new Promise(resolve=>{activeResolve=resolve});
}

export function sweetConfirm(message,options={}){
  if(!document.body){return Promise.resolve(previousConfirm?previousConfirm(message):false)}
  const root=ensureDialog();
  const title=root.querySelector('#sweetDialogTitle');
  const msg=root.querySelector('#sweetDialogMessage');
  const icon=root.querySelector('#sweetDialogIcon');
  const actions=root.querySelector('#sweetDialogActions');
  const cancel=root.querySelector('#sweetDialogCancel');
  const confirm=root.querySelector('#sweetDialogConfirm');
  title.textContent=options.title||'ยืนยันการทำรายการ';
  msg.textContent=String(message??'');
  icon.textContent=options.iconText||'!';
  icon.className=`sweet-dialog-icon ${options.type||'warning'}`.trim();
  confirm.textContent=options.confirmText||'ยืนยัน';
  cancel.textContent=options.cancelText||'ยกเลิก';
  cancel.hidden=false;
  actions.classList.add('has-cancel');
  root.classList.add('show');
  confirm.focus({preventScroll:true});
  return new Promise(resolve=>{activeResolve=resolve});
}

window.sweetAlert=sweetAlert;
window.sweetConfirm=sweetConfirm;
window.alert=message=>{sweetAlert(message)};
window.confirm=message=>{console.warn('[sweet-dialog] window.confirm is async; use sweetConfirm for reliable branching.',message);previousConfirm?.(message);return false};
