import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = name => fs.readFileSync(name,"utf8");
const admin=read("react-app/src/pages/AdminPage.jsx");
const editor=read("react-app/src/components/StoreBrandingEditor.jsx");
const upload=read("react-app/src/data/storeBrandingData.js");
const present=read("react-app/src/components/StoreHeroBranding.jsx");
const style=read("react-app/public/parity/css/store-hero-branding.css");
const adminStyle=read("react-app/public/parity/css/admin-store-branding.css");
const storage=read("storage.rules");
const locales=JSON.parse(read("react-app/src/i18n/parity-translations.json"));

test("Store Basics owns one shared logo and hero-cover upload editor",()=>{
 assert.match(admin,/<StoreBrandingEditor values=\{storeForm\}/);
 assert.match(admin,/shopLogoUrl: String\(s\.shopLogoUrl \|\| s\.logoUrl \|\| ""\)/);
 assert.match(admin,/shopHeroImageUrl: String\(s\.shopHeroImageUrl \|\| s\.heroImageUrl \|\| ""\)/);
 assert.match(admin,/setStoreBrandFiles\(\{ logo: null, cover: null \}\)/);
 assert.match(editor,/data-store-brand-file=\{field\.kind\}/);
 assert.match(editor,/data-store-brand-remove=\{field\.kind\}/);
 assert.match(editor,/previewUrls\[field\.kind\] \|\| values\[field\.key\]/);
 assert.match(admin,/shopLogoUrl: nextLogoUrl/);
 assert.match(admin,/shopHeroImageUrl: nextCoverUrl/);
 assert.match(admin,/setStoreForm\(current => \(\{ \.\.\.current, shopLogoUrl: saved\.shopLogoUrl/);
 assert.match(admin,/saveAdminStoreSettings\(tenant\.id, payload\)/);
});

test("image upload enforces formats, size and scoped Storage permission without new rule deployment",()=>{
 assert.match(upload,/\["image\/jpeg", "image\/png", "image\/webp"\]/);
 assert.match(upload,/file\.size > 8 \* 1024 \* 1024/);
 assert.match(upload,/canvas\.toBlob\(resolve, "image\/webp", 0\.82\)/);
 assert.match(upload,/blob\.size > 5 \* 1024 \* 1024/);
 assert.match(upload,/product-images\/store-branding\//);
 assert.match(upload,/uploadBytes\(reference, blob, \{ contentType: "image\/webp" \}\)/);
 assert.match(storage,/match \/tenants\/\{tenantId\}\/product-images\/\{productId\}\/\{fileName\}/);
 assert.match(storage,/tenantProductAdmin\(tenantId\) && validImage\(5 \* 1024 \* 1024\)/);
 assert.match(storage,/allow read: if true/);
});

test("Delivery, dine-in Table, Takeaway and Cashier Quick Order use tenant hero image and logo",()=>{
 const pages=[
 ["DeliveryPage.jsx","settings"],
 ["PublicOrderPage.jsx","storeSettings"],
 ["TakeawayPage.jsx","settings"],
 ["QuickOrderPage.jsx","storeSettings"],
 ];
 for(const [file,key] of pages){
  const text=read("react-app/src/pages/"+file);
  assert.match(text,/StoreBrandMark, brandedHeroStyle/);
  assert.ok(text.includes("store-hero-branding.css"),file);
  assert.ok(text.includes("store-branded-hero"),file);
  assert.ok(text.includes("brandedHeroStyle("+key+")"),file);
  assert.ok(text.includes("<StoreBrandMark settings={"+key+"}"),file);
 }
 const table=read("react-app/src/pages/PublicOrderPage.jsx");
 assert.match(table,/getPublicStoreSettings\(resolvedTenant\)/);
 assert.match(table,/setStoreSettings\(brandingSettings \|\| \{\}\)/);
 assert.match(present,/settings\.shopLogoUrl \|\| settings\.logoUrl/);
 assert.match(present,/settings\.shopHeroImageUrl \|\| settings\.heroImageUrl/);
 assert.match(present,/https:/);
 assert.match(style,/background-size: cover;/);
});

test("Shop logo fallback and branding editor are mobile responsive",()=>{
 assert.match(present,/bi bi-shop-window store-hero-fallback-icon/);
 assert.match(present,/event\.currentTarget\.hidden = true/);
 assert.match(style,/img\[hidden\] \+ \.store-hero-fallback-icon/);
 assert.match(style,/@media \(max-width: 480px\)/);
 assert.match(adminStyle,/@media \(max-width: 680px\)/);
 assert.match(adminStyle,/grid-template-columns: minmax\(0,1fr\);/);
});

test("all five languages describe store logo and cover and allow removal",()=>{
 for(const lang of ["th","en","my","lo","km"]){
  const labels=locales[lang].admin.store_branding;
  for(const key of ["logo_title","logo_help","cover_title","cover_help","choose","remove","invalid","none"]){
   assert.ok(labels[key],lang+" "+key);
  }
 }
});

test("no authorization policy or payment order pathway is changed by brand images",()=>{
 assert.doesNotMatch(upload,/submitPublicDeliveryOrder|createPublicTableOrder|createPublicTakeawayOrder/);
 assert.doesNotMatch(admin,/deleteDoc\(.*storeBrand|deleteObject\(/);
 assert.match(editor,/accept="image\/png,image\/jpeg,image\/webp"/);
});
