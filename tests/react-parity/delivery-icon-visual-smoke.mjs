import {chromium} from "@playwright/test";

const root=process.env.DELIVERY_TEST_BASE_URL||"http://127.0.0.1:5107";
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
const saved=[
{id:"home",label:"บ้าน",recipientName:"Tester",recipientPhone:"0811111111",address:"Home for layout check",latitude:13.82984,longitude:100.64208,isDefault:true},
{id:"office",label:"คอนโด",recipientName:"Tester",recipientPhone:"0811111111",address:"Office for layout check",latitude:13.82986,longitude:100.64210,isDefault:false}
];
let failed=false;
try {
for(const width of [320,360,390,440,768,1280]){
 const ctx=await browser.newContext({viewport:{width,height:956},isMobile:width<=440,hasTouch:width<=440});
 await ctx.addInitScript(addresses=>{
  localStorage.setItem("food_order_guest_delivery_profile",JSON.stringify({displayName:"Tester",phone:"0811111111",addresses}));
  Object.defineProperty(navigator,"geolocation",{configurable:true,value:{
   getCurrentPosition:ok=>setTimeout(()=>ok({coords:{latitude:13.82984,longitude:100.64208,accuracy:12}}),80)
  }});
 },saved);
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(root+"/s/saas-test-shop/delivery",{waitUntil:"domcontentloaded",timeout:22000});
 await page.locator("#addressList .address-card").first().waitFor({timeout:18000});
 const data=await page.evaluate(()=>{
  const box=e=>e.getBoundingClientRect();
  const hero=document.querySelector(".hero .hero-title .delivery-hero-scooter");
  const icons=[...document.querySelectorAll(".address-card:first-child .address-icon-button")];
  const rect=box(hero),hs=getComputedStyle(hero);
  const actions=icons.map(el=>{
   const r=box(el),i=box(el.querySelector(".app-icon")),css=getComputedStyle(el);
   return {label:el.getAttribute("aria-label"),icon:el.querySelector("i").className,
    width:Math.round(r.width),height:Math.round(r.height),bg:css.backgroundColor,border:css.borderColor,
    centerDelta:Math.round(((r.y+r.height/2)-(i.y+i.height/2))*10)/10,x:r.x,right:r.right};
  });
  return {viewport:innerWidth,hero:{width:Math.round(rect.width),height:Math.round(rect.height),
    bg:hs.backgroundColor,color:hs.color,borderRadius:hs.borderRadius,font:hs.fontSize,glyph:getComputedStyle(hero,"::before").content,
    iconCenter:Math.round((rect.y+rect.height/2)*10)/10},
    actions,cardH:Math.round(box(icons[0].closest(".address-card")).height),
    horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
 });
 const sep=data.actions[1].x-data.actions[0].right;
 const valid=data.hero.height>=34&&data.hero.height<=38&&data.hero.width===data.hero.height&&
   data.hero.bg==="rgb(237, 250, 241)"&&data.hero.color==="rgb(8, 120, 62)"&&
   data.actions.length===2&&data.actions.every(x=>x.width>=30&&x.height>=30&&x.height<=34&&Math.abs(x.centerDelta)<=1)&&
   data.actions[0].icon.includes("bi-pencil-square")&&data.actions[1].icon.includes("bi-trash3")&&
   data.actions[0].bg==="rgb(237, 243, 239)"&&data.actions[1].bg==="rgb(255, 240, 238)"&&
   sep>=7.9&&data.cardH<=75&&data.horizontalOverflow<=1&&errors.length===0;
 console.log("DELIVERY_ICON_UI_"+width+"_"+(valid?"PASS":"FAIL"),JSON.stringify({...data,gap:+sep.toFixed(1),errors}));
 if(!valid)failed=true;
 // Keep address editor functional without creating or mutating production profiles.
 await page.locator('.address-card:has(input[value="office"]) .address-icon-button').first().click();
 await page.locator("#addressForm").waitFor({timeout:10000});
 await page.locator("#cancelAddressButton").click();
 await page.locator("#addressForm").waitFor({state:"detached",timeout:5000});
 await ctx.close();
}
}catch(e){console.log("DELIVERY_ICON_UI_ERROR",String(e));failed=true}
finally{await browser.close()}
if(failed)process.exitCode=1;else console.log("DELIVERY_ICON_UI_ALL_SIZES_PASS");
