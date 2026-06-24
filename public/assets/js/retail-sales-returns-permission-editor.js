const ROLE_KEY="retail_pos_roles_v1";
const GROUPS=[
  {id:"sales_history_actions",label:"ประวัติการขาย",items:[
    {key:"pos.sales.view_bill",label:"ดูรายละเอียดบิล"},
    {key:"pos.sales.print_bill",label:"พิมพ์ใบเสร็จย้อนหลัง"},
    {key:"pos.sales.export",label:"ส่งออกข้อมูลการขาย CSV"}
  ]},
  {id:"return_actions",label:"คืนสินค้า",items:[
    {key:"pos.returns.create",label:"ยืนยันคืนสินค้าและคืนเงิน"},
    {key:"pos.returns.print",label:"ดูและพิมพ์ใบรับคืน"}
  ]}
];

function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function esc(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char])}
function selectedPermissions(){
  const roleId=document.querySelector("#roleId")?.value;
  return read(ROLE_KEY,[]).find(role=>role.id===roleId)?.permissions||[];
}
function groupHtml(group,selected){
  const checked=group.items.filter(item=>selected.includes(item.key)).length;
  return`<section class="permission-group-card" data-extra-permission-group="${esc(group.id)}"><div class="permission-group-head"><strong>${esc(group.label)}</strong><button type="button" class="permission-group-toggle" data-extra-toggle-group>${checked===group.items.length?"ยกเลิกทั้งหมด":"เลือกทั้งหมด"}</button></div><div class="permission-group-items">${group.items.map(item=>`<label class="permission-checkbox"><input type="checkbox" value="${esc(item.key)}" ${selected.includes(item.key)?"checked":""}><span>${esc(item.label)}</span></label>`).join("")}</div></section>`;
}
function updateSummary(block){
  const inputs=[...block.querySelectorAll('input[type="checkbox"]')];
  const badge=block.querySelector(".permission-block-count");
  if(badge)badge.textContent=`เลือก ${inputs.filter(input=>input.checked).length}/${inputs.length}`;
  block.querySelectorAll("[data-extra-permission-group]").forEach(card=>{
    const groupInputs=[...card.querySelectorAll('input[type="checkbox"]')];
    const button=card.querySelector("[data-extra-toggle-group]");
    if(button)button.textContent=groupInputs.length&&groupInputs.every(input=>input.checked)?"ยกเลิกทั้งหมด":"เลือกทั้งหมด";
  });
}
function inject(){
  const container=document.querySelector("#permissionCheckboxes");
  if(!container||container.querySelector("#salesReturnsPermissionBlock"))return;
  const selected=selectedPermissions();
  const total=GROUPS.flatMap(group=>group.items).length;
  const checked=GROUPS.flatMap(group=>group.items).filter(item=>selected.includes(item.key)).length;
  container.insertAdjacentHTML("beforeend",`<section id="salesReturnsPermissionBlock" class="permission-block"><div class="permission-block-head"><div><h4>สิทธิ์ประวัติการขายและคืนสินค้า</h4><p>ควบคุมการเปิดบิลย้อนหลัง ส่งออกข้อมูล และการคืนเงิน</p></div><span class="permission-block-count">เลือก ${checked}/${total}</span></div><div class="permission-group-grid">${GROUPS.map(group=>groupHtml(group,selected)).join("")}</div></section>`);
}

document.addEventListener("click",event=>{
  const button=event.target.closest("[data-extra-toggle-group]");
  if(!button)return;
  const card=button.closest("[data-extra-permission-group]");
  const inputs=[...card.querySelectorAll('input[type="checkbox"]')];
  const next=!inputs.every(input=>input.checked);
  inputs.forEach(input=>input.checked=next);
  updateSummary(card.closest(".permission-block"));
});
document.addEventListener("change",event=>{
  if(event.target.closest("#salesReturnsPermissionBlock"))updateSummary(event.target.closest(".permission-block"));
});

const target=document.querySelector("#permissionCheckboxes");
if(target)new MutationObserver(()=>queueMicrotask(inject)).observe(target,{childList:true});
setTimeout(inject,0);
