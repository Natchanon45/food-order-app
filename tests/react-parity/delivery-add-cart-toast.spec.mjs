import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source=readFileSync("react-app/src/pages/DeliveryPage.jsx","utf8");
const table=readFileSync("react-app/src/pages/PublicOrderPage.jsx","utf8");
const takeaway=readFileSync("react-app/src/pages/TakeawayPage.jsx","utf8");
const shared=readFileSync("react-app/src/components/PublicStorefront.jsx","utf8");
const translations=JSON.parse(readFileSync("react-app/src/i18n/parity-translations.json","utf8"));
const start=source.indexOf("  const add = item => {");
const end=source.indexOf("  const increase =",start);
assert.ok(start>=0 && end>start,"Expected Delivery add function is missing");
const addHandler=source.slice(start,end);

function simulate({closed=false,locked=false,language="th",clicks=1}={}) {
 let cart=[],written=0;
 const notifications=[];
 const pattern=translations[language].shared.toast.item_added;
 const scope={
  clicks,
  paymentLocked:locked, storeAcceptingOrders:!closed,
  setCart(fn){written++;cart=fn(cart);},
  showStorefrontToast(text,type){notifications.push({text,type:type||"success"});},
  t(key,values){
   assert.equal(key,"shared.toast.item_added");
   return pattern.replace(":name",values.name);
  }
 };
 runInNewContext(addHandler+"\nfor(let i=0;i<clicks;i++) add({id:'test-menu',name:'ตำปูปลาร้า',price:45});",scope);
 return {cart,written,notifications};
}

test("Delivery matches table and Take Away: successful menu add shows toast",()=>{
 assert.match(table,/showStorefrontToast\(t\("order\.toast\.added"/);
 assert.match(takeaway,/showStorefrontToast\(t\("takeaway\.toast\.added"/);
 assert.match(shared,/export function showStorefrontToast/);
 const result=simulate();
 assert.equal(result.written,1);
 assert.equal(result.cart.length,1);
 assert.equal(result.cart[0].qty,1);
 assert.deepEqual(result.notifications,[{text:"เพิ่ม ตำปูปลาร้า แล้ว",type:"success"}]);
});

test("Repeated Delivery menu add increments quantity and notifies per successful click",()=>{
 const result=simulate({clicks:2});
 assert.equal(result.written,2);
 assert.equal(result.cart.length,1);
 assert.equal(result.cart[0].qty,2);
 assert.equal(result.notifications.length,2);
 assert.ok(result.notifications.every(x=>x.text==="เพิ่ม ตำปูปลาร้า แล้ว"&&x.type==="success"));
});

test("No success toast when store closed or PromptPay cart locked",()=>{
 for(const config of [{closed:true},{locked:true}]){
  const result=simulate({...config,clicks:2});
  assert.equal(result.written,0);
  assert.equal(result.cart.length,0);
  assert.equal(result.notifications.length,0);
 }
});

test("Delivery add-to-cart toast interpolates names in all five languages",()=>{
 for(const language of ["th","en","my","lo","km"]){
  const result=simulate({language});
  assert.equal(result.notifications.length,1,language);
  assert.ok(result.notifications[0].text.includes("ตำปูปลาร้า"),language);
  assert.ok(!result.notifications[0].text.includes(":name"),language);
 }
});
