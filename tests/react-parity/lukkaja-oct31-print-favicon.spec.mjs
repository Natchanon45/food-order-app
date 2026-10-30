import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { printFaviconLink } from "../../react-app/src/utils/printFavicon.js";
test("Oct31 printed tab uses dynamic uploaded favicon and safely escapes HTML",()=>{
 const doc={baseURI:"https://penguin-food.web.app/",getElementById:()=>({href:'https://storage.googleapis.com/a?x=1&y="b"'}),querySelector:()=>null};
 assert.equal(printFaviconLink(doc),'<link rel="icon" href="https://storage.googleapis.com/a?x=1&amp;y=%22b%22">');
 assert.equal(printFaviconLink({baseURI:doc.baseURI,getElementById:()=>({href:"javascript:alert(1)"}),querySelector:()=>null}),"");
 assert.equal(printFaviconLink({baseURI:doc.baseURI,getElementById:()=>null,querySelector:()=>null}),"");
});
test("Oct31 cashier receipt, Admin QR and Waiting Queue print reuse uploaded icon",()=>{
 for(const path of [
  "react-app/src/utils/receiptPrintWindow.js",
  "react-app/src/components/AdminDeliveryQr.jsx",
  "react-app/src/pages/WaitingQueuePage.jsx",
 ]){
  const source=readFileSync(path,"utf8");
  assert.match(source,/import \{ printFaviconLink \}/);
  assert.match(source,/printFaviconLink\(/);
 }
 const runtime=readFileSync("react-app/src/components/PlatformBrandingRuntime.jsx","utf8");
 assert.match(runtime,/upsertLink\("icon", favicon, "platformDynamicFavicon"\)/);
});
