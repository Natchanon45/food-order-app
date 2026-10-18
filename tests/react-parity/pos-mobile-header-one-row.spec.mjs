import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("react-app/public/parity/css/retail-pos.css","utf8");
const pages = [
  "PosUsersPage","PosBackupPage","PosSalesPage","PosSettingsPage","PosCustomersPage",
  "PosSuppliersPage","PosPurchasesPage","PosProductsPage","PosStockMovementsPage",
  "PosStockCountsPage","PosTaxInvoicesPage","PosPayablesPage","PosShiftsPage",
  "PosReturnsPage","PosCatalogPage",
];

test("All accessible POS management and supporting menu headers use shared CSS",()=>{
  for(const page of pages){
    const src=fs.readFileSync("react-app/src/pages/"+page+".jsx","utf8");
    assert.ok(src.includes('"retail-pos.css"'),page+" missing shared header stylesheet");
    assert.match(src,/data-pos-(?:supporting|management)-header/,page+" missing shared mobile header marker");
  }
});

test("Common mobile CSS keeps title flexible and actions on one nonwrapping row",()=>{
  assert.match(css,/RETAIL_POS_MOBILE_HEADER_ONE_ROW_20261018_523/);
  assert.match(css,/flex-flow:row nowrap!important/);
  assert.match(css,/>\.app-title\{\s*flex:1 1 0%!important;min-width:0!important/);
  assert.match(css,/>\.header-actions\{[\s\S]*?flex:0 0 auto!important;flex-flow:row nowrap!important/);
  assert.match(css,/gap:8px!important;width:max-content!important/);
});

test("Title and description can use up to two lines; actions keep readable spacing",()=>{
  assert.match(css,/\.app-title strong\{[\s\S]*?-webkit-line-clamp:2/);
  assert.match(css,/\.app-title small\{[\s\S]*?-webkit-line-clamp:2/);
  assert.match(css,/max-width:min\(28vw,130px\)/);
});
