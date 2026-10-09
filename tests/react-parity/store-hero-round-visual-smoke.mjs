import {chromium} from "@playwright/test";
const base=process.env.DELIVERY_TEST_BASE_URL||"http://127.0.0.1:5119";
const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
let failed=false;
try{
 for(const width of [320,390,440,768,1280]){
  const ctx=await browser.newContext({viewport:{width,height:956},isMobile:width<=440,hasTouch:width<=440});
  await ctx.addInitScript(()=>{
   localStorage.setItem("food_order_guest_delivery_profile",JSON.stringify({displayName:"Test",phone:"0811111111",addresses:[{id:"home",label:"บ้าน",recipientName:"Test",recipientPhone:"0811111111",address:"Test",latitude:13.82984,longitude:100.64208}]}));
   Object.defineProperty(navigator,"geolocation",{configurable:true,value:{getCurrentPosition:ok=>setTimeout(()=>ok({coords:{latitude:13.82984,longitude:100.64208,accuracy:12}}),65)}});
  });
  const page=await ctx.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  // Read-only CSS fixture: no Firebase login/network dependencies.
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">'+
    '<link rel="stylesheet" href="'+base+'/react/parity/css/app.css">'+
    '<link rel="stylesheet" href="'+base+'/react/parity/css/store-hero-branding.css"></head>'+
    '<body class="delivery-page"><main class="container"><section class="hero store-branded-hero">'+
    '<h1 class="hero-title"><span class="store-hero-brand-mark"><i class="bi bi-shop-window store-hero-fallback-icon"></i></span><span>ทดสอบร้าน</span></h1><p>รายละเอียดร้าน</p></section></main></body></html>',{waitUntil:"load",timeout:16000});
  await page.locator(".hero.store-branded-hero").waitFor({timeout:8000});
  const checks=await page.evaluate(()=>{
   const source=document.querySelector(".hero.store-branded-hero");
   const R=el=>el.getBoundingClientRect();
   const build = (kind, quick=false) => {
     const hero=document.createElement("section");
     hero.className="hero store-branded-hero"+(quick?" quick-order-hero":"");
     hero.dataset.heroFixture=kind;
     hero.style.backgroundImage='linear-gradient(90deg,rgba(0,35,22,.85),rgba(6,80,30,.4)),url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22900%22 height=%22450%22%3E%3Crect width=%22900%22 height=%22450%22 fill=%22%2392ca85%22/%3E%3C/svg%3E")';
     hero.style.backgroundPosition="82% 18%";
     const body=quick?document.createElement("div"):hero;
     body.innerHTML='<h1 class="hero-title"><span class="store-hero-brand-mark"><i class="bi bi-shop-window store-hero-fallback-icon"></i></span><span>ร้านอาหารทดสอบ อาหารไทยรสจัด</span></h1><p>ยินดีต้อนรับ เลือกรายการอาหารที่ชอบได้เลย</p>';
     if(quick)hero.append(body);
     source.after(hero);
     const h=R(hero),mark=R(hero.querySelector(".store-hero-brand-mark")),title=R(hero.querySelector(".hero-title span:not(.store-hero-brand-mark)"));
     return {kind,heroH:Math.round(h.height),logoSize:Math.round(mark.width),
       logoRound:getComputedStyle(hero.querySelector(".store-hero-brand-mark")).borderRadius,
       overlap:mark.right+7-title.left,
       bgPosition:getComputedStyle(hero).backgroundPosition,
       overflow:hero.scrollWidth-hero.clientWidth,
       overflowStyle:getComputedStyle(hero).overflow};
   };
   const variants=[build("delivery"),build("table"),build("takeaway"),build("quickorder",true)];
   return {variants,actual:{heroH:Math.round(R(source).height),logoSize:Math.round(R(source.querySelector(".store-hero-brand-mark")).width)},
     pageOverflow:document.documentElement.scrollWidth-innerWidth};
  });
  const good=checks.variants.every(v=>v.logoRound==="50%" && v.bgPosition.startsWith("82% 18%") &&
   v.logoSize>=76 && v.logoSize<v.heroH && v.logoSize/v.heroH>.63 && v.overlap<=1 && v.overflowStyle==="hidden")
    && checks.pageOverflow<=1 && errors.length===0;
  console.log("ROUND_BRAND_HERO_"+width+"_"+(good?"PASS":"FAIL"),JSON.stringify({...checks,errors}));
  if(!good)failed=true;
  await ctx.close();
 }
}catch(e){console.log("ROUND_BRAND_HERO_SMOKE_ERROR",String(e));failed=true}
finally{await browser.close()}
if(failed)process.exitCode=1;else console.log("ROUND_BRAND_HERO_RESPONSIVE_ALL_PASS");
