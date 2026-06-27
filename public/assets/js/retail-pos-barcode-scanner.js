const input=document.querySelector('#barcodeInput');
const row=input?.closest('.search-row');
const toast=document.querySelector('#toast');
let stream=null;
let raf=0;
let detector=null;
let zxingReader=null;
let zxingControls=null;

const BARCODE_ICON='<svg class="scan-barcode-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5v14"></path><path d="M7 5v14"></path><path d="M10 5v14"></path><path d="M14 5v14"></path><path d="M17 5v14"></path><path d="M21 5v14"></path></svg>';

function showScanToast(message,type='success'){
  if(!toast)return;
  toast.textContent=message;
  toast.classList.toggle('error',type==='error');
  toast.classList.toggle('is-error',type==='error');
  toast.classList.add('show');
  clearTimeout(showScanToast.timer);
  showScanToast.timer=setTimeout(()=>toast.classList.remove('show'),2200);
}

function loadZxing(){
  if(window.ZXing)return Promise.resolve(window.ZXing);
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-zxing="1"]');
    if(existing){existing.addEventListener('load',()=>resolve(window.ZXing));existing.addEventListener('error',reject);return;}
    const script=document.createElement('script');
    script.dataset.zxing='1';
    script.src='https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
    script.onload=()=>window.ZXing?resolve(window.ZXing):reject(new Error('ZXing not available'));
    script.onerror=reject;
    document.head.appendChild(script);
  });
}

function addStyles(){
  if(document.getElementById('posScanStyles'))return;
  const style=document.createElement('style');
  style.id='posScanStyles';
  style.textContent=`
  .scan-barcode-btn{min-height:54px;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;background:#000!important;color:#fff!important;border-radius:14px!important;box-shadow:0 8px 18px rgba(0,0,0,.18)}
  .scan-barcode-btn:hover{background:#111!important}
  .scan-barcode-icon{width:24px;height:24px;display:block;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}
  .pos-scan-dialog{width:min(520px,calc(100% - 18px));border:0;border-radius:18px;padding:0;overflow:hidden;background:#111;color:#fff;box-shadow:0 22px 70px rgba(0,0,0,.45)}
  .pos-scan-dialog::backdrop{background:rgba(15,23,42,.76)}
  .pos-scan-sheet{display:grid;gap:12px;padding:14px}
  .pos-scan-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .pos-scan-head h2{margin:0;font-size:1.15rem}.pos-scan-head p{margin:4px 0 0;color:#cbd5e1;font-size:.82rem}
  .pos-scan-close{border:0;background:rgba(255,255,255,.12);color:#fff;border-radius:12px;width:40px;height:40px;font-size:1.35rem}
  .pos-scan-view{position:relative;display:grid;place-items:center;min-height:360px;border-radius:16px;overflow:hidden;background:#020617}
  .pos-scan-view video{width:100%;height:100%;min-height:360px;object-fit:cover}
  .pos-scan-guide{position:absolute;left:50%;top:50%;width:min(76%,360px);height:128px;transform:translate(-50%,-50%);border:2px solid #22c55e;border-radius:14px;box-shadow:0 0 0 999px rgba(2,6,23,.38)}
  .pos-scan-line{position:absolute;left:12%;right:12%;top:50%;height:2px;background:#ef4444;box-shadow:0 0 12px #ef4444}
  .pos-scan-status{margin:0;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.1);color:#e2e8f0;font-size:.86rem}
  @media(max-width:600px){.search-row{grid-template-columns:1fr!important}.pos-scan-view,.pos-scan-view video{min-height:55vh}.scan-barcode-btn{width:100%}}
  `;
  document.head.appendChild(style);
}

function ensureDialog(){
  let dialog=document.getElementById('posScanDialog');
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.id='posScanDialog';
  dialog.className='pos-scan-dialog';
  dialog.innerHTML=`<div class="pos-scan-sheet"><div class="pos-scan-head"><div><h2>สแกนบาร์โค้ด</h2><p>วางบาร์โค้ดให้อยู่ในกรอบสีเขียว</p></div><button class="pos-scan-close" type="button" aria-label="ปิด">×</button></div><div class="pos-scan-view"><video id="posScanVideo" playsinline muted></video><div class="pos-scan-guide"></div><div class="pos-scan-line"></div></div><p id="posScanStatus" class="pos-scan-status">กำลังเตรียมกล้อง...</p></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('.pos-scan-close').addEventListener('click',stopScanner);
  dialog.addEventListener('close',stopScanner);
  return dialog;
}

function addProductByCode(code){
  if(!input)return;
  input.value=code;
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
}

async function startScanner(){
  if(!input)return;
  if(!navigator.mediaDevices?.getUserMedia){
    showScanToast('อุปกรณ์นี้ไม่สามารถเปิดกล้องได้','error');
    input.focus();
    return;
  }
  const dialog=ensureDialog();
  const video=dialog.querySelector('#posScanVideo');
  const status=dialog.querySelector('#posScanStatus');
  try{
    if(!dialog.open)dialog.showModal();
    if('BarcodeDetector'in window){
      detector=new BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code']});
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      video.srcObject=stream;
      await video.play();
      status.textContent='กำลังสแกน...';
      scanLoop(video,status);
      return;
    }
    status.textContent='กำลังโหลดตัวอ่านบาร์โค้ด...';
    const ZXing=await loadZxing();
    zxingReader=new ZXing.BrowserMultiFormatReader();
    status.textContent='กำลังสแกน...';
    zxingControls=await zxingReader.decodeFromVideoDevice(null,video,(result)=>{
      if(!result)return;
      const value=String(result.getText?.()||result.text||'').trim();
      if(!value)return;
      status.textContent='พบรหัส: '+value;
      addProductByCode(value);
      showScanToast('สแกนบาร์โค้ดสำเร็จ');
      stopScanner();
    });
  }catch(err){
    stopScanner();
    showScanToast('เปิดกล้องไม่สำเร็จ กรุณาอนุญาตการใช้งานกล้อง','error');
  }
}

async function scanLoop(video,status){
  if(!stream||!detector)return;
  try{
    const codes=await detector.detect(video);
    if(codes.length){
      const value=(codes[0].rawValue||'').trim();
      if(value){
        status.textContent='พบรหัส: '+value;
        addProductByCode(value);
        showScanToast('สแกนบาร์โค้ดสำเร็จ');
        stopScanner();
        return;
      }
    }
  }catch{}
  raf=requestAnimationFrame(()=>scanLoop(video,status));
}

function stopScanner(){
  cancelAnimationFrame(raf);
  raf=0;
  try{zxingControls?.stop?.()}catch{}
  try{zxingReader?.reset?.()}catch{}
  zxingControls=null;
  zxingReader=null;
  if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}
  const dialog=document.getElementById('posScanDialog');
  const video=dialog?.querySelector('#posScanVideo');
  if(video)video.srcObject=null;
  if(dialog?.open)dialog.close();
  input?.focus();
}

if(input&&row){
  addStyles();
  const btn=document.createElement('button');
  btn.id='scanBarcodeBtn';
  btn.className='btn scan-barcode-btn';
  btn.type='button';
  btn.innerHTML=BARCODE_ICON+'<span>สแกน</span>';
  row.insertBefore(btn,input.nextSibling);
  btn.addEventListener('click',startScanner);
}
