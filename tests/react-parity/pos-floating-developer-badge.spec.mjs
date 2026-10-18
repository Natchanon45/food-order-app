import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pages = [
  "PosPage","PosSalesPage","PosTaxInvoicesPage","PosReturnsPage",
  "PosShiftsPage","PosProductsPage","PosStockMovementsPage","PosStockCountsPage",
  "PosPurchasesPage","PosPayablesPage","PosSuppliersPage","PosCustomersPage",
  "PosSettingsPage","PosBackupPage","PosUsersPage","PosCatalogPage","PosForbiddenPage",
];

test("All interactive POS pages mount one Developer Panel and load its floating CSS",()=>{
  for(const name of pages){
    const source=fs.readFileSync("react-app/src/pages/"+name+".jsx","utf8");
    assert.equal((source.match(/<AppDeveloperPanel(?:\s*\/>|\/>)/g)||[]).length,1,name+" must mount exactly one panel");
    assert.match(source,/import\s*\{\s*AppDeveloperPanel\s*\}\s*from\s*["']@\/components\/AppDeveloperPanel["']/,
      name+" must use the existing Developer Panel");
    assert.ok(source.includes('"app-version-badge-runtime.css"'),
      name+" must load its floating badge CSS");
  }
});

test("Developer panel uses existing fixed, icon-only badge and can be opened",()=>{
 const comp=fs.readFileSync("react-app/src/components/AppDeveloperPanel.jsx","utf8");
 const css=fs.readFileSync("react-app/public/parity/css/app-version-badge-runtime.css","utf8");
 assert.match(comp,/className="app-version-badge"/);
 assert.match(comp,/data-app-version-badge/);
 assert.match(comp,/onClick=\{\(\) => setOpen\(true\)\}/);
 assert.match(comp,/aria-label="เปิด Developer Panel"/);
 assert.match(comp,/className="app-dev-panel"/);
 assert.match(css,/position:fixed!important/);
 assert.match(css,/right:14px!important/);
 assert.match(css,/z-index:9999!important/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css,/bottom:calc\(92px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
});

test("Only the four previously deficient POS pages change panel availability",()=>{
 for(const name of ["PosBackupPage","PosUsersPage","PosCatalogPage","PosForbiddenPage"]){
  const source=fs.readFileSync("react-app/src/pages/"+name+".jsx","utf8");
  assert.ok(source.includes('"app-version-badge-runtime.css"'),name);
  assert.ok(source.includes("<AppDeveloperPanel"),name);
 }
});
