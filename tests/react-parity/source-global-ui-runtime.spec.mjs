import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
// Byte-pinned shared presentation files from Source 7e47e85f.
const pins = {
  "components/FormDynamicEnhancer.jsx": "e03e69914a6fb0f180a70c8e613a03de7ae108158f61e5a4334d982d52c571a7",
  "components/AppModal.jsx": "36d43ef5eb3e4cfa18ba4b88fb9879f2126b7521baa26ae9f3c947c9e773820a",
  "ui/app-modal-standard.js": "a44ee070de4e578af2df27a20bdd80c7e2c67d76f0734c4c2cf0a72137b8da15",
  "ui/toast-top-layer.js": "23d61925dcd7ebe33151036c917158faf66069d949b2c094e23b521cd1b2ecfd",
  "components/sweetDialog.js": "35f315f9bf8688014b89ae4d4c4f35ceeeec4b8fd9fcca07c01958e30c9c23d2",
  "ui/react-port-dynamic-auto.css": "1ccdbcf5a434c14e8496d9268cef61f95d8c3d20e19288c92ef2093c03e57ef7",
  "ui/react-port-modal-standard.css": "09795b41d40336e533a165335d67736af9bcbe3f5434539378c856a79232171d",
  "ui/react-port-order-button-font-weight.css": "b772334c7cda3a992ae85842e144ba6d16ef304192be0b86602e7291508939d1",
  "ui/react-port-viewport-footer.css": "8e0f956fb040190d89e9fc90f56a05e4cd6aaa05c7bb921e5b22fec94d22ddce"
};
test("shared runtime is the verbatim audited Source implementation",()=>{
 for(const [file,hash] of Object.entries(pins)){
  assert.equal(createHash("sha256").update(readFileSync("react-app/src/"+file)).digest("hex"),hash,file);
 }
});
test("Source enhancer and modal policy mounted once at SPA entry",()=>{
 const entry=readFileSync("react-app/src/main.jsx","utf8");
 assert.equal((entry.match(/<FormDynamicEnhancer\s*\/>/g)||[]).length,1);
 for(const name of ["app-modal-standard.js","react-port-dynamic-auto.css","react-port-modal-standard.css","react-port-order-button-font-weight.css","react-port-viewport-footer.css"])
  assert.ok(entry.includes(name),name);
});
test("Register uses original native wrapping labels with shared auto enhancer",()=>{
 const page=readFileSync("react-app/src/pages/RegisterPage.jsx","utf8");
 for(const id of ["ownerName","phone","email","secretA","secretB"]){
  assert.ok(page.includes('id="'+id+'"'));
  assert.ok(!page.includes('<DynamicField id="'+id+'"'));
 }
 for(const id of ["orderDeliveryShopName","retailPosShopName","slug"])assert.ok(page.includes('<DynamicField id="'+id+'"'));
 assert.ok(page.includes('pricing?.source !== "remote"'));
 assert.ok(page.includes("resumePendingSignup"));
});
