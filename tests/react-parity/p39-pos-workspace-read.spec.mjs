import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync("react-app/src/pages/"+name+"Page.jsx","utf8");
const masters=["PosProducts","PosStockCounts","PosStockMovements","PosPurchases","PosPayables","PosCustomers","PosSuppliers","PosSettings"];
test("POS master pages no longer use cached account role grants, and failed reads show retry",()=>{
 for(const name of masters){
  const page=read(name);
  assert.doesNotMatch(page,/localStorage.getItem\("retail_pos_roles_v1"\)/,name);
  assert.doesNotMatch(page,/role:\s*posSession\?\.role/,name);
  assert.match(page,/if\(workspaceReadError\)return <PageReadyOverlay error/,name);
  assert.match(page,/if\(alive\)setWorkspaceReadError\(true\)/,name);
 }
});
test("stock movement export respects quantity visibility and typed movement",()=>{
 const page=read("PosStockMovements");
 assert.match(page,/canExport = canViewQuantity && hasMovementPermission/);
 assert.match(page,/MOVEMENT_TYPES.includes\(serverType\)/);
});
test("catalog import and staff configuration require successful initial reads",()=>{
 assert.match(read("PosCatalog"),/catalogReadError \|\| loading \|\| !initialReady \|\| !pendingRows.length/);
 assert.match(read("PosUsers"),/if\(usersReadError\)return <PageReadyOverlay error/);
});
test("returns and shifts surface watch errors; tax ledger rejects failed remote reads",()=>{
 assert.match(read("PosReturns"),/watchPosReturnsParity\(tenant.id, rows => setHistory\(rows\),onWatchError\)/);
 assert.match(read("PosShifts"),/POS_SHIFTS_WATCH_FAILED.*setLoadError/);
 assert.match(read("PosTaxInvoices"),/Promise.all\(\[listPosTaxInvoices\(tenant.id\),listPosSales\(tenant.id\)\]\)/);
});
