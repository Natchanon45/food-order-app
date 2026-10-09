import {chromium} from "@playwright/test";

const base=process.env.DELIVERY_ICON_TEST_URL||"http://127.0.0.1:5127";
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
let failed=false;
const paths={
 add:'<path d="M12 5v14M5 12h14"/>',
 edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
 delete:'<path d="M3 6h18M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2"/><path d="m19 6-1 14c-.1 1.1-1 2-2 2H8c-1.1 0-1.9-.9-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
};
const icon=name=>'<svg data-delivery-icon="'+name+'" class="delivery-address-action-svg'+(name==="add"?" delivery-address-add-svg":"")+'" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
const html='<html><head><meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<link rel="stylesheet" href="'+base+'/react/parity/css/app.css">'+
 '<link rel="stylesheet" href="'+base+'/react/parity/css/delivery-addresses.css"></head><body class="delivery-page">'+
 '<main style="margin:auto;width:min(100%,540px);padding:8px;box-sizing:border-box">'+
 '<section id="addressBook" class="address-book"><div class="address-book-head">'+
 '<div class="address-book-heading"><strong>ที่อยู่จัดส่งของฉัน</strong><div class="address-book-meta"><span class="address-book-count">2/5 ที่อยู่</span></div></div>'+
 '<button id="addAddressButton" type="button" class="btn btn-primary btn-sm">'+icon("add")+'<span>เพิ่มที่อยู่</span></button></div>'+
 '<div id="addressList" class="address-list"><div class="address-card selected">'+
 '<label class="address-card-choice"><input type="radio" checked name="demo"/><span class="address-card-content"><span class="address-card-title">คอนโด</span><span class="address-card-subtitle">ที่อยู่ที่เลือกจัดส่ง</span></span></label>'+
 '<div class="address-card-actions"><button type="button" class="address-icon-button" aria-label="แก้ไข">'+icon("edit")+'</button>'+
 '<button type="button" class="address-icon-button danger" aria-label="ลบ">'+icon("delete")+'</button></div></div>'+
 '<div class="address-card"><label class="address-card-choice"><input type="radio" name="demo"/><span class="address-card-title">บ้าน</span></label>'+
 '<div class="address-card-actions"><button type="button" class="address-icon-button" aria-label="แก้ไข">'+icon("edit")+'</button>'+
 '<button type="button" class="address-icon-button danger" aria-label="ลบ">'+icon("delete")+'</button></div></div></div></section></main></body></html>';
try{
 for(const width of [320,360,390,440,768,1280]){
  const ctx=await browser.newContext({viewport:{width,height:956}});
  const page=await ctx.newPage();
  await page.setContent(html,{waitUntil:"load",timeout:14000});
  const result=await page.evaluate(()=>{
    const R=e=>e.getBoundingClientRect();
    const btns=[document.getElementById("addAddressButton"),...document.querySelector(".address-card-actions").children];
    const a=btns.map(x=>{const r=R(x),svg=R(x.querySelector("svg"));return {id:x.querySelector("svg").dataset.deliveryIcon,
      w:Math.round(r.width),h:Math.round(r.height),glyph:Math.round(svg.width),
      y:Math.abs((r.top+r.bottom-svg.top-svg.bottom)/2),x:r.left,right:r.right}});
    return {btns:a,cardH:Math.round(R(document.querySelector(".address-card")).height),
      gap:Math.round((a[2].x-a[1].right)*10)/10,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  const square=width<=480?31:33;
  const good=result.btns.map(x=>x.id).join(",")==="add,edit,delete"
   && result.btns.slice(1).every(x=>x.w===square&&x.h===square&&x.glyph>=18&&x.y<=1)
   && result.btns[0].glyph===17&&result.btns[0].y<=1
   && result.gap>=8&&result.cardH<=76&&result.overflow<=1;
  console.log("RESPONSIVE_ADDRESS_ICON_SET_"+width+"_"+(good?"PASS":"FAIL"),JSON.stringify(result));
  if(!good)failed=true;
  await ctx.close();
 }
}catch(error){console.log("RESPONSIVE_ADDRESS_ICON_ERROR",String(error));failed=true}
finally{await browser.close()}
if(failed)process.exitCode=1;else console.log("RESPONSIVE_ADDRESS_ICON_SET_ALL_PASS");
