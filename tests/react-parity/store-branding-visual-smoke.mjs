import {chromium} from "@playwright/test";

const root=process.env.DELIVERY_TEST_BASE_URL || "http://127.0.0.1:5113";
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
let failed=false;
const guestAddresses=[
 {id:"home",label:"บ้าน",recipientName:"Tester",recipientPhone:"0811111111",address:"Test home",latitude:13.82984,longitude:100.64208,isDefault:true},
 {id:"office",label:"คอนโด",recipientName:"Tester",recipientPhone:"0811111111",address:"Test office",latitude:13.82986,longitude:100.64210,isDefault:false},
];
try{
 for(const width of [320,360,390,440,768,1280]){
  const ctx=await browser.newContext({viewport:{width,height:956},isMobile:width<=440,hasTouch:width<=440});
  await ctx.addInitScript(addresses=>{
   localStorage.setItem("food_order_guest_delivery_profile",JSON.stringify({displayName:"Tester",phone:"0811111111",addresses}));
   Object.defineProperty(navigator,"geolocation",{configurable:true,value:{
    getCurrentPosition:ok=>setTimeout(()=>ok({coords:{latitude:13.82984,longitude:100.64208,accuracy:12}}),80)
   }});
  },guestAddresses);
  const page=await ctx.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(root+"/s/saas-test-shop/delivery",{waitUntil:"domcontentloaded",timeout:23000});
  await page.locator("#addressList .address-card").first().waitFor({timeout:17000});
  await page.addStyleTag({url:root+"/react/parity/css/admin-store-branding.css"});
  const metrics=await page.evaluate(()=>{
   const R=e=>e.getBoundingClientRect();
   const hero=document.querySelector(".hero.store-branded-hero");
   const mark=hero.querySelector(".store-hero-brand-mark");
   const buttons=[...document.querySelectorAll("#addressList .address-card:first-child .address-icon-button")];
   // A visual fixture previews a real image background without uploading to
   // customer Storage or changing store Firestore settings.
   const fixture=document.createElement("section");
   fixture.className="hero store-branded-hero";
   fixture.id="shopHeroVisualFixture";
   fixture.style.width="min(100%,520px)";
   fixture.style.backgroundImage='linear-gradient(90deg,rgba(6,30,20,.88),rgba(8,55,33,.45)),url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221000%22 height=%22500%22%3E%3Crect width=%221000%22 height=%22500%22 fill=%22%237cba79%22/%3E%3Ccircle cx=%22750%22 cy=%22250%22 r=%22190%22 fill=%22%23f9e7b8%22/%3E%3C/svg%3E")';
   fixture.innerHTML='<h1 class="hero-title"><span class="store-hero-brand-mark"><img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect width=%2280%22 height=%2280%22 rx=%2224%22 fill=%22%2314ad6c%22/%3E%3C/svg%3E" alt=""><i class="bi bi-shop-window store-hero-fallback-icon"></i></span><span>ร้านอาหารทดสอบ</span></h1><p>สั่งอาหารจากร้านนี้</p>';
   document.querySelector("main").append(fixture);
   document.body.classList.add("admin-vr-page");
   const editor=document.createElement("div");
   editor.className="admin-store-branding-editor";
   editor.id="brandEditorVisualFixture";
   editor.innerHTML='<div class="admin-store-branding-field"><div class="admin-store-branding-field-heading"><strong>โลโก้ร้าน</strong><small>ไฟล์รูป</small></div><div class="admin-store-branding-preview is-logo"><img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%2314ad6c%22/%3E%3C/svg%3E"></div></div><div class="admin-store-branding-field"><div class="admin-store-branding-field-heading"><strong>ภาพปก</strong><small>ภาพแนวนอน</small></div><div class="admin-store-branding-preview is-cover"><img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221000%22 height=%22500%22%3E%3Crect width=%221000%22 height=%22500%22 fill=%22%237cba79%22/%3E%3C/svg%3E"></div></div>';
   document.querySelector("main").append(editor);
   const hb=R(hero),mb=R(mark),fb=R(fixture);
   const tiles=buttons.map(b=>{
    const r=R(b),i=R(b.querySelector("svg"));
    return {w:Math.round(r.width),h:Math.round(r.height),
      x:r.x,right:r.right,icon:b.querySelector("svg")?.dataset.deliveryIcon,
      center:Math.round(((r.x+r.width/2)-(i.x+i.width/2))*10)/10,
      centerY:Math.round(((r.y+r.height/2)-(i.y+i.height/2))*10)/10,
      bg:getComputedStyle(b).backgroundColor};
   });
   const first=R(editor.children[0]),second=R(editor.children[1]);
   const logo=fixture.querySelector(".store-hero-brand-mark img");
   return {
    liveHero:{w:Math.round(hb.width),h:Math.round(hb.height),logoMark:Math.round(mb.width),fallback:!!mark.querySelector(".store-hero-fallback-icon")},
    visual:{h:Math.round(fb.height),bg:getComputedStyle(fixture).backgroundSize,logoVisible:getComputedStyle(logo).display==="block",logoNaturalWidth:logo.naturalWidth},
    editor:{first:Math.round(first.width),second:Math.round(second.width),sameRow:Math.abs(first.top-second.top)<4},
    cardH:Math.round(R(buttons[0].closest(".address-card")).height),
    buttons:tiles,overflow:document.documentElement.scrollWidth-innerWidth,
   };
  });
  const gap=metrics.buttons[1].x-metrics.buttons[0].right;
  const okay=metrics.liveHero.logoMark>=39&&metrics.visual.h>=94
    &&metrics.visual.bg.includes("cover")&&metrics.visual.logoVisible
    &&metrics.buttons.length===2&&metrics.buttons[0].icon==="edit"&&metrics.buttons[1].icon==="delete"
    &&metrics.buttons.every(b=>b.w>=30&&b.h>=30&&Math.abs(b.center)<=1&&Math.abs(b.centerY)<=1)
    &&gap>=7.9&&metrics.cardH<=75&&metrics.overflow<=2&&errors.length===0
    &&(width<=680?!metrics.editor.sameRow:metrics.editor.sameRow);
  console.log("BRANDING_VISUAL_"+width+"_"+(okay?"PASS":"FAIL"),JSON.stringify({...metrics,gap:Math.round(gap*10)/10,errors}));
  if(!okay)failed=true;
  await page.locator('.address-card:has(input[value="office"]) .address-icon-button').first().click();
  await page.locator("#addressForm").waitFor({timeout:10000});
  await page.locator("#cancelAddressButton").click();
  await page.locator("#addressForm").waitFor({state:"detached",timeout:5000});
  await ctx.close();
 }
}catch(error){console.log("BRANDING_VISUAL_SMOKE_ERROR",String(error));failed=true}
finally{await browser.close()}
if(failed)process.exitCode=1;
else console.log("BRANDING_VISUAL_PC_MOBILE_ALL_PASS");
