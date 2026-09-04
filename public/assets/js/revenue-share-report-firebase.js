import { functions, storage, ref, uploadBytes, deleteObject, getDownloadURL, httpsCallable } from "./firebase-config.js?v=20260630-073";
import { resolveTenantContext } from "./tenant-context.js?v=20260903-201";
import { toast } from "./ui.js?v=20260731-080";

const callAccess = httpsCallable(functions, "getTenantRevenueShareAccess");
const callSummary = httpsCallable(functions, "getTenantRevenueShareSummary");
const callPayments = httpsCallable(functions, "listTenantRevenueSharePayments");
const callSubmit = httpsCallable(functions, "submitTenantRevenueSharePayment");

const TEXT = {
  th: {
    "meta.title":"ยอดขายและส่วนแบ่ง","header.title":"ยอดขายและส่วนแบ่ง","header.back":"กลับ","hero.private":"เฉพาะเจ้าของร้านและผู้ดูแลระบบ","hero.title":"ยอดขายและส่วนแบ่ง","hero.description":"สรุปยอดออเดอร์ร้านอาหารและ Retail POS เฉพาะร้านของคุณ พร้อมคำนวณส่วนแบ่งตามอัตราที่ระบบกลางกำหนด",
    "actions.refresh":"รีเฟรช","actions.submitSlip":"ส่งสลิปเพื่อตรวจสอบ","actions.viewSlip":"ดูสลิป","actions.previewSelected":"ดูไฟล์ที่เลือก","actions.removeSelected":"ลบไฟล์","actions.close":"ปิด",
    "period.title":"ช่วงเวลารายงาน","period.description":"เลือกดูรายวัน รายเดือน รายปี หรือกำหนดช่วงเอง","period.daily":"รายวัน","period.monthly":"รายเดือน","period.yearly":"รายปี","period.custom":"กำหนดเอง","period.date":"วันที่","period.month":"เดือน","period.year":"ปี","period.start":"วันที่เริ่มต้น","period.end":"วันที่สิ้นสุด",
    "summary.orderSales":"ยอดออเดอร์ร้านอาหาร","summary.posSales":"Retail POS","summary.combinedSales":"ยอดขายรวม","summary.revenueShare":"ส่วนแบ่งรวม","summary.revenueShareRate":"ส่วนแบ่ง :rate%",
    "explanation.title":"การคำนวณส่วนแบ่ง","explanation.loading":"กำลังโหลดอัตราส่วนแบ่ง","explanation.enabled":"ยอดขายรวม :sales บาท × :rate% = ส่วนแบ่ง :share บาท","explanation.disabled":"ระบบกลางยังไม่ได้เปิดใช้งานการคิดส่วนแบ่งสำหรับร้านนี้",
    "payment.title":"แจ้งโอนส่วนแบ่งการขาย","payment.description":"แนบสลิปของช่วงรายงานที่เลือก ระบบจะบันทึกยอดและอัตราส่วนแบ่ง ณ เวลาที่ส่ง","payment.selectedPeriod":"งวดที่เลือก","payment.amountDue":"ยอดส่วนแบ่งที่ต้องโอน","payment.billingCycle":"รอบชำระ :cycle","payment.cycleMismatch":"การแนบสลิปของร้านนี้กำหนดเป็นรอบ:cycle กรุณาเลือกตัวกรอง:cycle","payment.daily":"รายวัน","payment.monthly":"รายเดือน","payment.slip":"สลิปการโอนเงิน","payment.slipHelp":"รองรับ JPG, PNG, WEBP หรือ PDF ขนาดไม่เกิน 10 MB","payment.slipRequired":"กรุณาเลือกไฟล์สลิปก่อนส่ง","payment.slipType":"รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ PDF เท่านั้น","payment.slipLarge":"ไฟล์สลิปต้องมีขนาดไม่เกิน 10 MB","payment.chooseFile":"เลือกไฟล์สลิป","payment.noFile":"ยังไม่ได้เลือกไฟล์","payment.historyTitle":"ประวัติการส่งสลิป","payment.slipTitle":"ดูสลิปการโอนเงิน","payment.historyDescription":"แสดงรายการล่าสุดไม่เกิน 50 รายการ","payment.empty":"ยังไม่มีประวัติการส่งสลิป","payment.submittedAt":"ส่งเมื่อ :date","payment.rate":"อัตรา :rate%","payment.reviewNote":"หมายเหตุจาก Super Admin","payment.pending":"รอตรวจสอบ","payment.approved":"ยืนยันแล้ว","payment.rejected":"ไม่ผ่านการตรวจสอบ","payment.ocrMatched":"Vision OCR พบยอด :amount บาท ตรงกับยอดส่วนแบ่ง รอ Super Admin ยืนยันเงินจริง","payment.ocrMismatch":"Vision OCR พบยอด :amount บาท ซึ่งไม่ตรงกับยอดส่วนแบ่ง กรุณาตรวจสอบสลิป","payment.ocrUnreadable":"Vision OCR อ่านยอดเงินจากสลิปไม่ได้ รายการนี้ต้องตรวจด้วยคน","payment.ocrManual":"รายการนี้ต้องตรวจสลิปด้วยคน",
    "common.baht":"บาท","common.orders":":count ออเดอร์","common.receipts":":count ใบเสร็จ","states.loading":"กำลังโหลด...","states.loadFailed":"โหลดรายงานไม่สำเร็จ กรุณาลองอีกครั้ง","states.uploading":"กำลังส่งสลิป...","states.uploadSuccess":"ส่งสลิปเรียบร้อยแล้ว รอ Super Admin ตรวจสอบ","states.uploadFailed":"ส่งสลิปไม่สำเร็จ กรุณาตรวจสอบไฟล์แล้วลองอีกครั้ง","states.duplicate":"งวดนี้มีรายการที่รอตรวจสอบหรือยืนยันแล้ว","states.historyFailed":"โหลดประวัติการส่งสลิปไม่สำเร็จ","states.slipFailed":"เปิดสลิปไม่สำเร็จ กรุณาลองอีกครั้ง"
  },
  en: {
    "meta.title":"Sales and Revenue Share","header.title":"Sales and Revenue Share","header.back":"Back","hero.private":"Owner and administrators only","hero.title":"Sales and Revenue Share","hero.description":"Review your store’s food-order and Retail POS sales, with platform revenue share calculated using the centrally configured rate.",
    "actions.refresh":"Refresh","actions.submitSlip":"Submit slip for review","actions.viewSlip":"View slip","actions.previewSelected":"Preview selected file","actions.removeSelected":"Remove file","actions.close":"Close",
    "period.title":"Report period","period.description":"View daily, monthly, yearly, or custom date ranges.","period.daily":"Daily","period.monthly":"Monthly","period.yearly":"Yearly","period.custom":"Custom","period.date":"Date","period.month":"Month","period.year":"Year","period.start":"Start date","period.end":"End date",
    "summary.orderSales":"Food-order sales","summary.posSales":"Retail POS","summary.combinedSales":"Combined sales","summary.revenueShare":"Revenue share","summary.revenueShareRate":"Revenue share :rate%",
    "explanation.title":"Revenue-share calculation","explanation.loading":"Loading the revenue-share rate.","explanation.enabled":"Combined sales THB :sales × :rate% = THB :share revenue share.","explanation.disabled":"Platform revenue share has not been enabled for this store.",
    "payment.title":"Report a revenue-share transfer","payment.description":"Attach the transfer slip for the selected report period. The sales and rate are recorded when submitted.","payment.selectedPeriod":"Selected period","payment.amountDue":"Revenue share due","payment.billingCycle":":cycle payment cycle","payment.cycleMismatch":"Slip submission is configured for the :cycle cycle. Select the :cycle report filter.","payment.daily":"daily","payment.monthly":"monthly","payment.slip":"Transfer slip","payment.slipHelp":"JPG, PNG, WEBP, or PDF up to 10 MB","payment.slipRequired":"Choose a transfer slip before submitting.","payment.slipType":"Only JPG, PNG, WEBP, or PDF files are supported.","payment.slipLarge":"The transfer slip must be 10 MB or smaller.","payment.chooseFile":"Choose slip file","payment.noFile":"No file selected","payment.historyTitle":"Slip submission history","payment.slipTitle":"Transfer slip","payment.historyDescription":"Shows up to the 50 most recent submissions.","payment.empty":"No slip has been submitted yet.","payment.submittedAt":"Submitted :date","payment.rate":"Rate :rate%","payment.reviewNote":"Super Admin note","payment.pending":"Pending review","payment.approved":"Approved","payment.rejected":"Rejected","payment.ocrMatched":"Vision OCR detected THB :amount and it matches the revenue share due. Waiting for Super Admin to confirm the actual transfer.","payment.ocrMismatch":"Vision OCR detected THB :amount, which does not match the revenue share due. Please verify the slip.","payment.ocrUnreadable":"Vision OCR could not read the transfer amount. Manual review is required.","payment.ocrManual":"This slip requires manual review.",
    "common.baht":"THB","common.orders":":count orders","common.receipts":":count receipts","states.loading":"Loading...","states.loadFailed":"Could not load the report. Please try again.","states.uploading":"Submitting slip...","states.uploadSuccess":"Slip submitted. It is waiting for Super Admin review.","states.uploadFailed":"Could not submit the slip. Check the file and try again.","states.duplicate":"This period already has a pending or approved submission.","states.historyFailed":"Could not load the slip submission history.","states.slipFailed":"Could not open the slip. Please try again."
  }
};

let locale = localStorage.getItem("food_order_locale") === "en" ? "en" : "th";
const els = {
  refresh: document.querySelector("#refreshRevenueShare"), periodLabel: document.querySelector("#reportPeriodLabel"), date: document.querySelector("#reportDate"), month: document.querySelector("#reportMonth"), year: document.querySelector("#reportYear"), start: document.querySelector("#reportStartDate"), end: document.querySelector("#reportEndDate"), orderSales: document.querySelector("#orderSales"), orderCount: document.querySelector("#orderCount"), posSales: document.querySelector("#posSales"), posCount: document.querySelector("#posCount"), combinedSales: document.querySelector("#combinedSales"), revenueShare: document.querySelector("#revenueShare"), shareRateLabel: document.querySelector("#shareRateLabel"), explanation: document.querySelector("#shareExplanation"), error: document.querySelector("#revenueShareError"), paymentForm: document.querySelector("#revenueSharePaymentForm"), slip: document.querySelector("#revenueShareSlip"), slipName: document.querySelector("#revenueShareSlipName"), slipError: document.querySelector("#revenueShareSlipError"), slipSelected: document.querySelector("#revenueShareSlipSelected"), selectedName: document.querySelector("#revenueShareSelectedName"), selectedSize: document.querySelector("#revenueShareSelectedSize"), previewSelected: document.querySelector("#previewRevenueShareSlip"), removeSelected: document.querySelector("#removeRevenueShareSlip"), submitSlip: document.querySelector("#submitRevenueShareSlip"), paymentPeriod: document.querySelector("#paymentPeriodLabel"), paymentAmount: document.querySelector("#paymentAmountDue"), paymentBillingCycle: document.querySelector("#paymentBillingCycle"), paymentMessage: document.querySelector("#revenueSharePaymentMessage"), paymentHistory: document.querySelector("#revenueSharePaymentHistory"), slipDialog: document.querySelector("#revenueShareSlipDialog"), slipImage: document.querySelector("#revenueShareSlipImage"), slipFrame: document.querySelector("#revenueShareSlipFrame"), slipPeriod: document.querySelector("#revenueShareSlipPeriod")
};
const state = { period: "daily", loading: false, uploading: false, initialized: false, summary: {}, payments: [], selectedSlipUrl: "" };
const MAX_SLIP_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

function t(key, vars = {}) { let value = TEXT[locale]?.[key] ?? TEXT.th[key] ?? key; Object.entries(vars).forEach(([name, item]) => { value = value.replaceAll(`:${name}`, String(item)); }); return value; }
function applyLocale() { document.documentElement.lang = locale; document.title = t("meta.title"); localStorage.setItem("food_order_locale", locale); document.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = t(node.dataset.i18n); }); render(state.summary); renderPaymentHistory(state.payments); }
function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function monthKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
function money(value) { return Number(value || 0).toLocaleString(locale === "th" ? "th-TH" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function count(value) { return Number(value || 0).toLocaleString(locale === "th" ? "th-TH" : "en-US"); }
function displayDate(value) { if (!value) return "-"; return new Date(`${value}T12:00:00`).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { year:"numeric", month:"short", day:"numeric" }); }
function displayMonth(value) { if (!value) return "-"; return new Date(`${value}-01T12:00:00`).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", { year:"numeric", month:"long" }); }
function escapeHtml(value="") { return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]); }
function periodLabel() { if (state.period === "daily") return displayDate(els.date.value); if (state.period === "monthly") return displayMonth(els.month.value); if (state.period === "yearly") return els.year.value || "-"; return `${displayDate(els.start.value)} – ${displayDate(els.end.value)}`; }
function periodDateText(value="") { return String(value||"-").replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,(_,year,month,day)=>`${day}/${month}/${year}`); }
function periodPayload() { const payload = { period: state.period }; if (state.period === "daily") payload.date = els.date.value; if (state.period === "monthly") payload.month = els.month.value; if (state.period === "yearly") payload.year = els.year.value; if (state.period === "custom") { payload.startDate = els.start.value; payload.endDate = els.end.value; } return payload; }
function setError(message="") { els.error.textContent = message; els.error.hidden = !message; }
function setPaymentMessage(message="", error=false) { els.paymentMessage.textContent = message; els.paymentMessage.classList.toggle("error", error); els.paymentMessage.hidden = !message; }
function setSlipError(message="") { els.slipError.textContent = message; els.slipError.hidden = !message; els.slip.closest(".report-slip-field")?.classList.toggle("has-error", Boolean(message)); }
function setLoading(value) { state.loading = value; els.refresh.disabled = value; els.refresh.innerHTML = value ? `<span class="tenant-button-spinner"></span><span>${t("states.loading")}</span>` : `<i class="bi bi-arrow-clockwise"></i><span>${t("actions.refresh")}</span>`; }
function cycleLabel(cycle) { return t(cycle === "daily" ? "payment.daily" : "payment.monthly"); }

function render(summary = {}) {
  if (!summary || !Object.keys(summary).length) return;
  state.summary = summary;
  const rate = money(summary.revenueShareRate);
  els.orderSales.textContent = money(summary.orderSales); els.orderCount.textContent = t("common.orders", { count: count(summary.orderCount) });
  els.posSales.textContent = money(summary.posSales); els.posCount.textContent = t("common.receipts", { count: count(summary.posCount) });
  els.combinedSales.textContent = money(summary.combinedSales); els.revenueShare.textContent = money(summary.revenueShare);
  els.shareRateLabel.textContent = t("summary.revenueShareRate", { rate });
  const billingCycle = summary.revenueShareBillingCycle === "daily" ? "daily" : "monthly";
  const matches = state.period === billingCycle;
  els.paymentPeriod.textContent = periodLabel(); els.paymentAmount.textContent = money(summary.revenueShare); els.paymentBillingCycle.textContent = t("payment.billingCycle", { cycle: cycleLabel(billingCycle) });
  els.submitSlip.disabled = state.uploading || Number(summary.revenueShare || 0) <= 0 || !matches;
  setPaymentMessage(matches ? "" : t("payment.cycleMismatch", { cycle: cycleLabel(billingCycle) }), !matches);
  els.explanation.textContent = t("explanation.enabled", { sales: money(summary.combinedSales), rate, share: money(summary.revenueShare) });
}

async function loadReport() {
  if (state.loading) return;
  setLoading(true); setError("");
  try {
    const result = await callSummary(periodPayload());
    const summary = result.data?.summary || {};
    const billingCycle = summary.revenueShareBillingCycle === "daily" ? "daily" : "monthly";
    if (!state.initialized && state.period !== billingCycle) { state.initialized = true; queueMicrotask(() => selectPeriod(billingCycle)); return; }
    state.initialized = true; els.periodLabel.textContent = periodLabel(); render(summary);
  } catch (error) { console.error(error); setError(t("states.loadFailed")); }
  finally { setLoading(false); }
}

function validationMessage(file) { if (!file) return t("payment.slipRequired"); if (Number(file.size || 0) > MAX_SLIP_SIZE) return t("payment.slipLarge"); const mime = String(file.type || "").toLowerCase(); const ext = String(file.name || "").split(".").pop()?.toLowerCase() || ""; if ((mime && !ALLOWED_TYPES.has(mime)) || !ALLOWED_EXT.has(ext)) return t("payment.slipType"); return ""; }
function validateSlip(file, announce=false) { const message = validationMessage(file); setSlipError(message); if (message && announce) toast(message, "error"); return !message; }
function formatFileSize(bytes=0) { const size=Number(bytes||0); if(size<1024)return`${size} B`; if(size<1048576)return`${(size/1024).toFixed(1)} KB`; return`${(size/1048576).toFixed(2)} MB`; }
function revokeSelectedSlipUrl() { if (!state.selectedSlipUrl) return; URL.revokeObjectURL(state.selectedSlipUrl); state.selectedSlipUrl=""; }
function renderSelectedSlip(file=null) { revokeSelectedSlipUrl(); const yes=Boolean(file); els.slipSelected.hidden=!yes; els.selectedName.textContent=file?.name||"-"; els.selectedSize.textContent=yes?formatFileSize(file.size):"-"; if(yes)state.selectedSlipUrl=URL.createObjectURL(file); }
function clearSelectedSlip(preserveError=false) { els.slip.value=""; els.slipName.textContent=t("payment.noFile"); if(!preserveError)setSlipError(""); renderSelectedSlip(null); }

function closeSlip() { if (els.slipDialog.open && typeof els.slipDialog.close === "function") els.slipDialog.close(); else els.slipDialog.removeAttribute("open"); els.slipImage.removeAttribute("src"); els.slipImage.hidden=true; els.slipFrame.src="about:blank"; els.slipFrame.hidden=true; document.body.classList.remove("tenant-modal-open"); }
function openSlip(item, url) { const image=String(item.slip?.mime||"").startsWith("image/"); els.slipPeriod.textContent=periodDateText(item.period?.label||item.slip?.name||"-"); els.slipImage.hidden=!image; els.slipFrame.hidden=image; if(image){els.slipImage.src=url;els.slipFrame.src="about:blank";}else{els.slipImage.removeAttribute("src");els.slipFrame.src=url;} if(typeof els.slipDialog.showModal==="function")els.slipDialog.showModal();else els.slipDialog.setAttribute("open",""); document.body.classList.add("tenant-modal-open"); }
function previewSelectedSlip() { const file=els.slip.files?.[0]||null; if(!file||!state.selectedSlipUrl)return; openSlip({period:{label:file.name},slip:{mime:file.type,name:file.name}},state.selectedSlipUrl); }
async function viewStoredSlip(item) { try { const url=await getDownloadURL(ref(storage,item.slip.path)); openSlip(item,url); } catch(error){ console.error(error); toast(t("states.slipFailed"),"error"); } }
function statusLabel(status) { return t(`payment.${["pending","approved","rejected"].includes(status)?status:"pending"}`); }
function ocrMessage(ocr={}) { const status=String(ocr?.status||""); const amount=ocr?.detectedAmount===null||ocr?.detectedAmount===undefined?"-":money(ocr.detectedAmount); if(status==="matched")return t("payment.ocrMatched",{amount}); if(status==="mismatch")return t("payment.ocrMismatch",{amount}); if(status==="unreadable")return t("payment.ocrUnreadable"); if(status==="manual_review")return t("payment.ocrManual"); return ""; }
function ocrMarkup(item={}) { const message=ocrMessage(item.ocr||{}); if(!message)return""; const status=["matched","mismatch","unreadable","manual_review"].includes(item.ocr?.status)?item.ocr.status:"manual_review"; const icon=status==="matched"?"bi-check-circle":status==="mismatch"?"bi-exclamation-triangle":"bi-eye"; return `<div class="report-history-ocr ${status}"><i class="bi ${icon}" aria-hidden="true"></i><span>${escapeHtml(message)}</span></div>`; }
function renderPaymentHistory(items=[]) { state.payments=items||[]; if(!els.paymentHistory)return; if(!state.payments.length){els.paymentHistory.innerHTML=`<div class="report-history-empty">${t("payment.empty")}</div>`;return;} els.paymentHistory.innerHTML=state.payments.map(item=>{ const date=item.submittedAt?new Date(item.submittedAt).toLocaleString(locale==="th"?"th-TH":"en-US",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"-"; const status=["pending","approved","rejected"].includes(item.status)?item.status:"pending"; return `<article class="report-history-item"><div class="report-history-main"><strong>${escapeHtml(periodDateText(item.period?.label||"-"))}</strong><small>${escapeHtml(t("payment.submittedAt",{date}))}</small></div><div class="report-history-value"><span>${t("payment.amountDue")}</span><strong>${money(item.revenueShareAmount)} ${t("common.baht")}</strong></div><div class="report-history-value"><span>${escapeHtml(t("payment.rate",{rate:money(item.revenueShareRate)}))}</span><span class="report-status ${status}">${escapeHtml(statusLabel(status))}</span></div>${ocrMarkup(item)}${item.reviewNote?`<div class="report-history-note"><strong>${escapeHtml(t("payment.reviewNote"))}</strong><span>${escapeHtml(item.reviewNote)}</span></div>`:""}<div class="report-history-actions"><button class="btn btn-sm" type="button" data-report-view-slip="${escapeHtml(item.id)}"><i class="bi bi-receipt"></i><span>${t("actions.viewSlip")}</span></button></div></article>`; }).join(""); }
async function loadPaymentHistory() { try { const result=await callPayments({}); renderPaymentHistory(result.data?.items||[]); } catch(error){console.error(error);els.paymentHistory.innerHTML=`<div class="report-history-empty">${t("states.historyFailed")}</div>`;} }

async function submitPayment(event) {
  event.preventDefault(); if(state.uploading)return;
  const file=els.slip.files?.[0]||null; if(!validateSlip(file,true))return;
  const tenant=resolveTenantContext(); const paymentId=(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g,"-"); const ext=String(file.name||"").split(".").pop()?.toLowerCase()||"bin"; const safeExt=ALLOWED_EXT.has(ext)?ext:"bin"; const path=`tenants/${tenant.id}/revenue-share-slips/${paymentId}/slip.${safeExt}`; const fileRef=ref(storage,path);
  state.uploading=true; els.submitSlip.disabled=true; els.submitSlip.innerHTML=`<span class="tenant-button-spinner"></span><span>${t("states.uploading")}</span>`; setPaymentMessage("");
  let uploaded=false;
  try {
    await uploadBytes(fileRef,file,{contentType:file.type,customMetadata:{tenantId:tenant.id,paymentId}}); uploaded=true;
    const submitted=await callSubmit({ ...periodPayload(), paymentId, slipPath:path, slipName:file.name });
    const submittedItem=submitted.data?.item||{}; const ocrNotice=ocrMessage(submittedItem.ocr||{});
    els.paymentForm.reset(); clearSelectedSlip(); setPaymentMessage(ocrNotice||t("states.uploadSuccess"), submittedItem.ocr?.status==="mismatch"); await loadPaymentHistory();
  } catch(error) {
    console.error(error); if(uploaded){try{await deleteObject(fileRef);}catch(cleanupError){console.warn("Revenue-share slip cleanup skipped",cleanupError);}}
    const code=String(error?.code||""); const message=code.includes("already-exists")?t("states.duplicate"):code.includes("failed-precondition")?t("payment.cycleMismatch",{cycle:cycleLabel(state.summary?.revenueShareBillingCycle)}):t("states.uploadFailed"); setPaymentMessage(message,true); toast(message,"error");
  } finally { state.uploading=false; els.submitSlip.innerHTML=`<i class="bi bi-cloud-arrow-up"></i><span>${t("actions.submitSlip")}</span>`; const cycle=state.summary?.revenueShareBillingCycle==="daily"?"daily":"monthly"; els.submitSlip.disabled=Number(state.summary?.revenueShare||0)<=0||state.period!==cycle; }
}

function selectPeriod(period) { state.period=period; document.querySelectorAll("[data-report-period]").forEach(button=>{const selected=button.dataset.reportPeriod===period;button.classList.toggle("active",selected);button.setAttribute("aria-selected",selected?"true":"false");}); document.querySelectorAll("[data-period-control]").forEach(control=>{control.hidden=control.dataset.periodControl!==period;}); loadReport(); }

const now=new Date(); els.date.value=localDateKey(now); els.month.value=monthKey(now); els.start.value=localDateKey(now); els.end.value=localDateKey(now); for(let year=now.getFullYear();year>=now.getFullYear()-7;year-=1){const option=document.createElement("option");option.value=String(year);option.textContent=String(year);els.year.appendChild(option);}
document.querySelectorAll("[data-report-period]").forEach(button=>button.addEventListener("click",()=>selectPeriod(button.dataset.reportPeriod))); [els.date,els.month,els.year,els.start,els.end].forEach(control=>control.addEventListener("change",loadReport)); els.refresh.addEventListener("click",loadReport);
els.slip.addEventListener("change",()=>{const file=els.slip.files?.[0]||null;els.slipName.textContent=file?.name||t("payment.noFile");setPaymentMessage("");setSlipError("");if(!file){renderSelectedSlip(null);return;}if(validateSlip(file,true)){renderSelectedSlip(file);return;}clearSelectedSlip(true);}); els.previewSelected.addEventListener("click",previewSelectedSlip); els.removeSelected.addEventListener("click",()=>clearSelectedSlip()); els.paymentForm.addEventListener("submit",submitPayment);
els.paymentHistory.addEventListener("click",event=>{const button=event.target.closest("[data-report-view-slip]");if(!button)return;const item=state.payments.find(row=>row.id===button.dataset.reportViewSlip);if(item)viewStoredSlip(item);}); document.querySelectorAll("[data-close-report-slip]").forEach(button=>button.addEventListener("click",closeSlip)); els.slipDialog.addEventListener("cancel",event=>event.preventDefault()); window.addEventListener("beforeunload",revokeSelectedSlipUrl);

try {
  const access=(await callAccess({})).data||{};
  if(access.enabled!==true){
    location.replace("/");
  } else {
    document.body.dataset.revenueShareReady="1";
    applyLocale();
    await Promise.all([loadReport(),loadPaymentHistory()]);
  }
} catch(error){
  console.error(error);
  document.body.dataset.revenueShareReady="1";
  applyLocale();
  setError(t("states.loadFailed"));
}
