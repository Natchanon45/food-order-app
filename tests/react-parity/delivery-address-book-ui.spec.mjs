import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("react-app/src/pages/DeliveryPage.jsx","utf8");
const css = fs.readFileSync("react-app/public/parity/css/delivery-addresses.css","utf8");
const locationCss = fs.readFileSync("react-app/public/parity/css/delivery-location-map.css","utf8");

test("address heading and Add button share the same row",()=>{
 const head=source.slice(source.indexOf('className="address-book-head"'),source.indexOf('id="deliveryAddressChoiceNotice"'));
 assert.match(head,/className="address-book-heading"/);
 assert.match(head,/id="addAddressButton"/);
 assert.match(css,/\.address-book \.address-book-head \{\s*display: flex;/);
 assert.match(css,/\.address-book-heading/);
});

test("saved cards list the address label only, hiding recipient and street details",()=>{
 const cards=source.slice(source.indexOf('id="addressList"'),source.indexOf('{addressEditor ? createPortal('));
 assert.match(cards,/address-card-choice/);
 assert.match(cards,/address\.label \|\| t\("delivery.checkout.address.fallback_label"\)/);
 assert.doesNotMatch(cards,/address-card-text|address\.address|address\.recipientName/);
 assert.match(cards,/id="addressList"/);
 assert.match(cards,/address-card-actions/);
});

test("no default-address action is exposed; old profile flags do not drive destination selection",()=>{
 const cards=source.slice(source.indexOf('id="addressList"'),source.indexOf('{addressEditor ? createPortal('));
 assert.match(cards,/address-card-choice/);
 assert.match(cards,/onChange=\{\(\) => selectAddress\(address\)\}/);
 assert.doesNotMatch(cards,/address-primary-button|data-primary-address|bi-house|is-primary/);
 assert.doesNotMatch(source,/const makeDefault|primaryAddressId|isDefault: addresses.length === 0/);
 assert.doesNotMatch(css,/address-primary-button/);
 assert.match(source,/matchGpsSavedAddress\(addresses, initialGps.point, "current-location"\)/);
 assert.match(source,/if \(nearest\) selectAddress\(nearest.address\)/);
});

test("legacy isDefault fields are preserved on editing without mutating other addresses",()=>{
 const save=source.slice(source.indexOf('const saveAddress = async'),source.indexOf('const deleteAddress = async'));
 const del=source.slice(source.indexOf('const deleteAddress = async'),source.indexOf('const loginGoogle = async'));
 assert.match(save,/Object\.prototype\.hasOwnProperty\.call\(addresses\[index\], "isDefault"\)/);
 assert.match(save,/isDefault: addresses\[index\]\.isDefault/);
 assert.doesNotMatch(save,/existingPrimaryId|primaryId|addresses = addresses\.map/);
 assert.doesNotMatch(del,/isDefault:|\.find\(row => row\.isDefault\)/);
 assert.match(del,/filter\(row => row\.id !== address\.id\)/);
});

test("modal editor uses a portal with larger responsive map and visible validation",()=>{
 assert.match(source,/addressEditor \? createPortal\(/);
 assert.match(source,/role="dialog" aria-modal="true"/);
 assert.match(source,/document\.body/);
 assert.match(source,/className="delivery-address-dialog-body"/);
 assert.match(source,/className="delivery-address-inline-error"/);
 assert.match(source,/idPrefix="savedAddress"/);
 assert.match(css,/\.delivery-address-dialog-backdrop/);
 assert.match(css,/width: min\(700px, 100%\)/);
 assert.match(css,/\.delivery-address-dialog \.delivery-location-map/);
 assert.match(css,/@media \(max-width: 640px\)/);
 assert.doesNotMatch(source,/id="addressDefault"/);
});

test("location matching and checkout saved-address guard remain unchanged",()=>{
 assert.match(source,/matchGpsSavedAddress\(addresses, initialGps.point, "current-location"\)/);
 assert.match(source,/if \(nearest\) selectAddress\(nearest.address\)/);
 assert.match(source,/deliveryLocation\.latitude !== point\.latitude/);
 assert.match(source,/deliveryAddress\.trim\(\) !== String\(saved\.address \|\| ""\)\.trim\(\)/);
});

test("radio is an unboxed circular control with visible checked and keyboard states", () => {
 assert.match(css, /\.address-list \.address-card-choice input\[type="radio"\] \{/);
 assert.match(css, /appearance: none;/);
 assert.match(css, /border-radius: 50%;/);
 assert.match(css, /\.address-list \.address-card-choice input\[type="radio"\]:checked/);
 assert.match(css, /\.address-list \.address-card-choice input\[type="radio"\]:focus-visible/);
});

test("modal header icon and close icon have explicit square and centered glyph sizing", () => {
 assert.match(css, /\.delivery-address-dialog \.delivery-address-dialog-icon \.app-icon/);
 assert.match(css, /\.delivery-address-dialog \.delivery-address-dialog-close \.app-icon/);
 assert.match(css, /\.delivery-address-dialog \.delivery-address-dialog-close:focus-visible/);
 assert.match(css, /place-items: center;/);
 assert.match(source, /className="delivery-address-dialog-close"/);
});

test("mobile map header stacks the GPS button under the title and text remains readable", () => {
 assert.match(css, /#addressForm \.delivery-location-head \{\s*display: grid;/);
 assert.match(css, /grid-template-columns: minmax\(0,1fr\) max-content/);
 assert.match(css, /#addressForm \.delivery-location-head \.menu-category \{/);
 assert.match(css, /white-space: normal;/);
 assert.match(css, /@media \(max-width: 640px\) \{[\s\S]*?#addressForm \.delivery-location-head \{\s*grid-template-columns: minmax\(0, 1fr\)/);
 assert.match(css, /#addressForm \.delivery-location-head > \.btn \{[\s\S]*?justify-self: stretch/);
});

test("address card reserves no Home-button gutter and retains edit/delete icon actions", () => {
  const cards=source.slice(source.indexOf('id="addressList"'),source.indexOf('{addressEditor ? createPortal('));
  assert.doesNotMatch(cards,/address-primary-button|set_default|aria-pressed/);
  assert.match(cards,/DeliveryEditArtwork/);
  assert.match(cards,/DeliveryDeleteArtwork/);
  assert.match(css,/body\.delivery-page \.address-list \.address-card-choice \{\s*padding-right: 0;/);
  assert.match(css,/body\.delivery-page \.address-list \.address-card \{\s*grid-template-columns: minmax\(0, 1fr\)/);
});

test("Saved delivery map checkout help wraps within the card instead of nowrap overflow", () => {
  assert.match(locationCss,/#deliveryLocationPicker \.delivery-location-head \.menu-category \{/);
  assert.match(locationCss,/#deliveryLocationPicker \.delivery-location-head \.menu-category \{[\s\S]*?white-space: normal;/);
  assert.match(locationCss,/#deliveryLocationPicker \.delivery-location-head \.menu-category \{[\s\S]*?overflow-wrap: anywhere;/);
  assert.match(locationCss,/#deliveryLocationPicker \.delivery-location-footer > div \{/);
});

test("compact cards have one horizontal selection row and icon-only edit/delete actions",()=>{
 const cards=source.slice(source.indexOf('id="addressList"'),source.indexOf('{addressEditor ? createPortal('));
 assert.match(cards,/className="address-card-content"/);
 assert.match(cards,/selectedAddressId === address\.id \? <span className="address-card-subtitle"/);
 assert.match(cards,/selected_delivery_address/);
 assert.match(cards,/className="address-icon-button"/);
 assert.match(cards,/className="address-icon-button danger"/);
 assert.match(cards,/aria-label=\{t\("delivery\.checkout\.address\.edit"\)\}/);
 assert.match(cards,/aria-label=\{t\("delivery\.checkout\.address\.delete"\)\}/);
 assert.doesNotMatch(cards,/<span>\{t\("delivery\.checkout\.address\.(edit|delete)"\)\}<\/span>/);
 assert.match(css,/body\.delivery-page #addressBook \.address-list \.address-card \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\) auto;/);
 assert.match(css,/body\.delivery-page #addressBook \.address-list \.address-card-actions \{[\s\S]*?grid-column: auto;/);
 assert.match(css,/body\.delivery-page #addressBook \.address-list \.address-card-actions \.address-icon-button \{[\s\S]*?border: 0;/);
});

test("header count is compact and selected subtitle is localized for all five languages",()=>{
 const translations=JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json","utf8"));
 assert.match(source,/id="addressCount" className="address-book-count"/);
 for(const lang of ["th","en","my","lo","km"])
   assert.ok(translations[lang].delivery.checkout.address.selected_delivery_address,lang);
 assert.match(css,/body\.delivery-page #addressBook \.address-book-count/);
 assert.match(css,/body\.delivery-page #addressBook #addAddressButton/);
});

test("Delivery uses store logo and branded hero rather than legacy scooter", () => {
  assert.match(source, /className="hero store-branded-hero" style=\{brandedHeroStyle\(settings\)\}/);
  assert.match(source, /<StoreBrandMark settings=\{settings\} \/>/);
  assert.match(source, /className="store-hero-brand-mark-section"/);
  assert.doesNotMatch(source, /DeliveryScooterArtwork|bi bi-scooter app-icon/);
});

test("saved Edit/Delete buttons now use dedicated SVG designs", () => {
  const cards=source.slice(source.indexOf('id="addressList"'),source.indexOf('{addressEditor ? createPortal('));
  const vectors=fs.readFileSync("react-app/src/components/DeliveryCustomIcons.jsx","utf8");
  assert.match(cards, /<DeliveryEditArtwork \/>/);
  assert.match(cards, /<DeliveryDeleteArtwork \/>/);
  assert.match(cards, /className="address-icon-button danger"/);
  assert.match(vectors, /data-delivery-icon="edit"/);
  assert.match(vectors, /data-delivery-icon="delete"/);
  assert.match(css, /#addressBook \.address-list \.address-card-actions svg\.delivery-address-action-svg/);
});

test("all three saved-address actions use matching outline SVG icons, not mixed fonts",()=>{
 const icons=fs.readFileSync("react-app/src/components/DeliveryCustomIcons.jsx","utf8");
 const section=source.slice(source.indexOf('id="addressBook"'),source.indexOf('{addressEditor ? createPortal('));
 for(const name of ["Add","Edit","Delete"]){
   assert.match(icons, new RegExp('export function Delivery'+name+'Artwork\\('));
   assert.match(section, new RegExp('<Delivery'+name+'Artwork \\/>'));
 }
 for(const kind of ["add","edit","delete"]){
   assert.match(icons,new RegExp('data-delivery-icon="'+kind+'"'));
 }
 assert.match(icons,/strokeWidth: 1\.9/);
 assert.match(icons,/strokeLinecap: "round"/);
 assert.match(icons,/strokeLinejoin: "round"/);
 assert.doesNotMatch(icons,/rgba\(|fill="rgba\(|bi-pencil|bi-trash/);
 assert.doesNotMatch(section,/bi bi-plus-lg/);
 assert.match(css,/DELIVERY_ADDRESS_ICON_SET_20261009_510/);
 assert.match(css,/#addressBook \.address-list \.address-card-actions \{\s*gap: 10px;/);
 assert.match(css,/#addressBook \.address-list \.address-card-actions \.address-icon-button \{[\s\S]*?background: #f0f5f2;/);
 assert.match(css,/#addressBook \.address-list \.address-card-actions \.address-icon-button\.danger \{[\s\S]*?background: #fff3f1;/);
 assert.match(css,/#addressBook #addAddressButton svg\.delivery-address-add-svg/);
});

test("Add/Edit/Delete buttons retain their actions and accessible text",()=>{
 assert.match(source,/id="addAddressButton"[\s\S]*?onClick=\{\(\) => setAddressEditor\(/);
 assert.match(source,/aria-label=\{t\("delivery\.checkout\.address\.edit"\)\}/);
 assert.match(source,/aria-label=\{t\("delivery\.checkout\.address\.delete"\)\}/);
 assert.match(source,/onClick=\{\(\) => setAddressEditor\(\{ \.\.\.address \}\)\}/);
 assert.match(source,/onClick=\{\(\) => deleteAddress\(address\)\}/);
});
