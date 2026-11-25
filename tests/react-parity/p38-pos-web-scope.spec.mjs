import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync("react-app/src/"+p,"utf8");
test("POS and Quick Order display remount on authenticated identity and route change",()=>{
 const app=read("app/App.jsx");
 assert.match(app,/function PosSessionScope/);
 assert.match(app,/auth.user\?\.uid/);
 assert.match(app,/tenant\?\.id/);
 assert.match(app,/<PosScopeFragment key=\{key\}>/);
 assert.match(app,/pathname!=="\/cashier\/customer-display"/);
});
test("POS reads fail closed and QR generated locally",()=>{
 const pos=read("pages/PosPage.jsx");
 assert.match(pos,/if\(readError\)return <PageReadyOverlay error/);
 assert.match(pos,/qrImageUrl: qrDataUrl\(payload/);
 assert.doesNotMatch(pos,/api\.qrserver\.com/);
 assert.match(pos,/readError \|\| loading/);
});
test("display read failure clears data; only paid state displays thanks",()=>{
 const page=read("pages/PosCustomerDisplayPage.jsx");
 assert.match(page,/setSnapshot\(null\);setWatchError\(true\)/);
 assert.match(page,/hidden=\{snapshot\?\.status !== "paid"\}/);
});
test("receipt and tax print cannot finish after route unmount",()=>{
 for(const file of ["PosReceiptPage","PosTaxInvoicePage"])assert.match(read("pages/"+file+".jsx"),/if\(!mounted.current\)return/);
 assert.doesNotMatch(read("pages/PosTaxInvoicePage.jsx"),/NavigAte/);
});
test("POS sales no browser finance cache and backup restore stays locked",()=>{
 assert.doesNotMatch(read("pages/PosSalesPage.jsx"),/localStorage/);
 const backup=read("pages/PosBackupPage.jsx");
 assert.match(backup,/data.tenantId!==tenant.id/);
 assert.doesNotMatch(backup,/restoreRetailPosBackup\(/);
 assert.match(backup,/id="restoreBackupBtn"[^>]+disabled/);
});
