import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dragCoverFocusY,heroFocusPosition} from "../../react-app/src/utils/storeHeroFocus.js";
import {qrMatrix,qrSvg} from "../../react-app/src/utils/localQr.js";
const read=f=>readFileSync(new URL("../../"+f,import.meta.url),"utf8");
test("P2.2 latest JSX Store Master is inside existing AdminPage, never a duplicate route",()=>{
 const app=read("react-app/src/app/App.jsx");
 const page=read("react-app/src/pages/AdminPage.jsx");
 const source=read("react-app/src/components/StoreBrandingEditor.jsx");
 for(const id of ["storeMasterCard","storeBasicsGroup","storeLocationGroup","storeOpeningHoursGroup",
 "storePaymentGroup","storeDeliveryGroup","storePromotionGroup","storeFeeGroup"])
 assert.match(page,new RegExp(id));
 assert.match(page,/<AdminDeliveryQr tenant=\{tenant\}/);
 assert.match(page,/<StoreBrandingEditor values=\{storeForm\}/);
 assert.doesNotMatch(app,/AdminStoreMasterPage/);
 assert.match(source,/dragCoverFocusY/);
 assert.match(source,/data-cover-focus-stage/);
 assert.match(source,/role="slider"/);
 assert.match(source,/aria-orientation="vertical"/);
 assert.match(source,/shopHeroFocusX: 50, shopHeroFocusY: y/);
 assert.doesNotMatch(source,/pointerHeroFocus/);
});
test("P2.2 Y-only physical dragging respects source crop overflow and keyboard bounds",()=>{
 assert.equal(dragCoverFocusY(50,200,245,450),40);
 assert.equal(dragCoverFocusY(50,200,155,450),60);
 assert.equal(dragCoverFocusY(50,200,1000,450),0);
 assert.equal(dragCoverFocusY(50,200,-1000,450),100);
 assert.equal(dragCoverFocusY(50,200,245,0),50);
 assert.equal(heroFocusPosition({shopHeroFocusX:50,shopHeroFocusY:82}).css,"50% 82%");
 const css=read("react-app/public/parity/css/admin-store-branding.css");
 assert.match(css,/ONE framed cover preview/);
 assert.match(css,/cursor: grab/);
 assert.match(css,/aspect-ratio: 8 \/ 3/);
 assert.doesNotMatch(read("react-app/src/components/StoreBrandingEditor.jsx"),/data-cover-focus-marker/);
});
test("P2.2 locally generated Delivery/Takeaway QR is independent of quickchart network",()=>{
 const page=read("react-app/src/components/AdminDeliveryQr.jsx");
 const util=read("react-app/src/utils/localQr.js");
 assert.match(page,/qrPngDataUrl\(value, \{ size: 720, margin: 4 \}\)/);
 assert.doesNotMatch(page,/quickchart\.io|api\.qrserver|fetch\([^)]*quickchart/);
 assert.match(page,/\$\{filenamePrefix\}-\$\{slug/);
 assert.match(page,/\.png/);
 assert.match(page,/export function printHtml\(paper, title\)/);
 assert.match(page,/printHtml\(paper, title\)/);
 assert.match(page,/clone\.outerHTML/);
 assert.match(util,/export function qrPngDataUrl\(/);
 for(const input of ["https://penguin-food.web.app/s/test-shop/delivery",
                     "https://penguin-food.web.app/s/test-shop/takeaway"]){
  const matrix=qrMatrix(input);
  assert.ok(matrix.length>=25);
  assert.ok(matrix.every(row=>row.length===matrix.length));
  assert.match(qrSvg(input),/<svg /);
 }
});
test("P2.2 Firebase store data and Storage remain tenant scoped with post-save verification",()=>{
 const page=read("react-app/src/pages/AdminPage.jsx");
 const data=read("react-app/src/data/adminData.js");
 const upload=read("react-app/src/data/storeBrandingData.js");
 const rules=read("firestore.rules");
 const storage=read("storage.rules");
 assert.match(page,/uploadStoreBrandImage\(tenant\.id/);
 assert.match(page,/saveAdminStoreSettings\(tenant\.id, payload\)/);
 assert.match(page,/STORE_SETTINGS_VERIFICATION_FAILED/);
 assert.match(page,/shopHeroFocusY: normalizeHeroFocus/);
 assert.match(data,/setDoc\(ref, payload, \{ merge: true \}\)/);
 assert.match(data,/const snapshot = await getDoc\(ref\)/);
 assert.match(upload,/product-images\/store-branding\//);
 assert.match(rules,/settingId != 'lalamove'/);
 assert.match(storage,/tenantProductAdmin\(tenantId\) && validImage\(5 \* 1024 \* 1024\)/);
});
