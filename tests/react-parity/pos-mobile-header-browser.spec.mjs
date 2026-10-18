import {test,expect} from "@playwright/test";
import fs from "node:fs";

test.use({launchOptions:{executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}});

const css=fs.readFileSync("react-app/public/parity/css/retail-pos.css","utf8");
const localeCss=fs.readFileSync("react-app/public/parity/css/pos-locale-switcher-placement.css","utf8");
const scenes=[
 ["users","supporting","ผู้ใช้และสิทธิ์","กำหนดบัญชีเข้าสู่ระบบ บทบาท ระบบที่เข้าใช้งาน และสิทธิ์เข้าถึง POS",false,false],
 ["backup","supporting","สำรองและกู้คืนข้อมูล","สำรองข้อมูล Retail POS ของร้านจาก Firebase และกู้คืนอย่างปลอดภัย",false,false],
 ["sales","management","รายงานและประวัติการขาย","POS ร้านค้าปลีก",false,false],
 ["stock","management","เคลื่อนไหวสต็อกและตรวจนับสินค้า","ตรวจสอบสต็อกและประวัติการทำรายการ",false,false],
 ["settings","supporting","ตั้งค่าร้าน","ตั้งค่าการใช้งานระบบ POS ภายในร้าน",false,false],
 ["catalog","supporting","แคตตาล็อกสินค้า","จัดการรายการสินค้าของร้านและรายละเอียด",true,false],
 ["invoices","management","ใบกำกับภาษี","ตรวจสอบและจัดการเอกสารใบกำกับภาษี",false,true],
];
for(const width of [320,360,390,430,440]){
 test("POS header actions remain in one row across menus at "+width+"px",async({page})=>{
   await page.setViewportSize({width,height:932});
   for(const [name,kind,title,subtitle,hasBack,hasRefresh] of scenes){
     await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
       <body><header class="pos-header" data-pos-${kind}-header>
         <div class="app-title"><div><strong>${title}</strong><small>${subtitle}</small></div></div>
         <div class="header-actions">
           ${hasBack?'<a href="#" class="btn btn-secondary">กลับหน้าสินค้า</a>':""}
           ${hasRefresh?'<button id="refreshBtn" class="btn btn-secondary">↻</button>':""}
           <form class="app-locale-switcher"><details class="app-locale-menu">
              <summary class="app-locale-trigger" aria-label="ภาษา">🌐</summary>
            </details></form>
           ${!hasBack?'<button class="pos-menu-trigger btn btn-secondary" id="posMenuTrigger">☰ <span>เมนู</span></button>':""}
         </div></header></body></html>`);
     await page.addStyleTag({content:localeCss});
     await page.addStyleTag({content:css});
     await page.addStyleTag({content:`*{box-sizing:border-box}body{margin:0}.app-locale-trigger{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#fff;color:#095d35}.pos-menu-trigger{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 10px;min-width:56px;min-height:40px;white-space:nowrap}.header-actions>a.btn,.header-actions>#refreshBtn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 10px;background:white;color:green}.app-title{min-width:0}`});
     const position=await page.evaluate(()=>{
       const h=document.querySelector(".pos-header").getBoundingClientRect();
       const action=document.querySelector(".header-actions").getBoundingClientRect();
       const children=[...document.querySelector(".header-actions").children].map(el=>el.getBoundingClientRect());
       const copy=document.querySelector(".app-title small");
       const small=copy.getBoundingClientRect();
       const line=parseFloat(getComputedStyle(copy).lineHeight);
       return {headerHeight:h.height,actionRight:action.right,actionWidth:action.width,
         rowMaxDelta:Math.max(...children.map(b=>b.y+b.height/2))-Math.min(...children.map(b=>b.y+b.height/2)),
         gap:children.length>1?Math.min(...children.slice(1).map((b,i)=>b.left-children[i].right)):0,
         descriptionLines:small.height/line,
         overflow:document.documentElement.scrollWidth>innerWidth};
     });
     expect(position.rowMaxDelta,name+" stacked controls").toBeLessThanOrEqual(1);
     expect(position.gap,name+" button gap").toBeGreaterThanOrEqual(7);
     expect(position.actionRight,name+" offscreen").toBeLessThanOrEqual(width+1);
     expect(position.descriptionLines,name+" description beyond two lines").toBeLessThanOrEqual(2.1);
     expect(position.overflow,name+" horizontal overflow").toBe(false);
   }
 });
}
