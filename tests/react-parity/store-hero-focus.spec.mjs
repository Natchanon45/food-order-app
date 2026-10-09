import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeHeroFocus, heroFocusPosition, pointerHeroFocus } from "../../react-app/src/utils/storeHeroFocus.js";

const source=path=>fs.readFileSync(path,"utf8");
const ui=source("react-app/src/components/StoreBrandingEditor.jsx");
const admin=source("react-app/src/pages/AdminPage.jsx");
const hero=source("react-app/src/components/StoreHeroBranding.jsx");
const logoCss=source("react-app/public/parity/css/store-hero-branding.css");
const focusCss=source("react-app/public/parity/css/admin-store-branding.css");
const locales=JSON.parse(source("react-app/src/i18n/parity-translations.json"));

test("old stores and bad focus inputs reliably center their cover",()=>{
 for(const value of [undefined,null,"",NaN,Infinity,"oops"]) assert.equal(normalizeHeroFocus(value),50);
 assert.deepEqual(heroFocusPosition({}),{x:50,y:50,css:"50% 50%"});
 assert.deepEqual(heroFocusPosition({shopHeroFocusX:84.26,shopHeroFocusY:18.89}),{x:84.3,y:18.9,css:"84.3% 18.9%"});
 assert.equal(normalizeHeroFocus(-99),0);
 assert.equal(normalizeHeroFocus(150),100);
});
test("pointer focus maps/clamps pointer to original image display bounds",()=>{
 const frame={getBoundingClientRect:()=>({left:100,top:200,width:400,height:200})};
 assert.deepEqual(pointerHeroFocus({clientX:400,clientY:250},frame),{x:75,y:25});
 assert.deepEqual(pointerHeroFocus({clientX:-99,clientY:888},frame),{x:0,y:100});
});
test("cover focus is loaded, persisted and verified with store settings",()=>{
 assert.match(admin,/shopHeroFocusX: normalizeHeroFocus\(s.shopHeroFocusX\)/);
 assert.match(admin,/shopHeroFocusY: normalizeHeroFocus\(s.shopHeroFocusY\)/);
 assert.match(admin,/shopHeroFocusX: normalizeHeroFocus\(storeForm.shopHeroFocusX\)/);
 assert.match(admin,/shopHeroFocusY: normalizeHeroFocus\(storeForm.shopHeroFocusY\)/);
 assert.match(admin,/"shopHeroFocusX", "shopHeroFocusY"/);
 assert.match(admin,/shopHeroFocusX: normalizeHeroFocus\(saved.shopHeroFocusX\)/);
 assert.match(hero,/backgroundPosition: heroFocusPosition\(settings\)\.css/);
});
test("cover admin focus supports mouse touch pen keyboard reset and live crop",()=>{
 assert.match(ui,/data-cover-focus-stage/);
 assert.match(ui,/data-cover-focus-marker/);
 assert.match(ui,/onPointerDown=\{onFocusPointerDown\}/);
 assert.match(ui,/onPointerMove=\{onFocusPointerMove\}/);
 assert.match(ui,/setPointerCapture\(event.pointerId\)/);
 assert.match(ui,/onLostPointerCapture/);
 assert.match(ui,/event.key === "ArrowLeft"/);
 assert.match(ui,/event.key === "Home"/);
 assert.match(ui,/data-cover-focus-reset/);
 assert.match(ui,/style=\{\{ left: focus.x \+ "%", top: focus.y \+ "%" \}\}/);
 assert.match(ui,/objectPosition: focus.css/);
 assert.match(ui,/shopHeroFocusX: 50, shopHeroFocusY: 50/);
 assert.match(focusCss,/touch-action: none/);
});
test("Hero shop logo is a large circular mark across four surfaces",()=>{
 assert.match(logoCss,/--store-hero-logo-size: 112px/);
 assert.match(logoCss,/--store-hero-logo-size: 88px/);
 assert.match(logoCss,/border-radius: 50%/);
 assert.match(logoCss,/object-fit: cover/);
 assert.match(logoCss,/store-branded-hero\.hero\.quick-order-hero > div/);
 for(const filename of ["DeliveryPage","TakeawayPage","PublicOrderPage","QuickOrderPage"]){
  const body=source("react-app/src/pages/"+filename+".jsx");
  assert.match(body,/brandedHeroStyle\(/);
  assert.match(body,/<StoreBrandMark/);
 }
});
test("upload hints and focus controls translated for five languages",()=>{
 for(const locale of ["th","en","my","lo","km"]){
  const copy=locales[locale].admin.store_branding;
  assert.match(copy.logo_help,/1200 × 1200/);
  assert.match(copy.cover_help,/1600 × 900/);
  assert.match(copy.logo_help,/8 MB/);
  for(const key of ["focus_title","focus_help","focus_aria","focus_reset"]) assert.ok(copy[key],locale+" "+key);
 }
});
