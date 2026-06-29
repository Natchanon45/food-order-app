import { exportProductImages, importProductImages } from "./retail-product-image-store.js?v=20260627-2";
import { RetailCollections, listRecords, saveRecords, saveRecord } from "./retail-db.js?v=20260629-032";

const BACKUP_VERSION = 2;
const DATA_KEYS = [
  "retail_pos_products_v1",
  "retail_pos_sales_v1",
  "retail_pos_returns_v1",
  "retail_pos_customers_v1",
  "retail_pos_loyalty_settings_v1",
  "retail_pos_loyalty_ledger_v1",
  "retail_pos_purchases_v1",
  "retail_pos_suppliers_v1",
  "retail_pos_stock_counts_v1",
  "retail_pos_stock_movements_v1",
  "retail_pos_held_bills_v1",
  "retail_pos_print_mode_v1",
  "retail_pos_active_shift_v1",
  "retail_pos_shift_history_v1",
  "retail_pos_store_settings_v1",
  "retail_pos_roles_v1",
  "retail_pos_users_v1",
  "retail_pos_current_user_v1"
];
const FIREBASE_EXPORTS = [
  ["products", RetailCollections.products, "retail_pos_products_v1"],
  ["sales", RetailCollections.sales, "retail_pos_sales_v1"],
  ["returns", RetailCollections.returns, "retail_pos_returns_v1"],
  ["customers", RetailCollections.customers, "retail_pos_customers_v1"],
  ["loyaltyLedger", RetailCollections.loyaltyLedger, "retail_pos_loyalty_ledger_v1"],
  ["purchases", RetailCollections.purchases, "retail_pos_purchases_v1"],
  ["suppliers", RetailCollections.suppliers, "retail_pos_suppliers_v1"],
  ["stockCounts", RetailCollections.stockCounts, "retail_pos_stock_counts_v1"],
  ["stockMovements", RetailCollections.stockMovements, "retail_pos_stock_movements_v1"],
  ["heldBills", RetailCollections.heldBills, "retail_pos_held_bills_v1"],
  ["shifts", RetailCollections.shifts, "retail_pos_shift_history_v1"],
  ["roles", RetailCollections.roles, "retail_pos_roles_v1"],
  ["users", RetailCollections.users, "retail_pos_users_v1"],
  ["settings", RetailCollections.settings, "retail_pos_store_settings_v1"]
];

const els = {
  exportBtn: document.querySelector("#exportBackupBtn"), backupStats: document.querySelector("#backupStats"), exportProgress: document.querySelector("#exportProgress"), dropzone: document.querySelector("#backupDropzone"), fileInput: document.querySelector("#backupFile"), fileName: document.querySelector("#backupFileName"), restoreSummary: document.querySelector("#restoreSummary"), replaceConfirmRow: document.querySelector("#replaceConfirmRow"), replaceConfirm: document.querySelector("#replaceConfirm"), clearSelectedBtn: document.querySelector("#clearSelectedBtn"), restoreBtn: document.querySelector("#restoreBackupBtn"), restoreProgress: document.querySelector("#restoreProgress"), error: document.querySelector("#backupError"), toast: document.querySelector("#toast")
};

let selectedBackup = null, toastTimer;
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
function formatNumber(value){return Number(value||0).toLocaleString("th-TH")}
function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?"-":date.toLocaleString("th-TH")}
function showToast(message){clearTimeout(toastTimer);els.toast.textContent=message;els.toast.classList.add("show");toastTimer=setTimeout(()=>els.toast.classList.remove("show"),2200)}
function withTimeout(promise,milliseconds,message){let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds)});return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer))}
function countRows(firebaseData,key,localKey){const rows=firebaseData?.[key];return Array.isArray(rows)?rows.length:readJson(localKey,[]).length}
async function collectFirebaseData(){
  const data = {};
  for (const [key, collectionName, localKey] of FIREBASE_EXPORTS) {
    try {
      const rows = await listRecords(collectionName);
      data[key] = Array.isArray(rows) ? rows : [];
      if (localKey && key !== "settings") writeJson(localKey, data[key]);
    } catch (error) {
      console.warn("[pos-backup] firebase export fallback", collectionName, error);
      data[key] = localKey ? readJson(localKey, []) : [];
    }
  }
  return data;
}
async function renderCurrentStats(){
  const data=await collectFirebaseData();
  const products=data.products||readJson("retail_pos_products_v1",[]), images=products.filter(item=>item?.imageKey).length;
  els.backupStats.innerHTML=`<div class="backup-stat"><span>สินค้า</span><strong>${formatNumber(countRows(data,"products","retail_pos_products_v1"))}</strong></div><div class="backup-stat"><span>ประวัติการขาย</span><strong>${formatNumber(countRows(data,"sales","retail_pos_sales_v1"))}</strong></div><div class="backup-stat"><span>คืนสินค้า</span><strong>${formatNumber(countRows(data,"returns","retail_pos_returns_v1"))}</strong></div><div class="backup-stat"><span>ลูกค้า</span><strong>${formatNumber(countRows(data,"customers","retail_pos_customers_v1"))}</strong></div><div class="backup-stat"><span>รายการแต้ม</span><strong>${formatNumber(countRows(data,"loyaltyLedger","retail_pos_loyalty_ledger_v1"))}</strong></div><div class="backup-stat"><span>ใบซื้อ</span><strong>${formatNumber(countRows(data,"purchases","retail_pos_purchases_v1"))}</strong></div><div class="backup-stat"><span>ผู้จำหน่าย</span><strong>${formatNumber(countRows(data,"suppliers","retail_pos_suppliers_v1"))}</strong></div><div class="backup-stat"><span>รอบตรวจนับ</span><strong>${formatNumber(countRows(data,"stockCounts","retail_pos_stock_counts_v1"))}</strong></div><div class="backup-stat"><span>รูปสินค้า</span><strong>${formatNumber(images)}</strong></div><div class="backup-stat"><span>กะ</span><strong>${formatNumber(countRows(data,"shifts","retail_pos_shift_history_v1"))}</strong></div><div class="backup-stat"><span>บทบาท</span><strong>${formatNumber(countRows(data,"roles","retail_pos_roles_v1"))}</strong></div><div class="backup-stat"><span>ผู้ใช้งาน</span><strong>${formatNumber(countRows(data,"users","retail_pos_users_v1"))}</strong></div>`
}
function collectLocalStorageData(){return Object.fromEntries(DATA_KEYS.map(key=>[key,localStorage.getItem(key)]))}
function downloadJson(data,filename){const blob=new Blob([JSON.stringify(data)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function backupFilename(){const now=new Date(),stamp=[now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0"),"-",String(now.getHours()).padStart(2,"0"),String(now.getMinutes()).padStart(2,"0")].join("");return`retail-pos-backup-${stamp}.json`}
async function exportBackup(){els.error.textContent="";els.exportBtn.disabled=true;els.exportProgress.hidden=false;try{const [firebaseData,images]=await Promise.all([collectFirebaseData(),withTimeout(exportProductImages(),15000,"การรวบรวมรูปสินค้าใช้เวลานานเกินไป กรุณารีเฟรชหน้าแล้วลองใหม่")]);downloadJson({app:"retail-pos",version:BACKUP_VERSION,exportedAt:new Date().toISOString(),firebase:firebaseData,localStorage:collectLocalStorageData(),productImages:images},backupFilename());showToast("สร้างไฟล์สำรองเรียบร้อยแล้ว")}catch(error){els.error.textContent=error.message||"สร้างไฟล์สำรองไม่สำเร็จ"}finally{els.exportBtn.disabled=false;els.exportProgress.hidden=true}}
function validateBackup(data){if(!data||typeof data!=="object")throw new Error("ไฟล์สำรองไม่ถูกต้อง");if(data.app!=="retail-pos")throw new Error("ไฟล์นี้ไม่ใช่ไฟล์สำรองของ POS ร้านค้าปลีก");if(Number(data.version)>BACKUP_VERSION)throw new Error("ไฟล์สำรองมาจากระบบเวอร์ชันใหม่กว่า กรุณาอัปเดตระบบก่อน");if(!data.firebase&&!data.localStorage)throw new Error("ไม่พบข้อมูล POS ในไฟล์สำรอง");return data}
function parseStoredArray(data,key){try{const raw=data.localStorage?.[key],value=raw?JSON.parse(raw):[];return Array.isArray(value)?value:[]}catch{return[]}}
function backupRows(data,firebaseKey,localKey){return Array.isArray(data.firebase?.[firebaseKey])?data.firebase[firebaseKey]:parseStoredArray(data,localKey)}
function renderRestoreSummary(data){const products=backupRows(data,"products","retail_pos_products_v1"),sales=backupRows(data,"sales","retail_pos_sales_v1"),returns=backupRows(data,"returns","retail_pos_returns_v1"),customers=backupRows(data,"customers","retail_pos_customers_v1"),ledger=backupRows(data,"loyaltyLedger","retail_pos_loyalty_ledger_v1"),purchases=backupRows(data,"purchases","retail_pos_purchases_v1"),suppliers=backupRows(data,"suppliers","retail_pos_suppliers_v1"),stockCounts=backupRows(data,"stockCounts","retail_pos_stock_counts_v1"),shifts=backupRows(data,"shifts","retail_pos_shift_history_v1"),roles=backupRows(data,"roles","retail_pos_roles_v1"),users=backupRows(data,"users","retail_pos_users_v1"),images=Array.isArray(data.productImages)?data.productImages:[];els.restoreSummary.innerHTML=`<div><span>วันที่สำรอง</span><strong>${formatDate(data.exportedAt)}</strong></div><div><span>สินค้า</span><strong>${formatNumber(products.length)}</strong></div><div><span>ยอดขาย</span><strong>${formatNumber(sales.length)}</strong></div><div><span>คืนสินค้า</span><strong>${formatNumber(returns.length)}</strong></div><div><span>ลูกค้า</span><strong>${formatNumber(customers.length)}</strong></div><div><span>รายการแต้ม</span><strong>${formatNumber(ledger.length)}</strong></div><div><span>ใบซื้อ</span><strong>${formatNumber(purchases.length)}</strong></div><div><span>ผู้จำหน่าย</span><strong>${formatNumber(suppliers.length)}</strong></div><div><span>รอบตรวจนับ</span><strong>${formatNumber(stockCounts.length)}</strong></div><div><span>รูปสินค้า</span><strong>${formatNumber(images.length)}</strong></div><div><span>กะ</span><strong>${formatNumber(shifts.length)}</strong></div><div><span>บทบาท</span><strong>${formatNumber(roles.length)}</strong></div><div><span>ผู้ใช้งาน</span><strong>${formatNumber(users.length)}</strong></div><div><span>เวอร์ชันไฟล์</span><strong>${formatNumber(data.version)}</strong></div>`;els.restoreSummary.hidden=false;els.replaceConfirmRow.hidden=false;els.clearSelectedBtn.hidden=false}
function clearSelectedFile(){selectedBackup=null;els.fileInput.value="";els.fileName.textContent="";els.fileName.hidden=true;els.dropzone.classList.remove("has-file");els.restoreSummary.hidden=true;els.replaceConfirmRow.hidden=true;els.clearSelectedBtn.hidden=true;els.replaceConfirm.checked=false;els.restoreBtn.disabled=true;els.error.textContent=""}
async function loadBackupFile(file){if(!file)return;els.error.textContent="";try{if(!file.name.toLowerCase().endsWith(".json"))throw new Error("กรุณาเลือกไฟล์สำรองนามสกุล .json");selectedBackup=validateBackup(JSON.parse(await file.text()));els.fileName.textContent=file.name;els.fileName.hidden=false;els.dropzone.classList.add("has-file");renderRestoreSummary(selectedBackup);els.restoreBtn.disabled=!els.replaceConfirm.checked}catch(error){clearSelectedFile();els.error.textContent=error.message||"อ่านไฟล์สำรองไม่สำเร็จ"}}
function applyLocalStorageData(data){DATA_KEYS.forEach(key=>{const raw=data.localStorage?.[key];if(typeof raw==="string")localStorage.setItem(key,raw);else localStorage.removeItem(key)})}
async function restoreFirebaseData(data){
  for (const [key, collectionName, localKey] of FIREBASE_EXPORTS) {
    const rows = backupRows(data, key, localKey);
    if (!rows.length) continue;
    if (key === "settings") {
      for (const row of rows) await saveRecord(collectionName,row);
    } else {
      await saveRecords(collectionName,rows);
      if (localKey) writeJson(localKey,rows);
    }
  }
}
async function restoreBackup(){if(!selectedBackup||!els.replaceConfirm.checked)return;els.error.textContent="";els.restoreBtn.disabled=true;els.restoreProgress.hidden=false;try{applyLocalStorageData(selectedBackup);await restoreFirebaseData(selectedBackup);await withTimeout(importProductImages(selectedBackup.productImages||[],{clearExisting:true}),15000,"การกู้คืนรูปสินค้าใช้เวลานานเกินไป กรุณาลองใหม่");showToast("กู้คืนข้อมูลเรียบร้อยแล้ว");setTimeout(()=>location.replace("/pos/"),900)}catch(error){els.error.textContent=error.message||"กู้คืนข้อมูลไม่สำเร็จ";els.restoreBtn.disabled=false}finally{els.restoreProgress.hidden=true}}
function acceptFiles(files){const file=[...files].find(item=>item.name?.toLowerCase().endsWith(".json"));if(file)loadBackupFile(file)}
els.exportBtn.addEventListener("click",exportBackup);els.fileInput.addEventListener("change",()=>loadBackupFile(els.fileInput.files?.[0]));els.replaceConfirm.addEventListener("change",()=>{els.restoreBtn.disabled=!selectedBackup||!els.replaceConfirm.checked});els.clearSelectedBtn.addEventListener("click",clearSelectedFile);els.restoreBtn.addEventListener("click",restoreBackup);["dragenter","dragover"].forEach(type=>els.dropzone.addEventListener(type,event=>{event.preventDefault();els.dropzone.classList.add("is-dragover")}));["dragleave","drop"].forEach(type=>els.dropzone.addEventListener(type,event=>{event.preventDefault();els.dropzone.classList.remove("is-dragover")}));els.dropzone.addEventListener("drop",event=>acceptFiles(event.dataTransfer?.files||[]));renderCurrentStats();
