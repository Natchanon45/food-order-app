const KEY="retail_pos_loyalty_settings_v1";
const defaults={enabled:true,spendPerPoint:10,pointValue:1};
function read(){try{return{...defaults,...(JSON.parse(localStorage.getItem(KEY))||{})}}catch{return{...defaults}}}
function save(value){localStorage.setItem(KEY,JSON.stringify(value))}
const form=document.querySelector("#storeSettingsForm");
if(form&&!document.querySelector("#loyaltySettingsSection")){
  const section=document.createElement("section");
  section.id="loyaltySettingsSection";
  section.innerHTML=`<h2>ระบบสะสมแต้มสมาชิก</h2><div class="settings-grid"><label>เปิดใช้งานระบบแต้ม<select id="loyaltyEnabled"><option value="1">เปิดใช้งาน</option><option value="0">ปิดใช้งาน</option></select></label><label>ยอดซื้อที่ได้รับ 1 แต้ม<input id="loyaltySpendPerPoint" type="number" min="0.01" step="0.01"></label><label>มูลค่าต่อ 1 แต้ม<input id="loyaltyPointValue" type="number" min="0.01" step="0.01"></label></div><div class="loyalty-settings-preview"><div><span>ตัวอย่างยอดซื้อ</span><strong id="loyaltyExampleSpend">100.00 บาท</strong></div><div><span>แต้มที่ได้รับ</span><strong id="loyaltyExampleEarn">10 แต้ม</strong></div><div><span>มูลค่า 10 แต้ม</span><strong id="loyaltyExampleValue">10.00 บาท</strong></div></div>`;
  form.querySelector(".settings-actions")?.insertAdjacentElement("beforebegin",section);
}
const enabled=document.querySelector("#loyaltyEnabled"),spend=document.querySelector("#loyaltySpendPerPoint"),value=document.querySelector("#loyaltyPointValue"),exampleSpend=document.querySelector("#loyaltyExampleSpend"),exampleEarn=document.querySelector("#loyaltyExampleEarn"),exampleValue=document.querySelector("#loyaltyExampleValue");
function fill(){const s=read();enabled.value=s.enabled?"1":"0";spend.value=s.spendPerPoint;value.value=s.pointValue;preview()}
function collect(){return{enabled:enabled.value==="1",spendPerPoint:Math.max(.01,Number(spend.value||defaults.spendPerPoint)),pointValue:Math.max(.01,Number(value.value||defaults.pointValue))}}
function preview(){const s=collect(),sample=100,points=Math.floor(sample/s.spendPerPoint);exampleSpend.textContent=`${sample.toFixed(2)} บาท`;exampleEarn.textContent=`${points.toLocaleString("th-TH")} แต้ม`;exampleValue.textContent=`${(10*s.pointValue).toFixed(2)} บาท`}
form?.addEventListener("input",preview);
form?.addEventListener("submit",()=>save(collect()),true);
document.querySelector("#resetSettingsBtn")?.addEventListener("click",()=>{localStorage.removeItem(KEY);setTimeout(fill,0)},true);
fill();