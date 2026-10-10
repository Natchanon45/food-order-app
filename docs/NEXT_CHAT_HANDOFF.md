# Next Chat Handoff — React + Firebase Migration

Updated: 2026-10-10
Project: Food Order / Delivery / Retail POS
Repository: `Natchanon45/food-order-app`

## 2026-10-10 — Cashier modal bill preview and print loader typography (Build .513)

- User screenshot highlighted orange eye action on /cashier in Delivery card; previously view_slip opened a separate browser tab. It now opens an in-page, accessible scrollable bill-details modal (receipt items, customer/address, payment state, amounts, inline uploaded slip) using shared Cashier styling. Also added "View bill" eye action for Take Away, Walk-in and Table bill groups, preserving separate Print button and all payment/cashier/Kitchen gates.
- Receipt print tab waiting screen removes center PG PENGUIN mark while retaining spinner and status. Uses actual shared Kanit Local font files and matching fallback; Thai receipt-preparation message exactly "ระบบกำลังเปิดหน้าพิมพ์ใบเสร็จ กรุณารอสักครู่..." (the primary status heading remains).
- Added modal close X, close footer action, backdrop / ESC dismiss, focus return and scroll containment. Localized bill preview TH/EN/MY/LO/KM. No Firebase API, Cloud Function, Rules or live tenant data changes.
- Tests: bill modal static regression 4/4, receipt loader unit 7/7, full npm run test:react-parity PASS, Chrome CSS modal widths 320/440/1280 PASS, Chrome actual loader 390/1280 PASS, Vite Build and generated contract PASS. Release candidate Version 0.4.283 / Build 2026.10.10.513, JS /react/assets/index-DHwYQlC7.js.
- Hosting-only release prepared; check docs/WORKLOG.md for final deployment. Do not merge main, reset/clean or delete prior untracked hashed JS. Test authenticated cashier with real safe demo order separately.

## 2026-10-10 — Cashier print-tab blank-page repair (Build .512)

- Cashier confirmation created window.open('', '_blank') before awaiting approveDeliveryPaymentReview. The empty tab appeared white for 5–10 seconds while the backend verified payment. The payment gate and Kitchen release were working; this was an uninitialized print-tab UI.
- New utility react-app/src/utils/receiptPrintWindow.js synchronously fills the script-opened tab with a centered, branded, accessible loading UI, then updates status when opening the receipt. CashierPage uses it for single/order and table payments. On payment failure the tab is closed; if popups are blocked or cannot be initialized, original same-tab receipt navigation fallback remains. Receipt auto-print and Slip2Go/Cashier payment approval rules unchanged.
- Loading and preparing messages localized TH/EN/MY/LO/KM. Regression tests: Node unit 6/6; installed Chrome real popup at 390px and 1280px 2/2; full React parity PASS; Vite Build PASS and generated artifact /react/assets/index-Bm69FZDi.js verified for Version 0.4.282 / Build 2026.10.10.512.
- Production deployed: Implementation commit 6fe6c9ac pushed to feature/react-firebase-port (synced 0/0); Hosting-only target foodapp (penguin-food) project chat-45754 returned Deploy complete (580 files). Live /cashier/, /cashier/receipt/, /kitchen/, /delivery/ HTTP 200 all point to /react/assets/index-Bm69FZDi.js, same SHA-256 locally and in Production (b0a363a69a78c280ab12e400117c0c5181940206b00f272dfdc30e4bc01222c6). No Functions or Rules deployed. Preserve historical untracked hashed bundles; do not merge main. New Build required before next Hosting deploy. Actual authenticated manual cashier approval and printer validation still pending user acceptance.

## 2026-10-10 — Delivery payment toggles / Kitchen loader repair (production deployed)

- User clarified self-delivery with PromptPay prepayment, Slip2Go auto verification and cashier manual review during provider downtime; COD must remain available as an optional per-store method. Existing Slip2Go and authorized cashier release rules remain unchanged.
- Current changes on feature/react-firebase-port: Admin adds deliveryPromptPayEnabled and deliveryCodEnabled stored in tenants/{tenantId}/settings/store. Missing flags default to true for legacy shops. Cannot save both off. Delivery live settings show only enabled options and validate before checkout. submitPublicDeliveryOrder independently rejects disabled options inside the store-open Firestore transaction. Kitchen uses loadKitchenMenus for settings+menus plus orders listener, no read of Retail POS-only heldBills, and separates the two error states.
- Regression: test:delivery-server-guard covers all enabled/disabled combinations; test:delivery-slip2go maintains trusted payment gate; Kitchen scope tests added; full parity/build status in WORKLOG.
- User authorized production release. Implementation commit 7ab83f48 is pushed. Version 0.4.281 / Build 2026.10.10.511 is LIVE in Firebase chat-45754: Cloud Function submitPublicDeliveryOrder (asia-southeast1) and Hosting foodapp/penguin-food deployed successfully. Production /admin/, /delivery/, /kitchen/ and /cashier/ returned HTTP 200 using /react/assets/index-PV9uUcY7.js; remote and local bundle hashes match. Live tenant/order/payment data unchanged during smoke. A new Build is required before any subsequent Hosting deploy.
- Do not merge main unless requested; do not remove prior untracked hashed JS bundles.

## Read this first in a new chat

Before changing code, read:

1. `README.md`
2. `STRUCTURE.md`
3. `docs/NEXT_CHAT_HANDOFF.md`
4. `docs/WORKLOG.md`
5. `docs/SAAS_MIGRATION.md` only for historical architecture/background

Then inspect the repository:

```bash
cd /Users/natchanonsripleng/Desktop/Sites/food-order-app
git branch --show-current
git log -1 --oneline
git status --short
```

Do not rely on old chat memory instead of these files and current Git state.
## Latest: User-authorized feature -> main Fast-forward Merge (2026-10-09)\n\n- Authorized user request: commit/push/merge all 477 commits from feature/react-firebase-port to main. Original origin/main `013fd5ad` is ancestor of feature `67ad1f9d`, so exact tree Fast-forward successful in separate clean temporary main worktree; no conflicts. No production redeploy was required because Build `.510` was already live.\n- Preflight passed Operational 7/7, full React Parity, generated-build contract and git diff --check. 16 old untracked generated hashed JS bundles in original Mac feature worktree kept intact.\n- Added docs-only integration note on top of merged main and will sync this commit back to feature. Main/feature remote refs should be verified after final pushes. See WORKLOG.\n\n## Latest: Three coordinated delivery address icons — Build 2026.10.09.510

- User rejected previous visually dense hand-drawn icons and instructed assistant to implement a clean alternative for the three address controls Add, Edit, Delete. Mac-direct feature branch implementation.
- `DeliveryCustomIcons.jsx`: matching open-stroke Lucide-style Plus, Pencil, Trash2 SVGs (24x24 viewbox, 1.9px strokes, round caps/joins, no filled artwork). `DeliveryPage.jsx` uses same Plus in Add header and no-selection notice, preserves Edit/Delete actions/aria-labels. `delivery-addresses.css` redesigns icon-only Edit/Delete actions as understated sage/blush backgrounds without heavy borders; card stays 62px Mobile /66px PC, icons centered and separated 9/10px. No changes to GPS, cart, checkout, Hero or backend.
- Build 2026.10.09.510 main JS `/react/assets/index-Bjs7TiRD.js`. Address UI 17/17, GPS integrity 12/12, Operational, full React parity, Vite build/generated contract PASS. Actual compiled Mac Chrome guest GPS delivery at 320px Add/Edit dialogs open and close correctly, icons centered and no overflow. Further 360px real fixture failed while awaiting Firebase profile, so separate compiled-CSS + exact SVG DOM smoke at 320/360/390/440/768/1280 PASS with no horizontal overflow and zero center offset. Script `tests/react-parity/delivery-icon-triad-css-smoke.mjs` retained for future regression.
- PRODUCTION VERIFIED: implementation commit `238de3c0` pushed to feature/react-firebase-port (0/0), Hosting-only foodapp project `chat-45754` released Build `2026.10.09.510` (577 files). Live Delivery/Admin/Cashier/Kitchen pages HTTP 200 reference `index-Bjs7TiRD.js`, live JS and delivery-addresses.css byte-identical to Mac; previous `.509` bundle preserved. Actual Chrome Production CSS+SVG viewport fixtures 320/360/390/440/768/1280 ALL PASS: 17px Plus, 18/19px Edit/Delete, icon center deviation 0px, action gaps 9/10px, cards 62/66px and no page overflow. Real local React 320px Guest browser Add/Edit modal open/cancel PASS. A 360px real Firebase-backed guest fixture sometimes timed out loading a profile, so functional six-width test is not claimed. No Functions/Firestore/Storage Rules or live tenant/order/customer writes, main merge/reset/clean or old hashed bundle removal. See WORKLOG.

## Latest: Round store logo + Admin drag-to-focus cover for all four order surfaces — Build 2026.10.09.509

- User approved a large **circle logo nearly the Hero height** (NOT the width), upload help square 1200×1200 logo and landscape 1600×900 cover (PNG/JPG/WebP max 8MB), and per-shop cover focus selection by dragging a marker. Shared across Delivery, Table Order, Takeaway, Cashier Quick Order.
- `store-hero-branding.css`: responsive circular shop logo 76px @320, 88px phone 360-440, 112px desktop, white ring/shadow and separate text column, no title overlap. `StoreHeroBranding.jsx` now applies focus-aware backgroundPosition from `storeHeroFocus.js` to all four surfaces, centering old stores at 50/50.
- `StoreBrandingEditor.jsx` Admin cover UI: drag source image target (actual pointer capture and touch), keyboard arrow +/-2% (Shift 10%), Home/reset center, visible marker, coordinates, live crop preview. AdminPage.jsx persists and verifies `shopHeroFocusX/Y` with existing tenant store settings save, resets focus when cover replaced/removed. 5 locale texts for recommended dimensions, max 8 MB and focus UI. No backend/Storage Rules changed and no tenant image uploaded by tests.
- Build 2026.10.09.509, new JS `/react/assets/index-DcBPBVN_.js` (Version 0.4.280 unchanged). Unit focus 6/6 and existing brand 6/6, full Operational/React parity/build PASS. Real compiled Chrome viewport smoke on phone/tablet/desktop PASS, no horizontal overflow. Actual React Editor Vite-only test passed mouse drag, touch tap, keyboard and reset on 320/440/1280; temporary test harness safely removed. Cross-surface Hero fixture smoke validates logo/background in Delivery/Table/Takeaway/Quick Order structures.
- **PRODUCTION VERIFIED**: implementation commit `4769d38a` pushed synced 0/0; Hosting-only foodapp Build `2026.10.09.509` deployed (576 files). Production `/admin`, Delivery, Table Order, Takeaway, Cashier Quick Order, Cashier and Kitchen HTTP 200 reference JS `index-DcBPBVN_.js`; live JS and Hero/branding Admin CSS byte-identical to Mac. Chrome Production CSS fixture at 320/390/440/768/1280 PASS across all four Hero markup shapes with circular logo, saved crop focus (82/18 sample) and zero horizontal overflow. Real existing shop Delivery Production at 440/1280 PASS: circular logos 88/112px and old unset crop falls back 50/50. Browser did not wait for image decoding, so pixel display not asserted. Actual React Admin editor drag/touch/keyboard/reset passed locally on 320/440/1280 in a temporary Vite harness (now removed). Authenticated tenant upload/save not performed to protect existing store photos and settings. No Functions/Rules changes, tenant/customer/order writes, main merge/reset/clean, or old bundle deletion. See WORKLOG.

## Latest: Shop logo + Hero cover upload for Delivery/Table/Takeaway/Quick Order — Build 2026.10.09.508

- User rejected recolored scooter font and requested per-shop uploaded logo, an uploaded shop-related Hero cover in admin Store Settings, and the same customization for dine-in Table Order, Takeaway and Cashier Quick Order. Continued direct Mac development without further permission prompts.
- StoreHeroBranding.jsx + store-hero-branding.css render per-tenant `settings.shopLogoUrl`/`shopHeroImageUrl` (legacy logoUrl/heroImageUrl read support), dark overlay and `background-size:cover` all 4 pages; Delivery section heading also shows logo, never previous scooter. Missing image gracefully falls back to shop glyph and original green gradient.
- StoreBrandingEditor.jsx added under Admin Store Basics: browse/preview/replace/remove logo and cover; StoreBrandingData compresses JPG/PNG/WebP to WebP (alpha retained for logo), max 8MB original / 5MB uploaded, writes only on Store Save to existing tenant-scoped Storage rules `tenants/{tenantId}/product-images/store-branding/...` and saves URLs in tenant settings/store with read-back verification. Removes clear settings display links, not underlying bytes. No Storage/Firestore Rules changes/deploy. Labels localized TH/EN/MY/LO/KM. Real tenant uploads NOT tested and no real account/settings modified.
- Hand-drawn dedicated SVG Edit/Delete actions in DeliveryCustomIcons.jsx replace Bootstrap font glyphs; icon positioning retained 30px/33px tiles, address cards 62px mobile /66px desktop. Scooter-artwork code removed, old static tests updated.
- Build 2026.10.09.508 (JS /react/assets/index-BYxDosD9.js), React parity/operational/build and brand tests 6/6 PASS. Actual installed Chrome visual smoke with read-only logo/cover fixtures 320/360/390/440/768/1280 ALL PASS: responsive cover, mark/fallback, admin previews one vs two columns, centered Edit/Delete, no card/page overflow or runtime error, editor modal works. No order/payment changes.
- PRODUCTION VERIFIED: implementation commit `7f5b241b` pushed to feature/react-firebase-port synced 0/0; Firebase Hosting-only foodapp Build 2026.10.09.508 deployed (575 files), live `/admin`, `/s/.../delivery`, `/s/.../order`, `/s/.../takeaway`, `/cashier/quick-order`, `/cashier`, `/kitchen` reference new `index-BYxDosD9.js` and live JS/CSS bytes match compiled Mac. Production Chrome with isolated read-only Guest+image fixtures widths 320/360/390/440/768/1280 ALL PASS: Hero cover crop, logo/fallback, admin responsive 2/1-column preview, vector Edit/Delete actions, no overflow/page errors. No auth-user actual Storage upload or Firestore store-profile writes; a real shop admin must choose logo/cover and click Save. No Functions/Rules, live tenant/customer/order changes, main merge/reset/clean or prior hashed-bundle deletions. See WORKLOG.

## Latest: Delivery scooter and original Edit/Delete address button styling — Build 2026.10.09.507

- User explicitly requires Mac-direct implementation, not code suggestions. Requested new scooter emblem and restore original clear Edit/Delete icons to the compact saved-address cards.
- DeliveryPage.jsx header `bi-scooter` given `delivery-hero-scooter` class; Edit icon restored to `bi-pencil-square`, Delete remains `bi-trash3`; CSS scoped to Delivery uses mint/green centered scooter badge (34px Mobile, 38px PC), original subtle sage filled Edit and blush/red Delete icon tiles (30px Mobile, 32px PC). No change to callbacks or accessibility.
- Build 2026.10.09.507 generated JS `/react/assets/index-D0M1Jvri.js`. Focused address UI 15/15, GPS integrity 12/12, Operational, full React parity, Vite build/postbuild PASS. Actual compiled Mac Chrome 320/360/390/440/768/1280 PASS: new scooter green at correct size, action icons perfectly Y-centered, gap exactly 8px, cards retain 62px Mobile/66px PC, no overflow or page errors, Edit dialog still opens/cancels.
- PRODUCTION CONFIRMED: implementation commit `06e24109` pushed to feature/react-firebase-port (0/0). Firebase Hosting foodapp Build 2026.10.09.507 deployed (571 files); live Delivery/Admin/Cashier/Kitchen reference `index-D0M1Jvri.js`, live JS + delivery-addresses.css match Mac bytes, previous bundle preserved. Installed Chrome real Production tests at 320/360/390/440/768/1280 PASS: mint scooter badge 34/38px; Edit framed-pencil on sage, Delete bin on blush, action tiles 30/32px with center offset 0px and 8px gap; original 62/66px card heights intact; Edit modal opens, no JS errors/overflow. No Functions/Rules, real user/order writes, main merge, reset/clean or old bundle deletion. See WORKLOG.

## Latest: Delivery slip guidance wrap and confirmation receipt copy — Build 2026.10.09.506

- User supplied screenshot of Slip2Go guidance overflowing the card after slip upload at iPhone 440px, then asked to change the customer Delivery receipt's payment row to 'ชำระเงินแล้ว รอร้านตรวจสอบ' when pending, Lalamove area to 'จัดส่งโดย Lalamove', and item names to 'ตำข้าวโพดไข่เค็ม x 1'. Implement both as ONE Hosting-only release.
- DeliveryPage.jsx assigns the scoped `delivery-payment-slip-review-note` hook; payment-slip.css makes long guidance and unusual filenames wrap safely within the payment card. DeliverySuccessPage.jsx uses pure presentation helpers in react-app/src/utils/deliveryReceiptPresentation.js: pending verification label without mutating paymentStatus; confirmed-paid/COD labels unchanged; provider conditional Lalamove vs self; inline `name x qty`. Success receipt CSS prevents clipping longer item names. TH/EN/MY/LO/KM translations for pending copy and Lalamove.
- Build 2026.10.09.506 with bundle `/react/assets/index-BXZfwSp3.js`. Slip tests 16/16, new receipt helper 5/5, complete React Parity/Operational/build/postbuild PASS. Actual Chrome compiled local UI using *isolated read-only DOM fixtures* tested long mobile review note/filename 320–1280 and receipt statuses/quantities 320/390/440/768/1280, no clipping or page overflow. No actual payment or customer/order/profile writes. Slip payment backend, store hours, GPS selection unchanged.
- PRODUCTION CONFIRMED: implementation commit e461d32c pushed to feature/react-firebase-port synced 0/0; Hosting-only foodapp project chat-45754 deployed Build 2026.10.09.506 (570 files). Live Delivery, Delivery Success, Admin, Cashier, Kitchen reference JS index-BXZfwSp3.js and live JS/payment-slip.css/delivery-success-tracking.css bytes match Mac. Actual Chrome on Production with isolated read-only fixtures: slip review help+long filename 320/360/390/440/768/1280 PASS without overflow; receipt pending payment, Lalamove label and `ชื่อสินค้า x 1` at 320/390/440/768/1280 PASS without clipping. Unit/backend guards PASS. No Functions/Rules changes, customer/order/payment writes, main merge/reset/clean or historical hashed bundle deletion. Real signed-in customer/payment verification remains manual acceptance. See WORKLOG.

## Latest: Compact Delivery saved address cards / inline icon actions — Build 2026.10.09.505

- User explicitly requires implementation (not patch suggestions), matching compact mockup. Previous cards ~100px tall with action buttons on second row; desired cards 65–75px, radio/name left, Edit/Delete icons right, selected-delivery subtitle.
- React DeliveryPage.jsx: radio/title and selected-only translated subtitle left; icon-only accessible Edit/Delete controls right, plain secondary address count and compact Add on header. Same GPS <=100m saved-only policy, manual choice, map, payment and store-hour behavior. No Home default control reintroduced.
- Scoped delivery-addresses.css grid with flexible name + auto controls, cards 62px mobile / 66px desktop, inline icon actions with >=8px action spacing, green selected highlight. Text TH/EN/MY/LO/KM.
- Build 2026.10.09.505, JS /react/assets/index-DFL_FfeQ.js, Version 0.4.280 unchanged. Focused address UI 13/13, GPS integrity 12/12, Operational, full React parity, Build/postbuild PASS. Actual Chrome local compiled app at widths 320/360/390/440/768/1280 PASS, Edit modal works, manual selection overrides GPS, no overflow/page errors.
- PRODUCTION CONFIRMED: implementation commit 641ee56a pushed to feature/react-firebase-port 0/0, Firebase Hosting-only foodapp deployed Build 2026.10.09.505 (568 files), live /admin, Delivery, Cashier and Kitchen HTTP 200 and bundle index-DFL_FfeQ.js + address CSS exactly match Mac. Chrome Production isolated Guest/mobile 320/440/PC 1280 tests PASS: 62px mobile/66px desktop cards, 2 icon-only controls each, selected-only subtitle, add button aligned, edit modal working and no JS errors/overflow. No Functions/Rules, real customer writes, main merge/reset/clean, or old hashed asset deletion. See WORKLOG.

## Latest: Delivery uses GPS and manual saved addresses; no primary Home control — Build 2026.10.09.504

- User approved removing redundant Home/set-default button from Delivery saved-address cards because current delivery destination uses accurate GPS (only within <=100m of saved pin) or customer's explicit selection; out-of-range, denied GPS or no addresses never silently choose the legacy default.
- DeliveryPage.jsx: removed primaryAddressId, makeDefault() setter and Home buttons/UI. Compact card radio selection/Edit/Delete remain. No more default assignment to newly added address or promotion on delete. Existing legacy isDefault field on edited address is preserved exactly, without rewriting others; historical profile schemas/other app consumers unchanged. Manual selection always overrides auto GPS.
- Cleaned 17 dead Home-only CSS rules in delivery-addresses.css, freed label card width. No other UI/map/checkout/backend logic touched.
- Build 2026.10.09.504, JS /react/assets/index-mpUULFMy.js. Targeted address UI 11/11, GPS integrity 12/12, Operational, React full parity, server guard, build/postbuild PASS. Installed Chrome local six scenarios (320/390/440/1280, GPS near/far/denied, no addresses, explicit override, old metadata on edit) PASS. No Production customer/profile/order/payment writes.
- PRODUCTION VERIFIED: implementation commit af90b484 pushed to feature/react-firebase-port synced 0/0. Hosting-only foodapp project chat-45754 deployed Build 2026.10.09.504 (567 files), /react/assets/index-mpUULFMy.js and live Delivery CSS byte-identical to Mac. Production Chrome isolated Guest/GPS smoke PASS: far saved address 320px unselected with warning, iPhone 440 nearest saved address selected, PC 1280 nearest selected, denied GPS 390px unselected and warned; all 0 Home buttons, Edit/Delete/radio present, no page errors/overflow, old profile flags unchanged. No Functions/Rules or real customer/order/tenant data writes, no main merge/reset/clean or previous hashed bundle removal. See WORKLOG.
## Latest: Floating favorite-style Home icon and saved map help wrapping — Build 2026.10.09.503

- User's mobile screenshot requested a Home control visually like the transparent floating product favorite heart, plus repairing long "ตำแหน่งจัดส่ง" saved map help text spilling outside the card.
- Actual 320/440px Chrome baseline showed saved map help forced nowrap at ~473.8px width while map card header was only 236/356px. Scoped `#deliveryLocationPicker` CSS now makes that help wrap naturally to the card width, including translated long text. Does not modify the address-edit modal or map/geolocation behavior.
- Home default control CSS now matches favorite-style floating icon (transparent borderless 30x30px top-right; empty gray outline, selected solid green house), including keyboard focus and hover; remains single saved primary and does not alter selected checkout address. Product favorite button logic unaffected.
- Build **2026.10.09.503**, JS `/react/assets/index-BjEjutke.js`, Version 0.4.280. Focused address UI 10/10, Operational/full React Parity, Build/postbuild PASS. Actual compiled Chrome guest fixture at widths 320/360/390/440/768/1280 PASS: Home border 0, alpha transparent, 8px card inset; selected Home persisting uniquely; saved map description wrapping (mobile 37-56px height), no clipping/overflow, original checkout selection preserved.
- PRODUCTION VERIFIED: implementation commit `0b09de9b` pushed to feature/react-firebase-port 0/0, Firebase Hosting foodapp released Build 2026.10.09.503, 566 files. Live Delivery/Admin/Cashier/Kitchen pages use JS index-BjEjutke.js, bytes of JS and delivery address/map CSS match Mac. Production Chrome isolated guest/virtual GPS smoke at 320/440/1280px PASS: no saved-location help overflow, floating borderless transparent green Home icon, clicking Home persists exactly one default while current checkout destination is unchanged. Local tests 10/10 and full React parity/operational/build PASS. No Functions/Rules changes, real tenant/order/customer writes, main merge, reset/clean, or old hashed bundle removal. Physical-device GPS validation remains manual; see WORKLOG.



## Latest: Delivery address card and mobile modal visual repair — Build 2026.10.09.502

- User screenshots after .501 showed a square border around radio, oversized modal location icon/unbalanced close control on PC, and unusable mobile modal map heading at 440px.
- Root cause confirmed via Chrome computed geometry: mobile map heading had a 100%-width GPS button still arranged in a flex row, compressing the title to 0px at 440px. Old global icon sizing enlarged glyphs. These bugs evaded 320px-only checks.
- Fixed only react-app/public/parity/css/delivery-addresses.css: explicitly circular 20px radio with keyboard focus and refined card styling; center-aligned pin/close glyphs in proportionate buttons; map header now two columns on PC and one stacked column <=640px with readable description and independent full-width GPS action. Mobile modal fills screen and scrolls with fixed footer; saved-address logic, unique home primary and native Google marker unchanged.
- Build 2026.10.09.502 JS /react/assets/index-dsgwEW43.js. Focused UI regressions 8/8, Operational, full React Parity, build contract PASS. Actual installed Chrome widths 320/360/390/440/768/1280: radio 50% radius with no square, icon/close center difference 0px, mobile map title 278-384px wide with button beneath, desktop right-aligned button, no overflow/page errors, map usable.
- PRODUCTION CONFIRMED: feature commit a6a912b2 pushed to feature/react-firebase-port 0/0; Firebase Hosting foodapp deployed Build 2026.10.09.502, 565 public files. Live /admin, Delivery, Cashier, Kitchen pages reference index-dsgwEW43.js and JS/delivery-addresses.css bytes match Mac. Production Chrome guest/GPS read-only smoke at 320/440/1280 PASS: radio no box (round 50%), pin and close glyphs precisely centered (0px error), mobile map title readable (384px at 440, previously 0px), independent full-width GPS button actually works, no horizontal overflow or console page errors; PC right-aligned GPS action retained. No Functions/Rules changes or real data writes; physical-device Safari remains manual acceptance. No main merge/reset/clean or old bundle removal.

## Latest: Compact saved delivery address cards and wide editor — Build 2026.10.09.501

- User screenshot PC/Mobile requested header "ที่อยู่จัดส่งของฉัน" + Add Address on one row; address cards show only address labels (details during edit only); "ตั้งเป็นหลัก" replaced with clickable house icon top-right on each card with exactly one default; edit/create form and Google map enlarged significantly across PC/Mobile.
- DeliveryPage.jsx: compact radio-selectable cards, accessible top-right \`address-primary-button\` with \`bi-house\` / \`bi-house-fill\`, \`aria-pressed\`, separate edit/delete actions. Exclusive default normalized on saving/editing/deleting and by \`makeDefault\` persisting profile. Current selected delivery destination does NOT change when setting primary. No default editor checkbox.
- Address form uses a portal dialog to body with fixed header/footer and scrollable inputs + map, mobile nearly full viewport and PC up to 700px, Escape close and visible validation. \`delivery-addresses.css\` responsive 320–1280, single-row header and compact card.
- Existing saved-address-only checkout, 100m GPS selection, Google native marker, and server store-hours protection unchanged. Guest test profile only, no live tenant writes. New \`tests/react-parity/delivery-address-book-ui.spec.mjs\` 5/5 PASS, integrated full React parity; changed existing Playwright fixture to allow GPS within 100m and assert home icon. Full React parity / operational / Vite Build PASS. Installed Chrome actual compiled-app test at 320/360/390/440/768/1280 confirms single-row Add, compact cards, unique persisted primary icon, edit modal width 308–700px and map width 270–626px, no horizontal overflow, validation/ESC PASS; guest profile edit/save + create/save pinned address PASS.
- PRODUCTION CONFIRMED: implementation commit \`ffbf5138\` pushed to feature/react-firebase-port (0/0); Hosting:foodapp project chat-45754 deployed Build 2026.10.09.501. Live /admin, Delivery, Cashier & Kitchen HTTP 200 and JS index-CbV5hfUt.js / delivery-addresses.css exactly match Mac. Chrome Production isolated guest profiles PASS at 390 and 1280px: one-line header/Add, 99px cards with no details, exactly one clickable persisted home primary, modal and Google map large with no overflow/errors. Local Chrome 320–1280 and guest save/edit/create also PASS. No Functions/Rules changes, real tenant writes, main merge/reset/clean or old bundle deletion. See WORKLOG.

## Latest: Delivery saved-only GPS address matching and Google pin cleanup — Build .500

- User clarified: even when there is exactly ONE saved default address, if fresh accurate device GPS is farther than 100m from it, do NOT select it automatically. If multiple saved addresses, auto-select the nearest only if inside 100m. If GPS unavailable/coarse, or no addresses nearby, leave checkout selection empty and show customer a clear choice: manually select saved address or add/save a new address with its own GPS pin. With zero saved addresses, Delivery cannot proceed.
- In DeliveryPage.jsx, raw GPS and manual checkout map click/text can never create a new unsaved delivery destination. Saved address ID, exact saved pin coordinates and address text must match before submission; still permits explicitly choosing a saved address outside current GPS range. The old pin-confirm checkbox, state, and requirement were removed. Checkout Google map is view-only for saved pin; separate saved-address editor retains GPS/map editing. Selected address deletion clears checkout pin. Guard persists for store-hours and payment.
- DeliveryLocationPicker.jsx uses ONLY native Google Maps Marker, removing the duplicate green independent marker, and removes the checkout-level GPS button (saved address editor retains it). Orphaned mapPinProjection.js intentionally removed, previous hashed Vite bundles not removed.
- Improved closed shop banner and added amber choose-or-save notice; 5 supported languages updated. No backend, Functions or Rules changed. As guest address book is browser-local, this Saved Address membership check is a frontend rule, whereas existing Backend store-hours blocking remains separate.
- Build 2026.10.09.500, bundled JS /react/assets/index-a0X6jxym.js. Location integrity 12/12, Opening Hours 10/10, Server Security 7/7, Operational, React Parity and generated build PASS. Chrome local compiled-app scenarios PASS on PC/mobile: one far default, one near, closest of several, no addresses, GPS denied and explicit manual selection. No live customer data/order writes.
- PRODUCTION CONFIRMED: implementation commit b318bae9 pushed to feature/react-firebase-port 0/0; Firebase Hosting foodapp released Build 2026.10.09.500. Live /admin, Delivery, Cashier and Kitchen reference index-a0X6jxym.js; JS and Delivery CSS exactly match Mac. Live Chrome with isolated guest profile/emulated GPS PASS on PC and Mobile: one far saved remains unselected and warns, multiple saved near picks closest, zero saved blocked, GPS denied unselected, no green overlay or old checkbox. Real physical GPS, authenticated customer data and actual order remain manual acceptance. No Functions/Rules changes, tenant writes, main merge or historical bundle deletion.

## Latest: Admin Delivery opening-hours UI toggle + full day labels — Build .499

- User screenshot /admin requested a right-side toggle switch for manual Open/Close alongside Restore Normal Schedule button in same header row; change weekday labels to full Thai and English names and all supported locales.
- DeliveryHoursEditor component now uses accessible controlled role=switch, persisted effective opening state for checked, the existing immediate admin save callback for mode open/closed (with reason/end time), and Restore Schedule button in the same right-aligned header row. Mobile short schedule label fits down to 320px.
- CSS and TH/EN/MY/LO/KM translations updated. Underlying day numbers and Firestore schema unchanged. Build 2026.10.09.499, new asset /react/assets/index-Cfuu91Og.js. No backend or Rules changes.
- Targeted tests 10/10 and server guard 7/7 PASS; Operational, full React parity and build PASS. Chrome rendered actual component TH/EN 320-1366px and MY/LO/KM 440px with no overflow, tested Closed->Open->Normal Schedule callbacks successfully.
- PRODUCTION CONFIRMED: implementation commit 604e61c8 pushed to feature/react-firebase-port, 0/0 ahead/behind; Firebase Hosting foodapp deployed Build 2026.10.09.499. Live /admin, Delivery, Cashier, Kitchen HTTP 200 and /react/assets/index-Cfuu91Og.js, admin-opening-hours.css and Firebase shared asset byte-identical to Mac. No production tenant toggle, auth-session or payment tests; UI component tested locally with actual React interaction. No Functions/Rules changes, no tenant writes, no main merge/reset/clean/deletion of old bundles.

## Latest: Delivery server-side closed-store enforcement — Build 2026.10.09.498

- User explicitly authorized **Cloud Functions and Firestore Security Rules** to prevent external/custom SDK order submissions while store is closed, after .497 client-only schedule protection.
- Problem: public Firestore direct \`orderType="delivery"\` create was allowed in both root \`/orders\` and tenant \`/tenants/{id}/orders\`; frontend safeguards were bypassable.
- New isolated \`functions/public-delivery-submit.js\` callable \`submitPublicDeliveryOrder\` (asia-southeast1, Node22) validates public guest Delivery payload and computes hours with \`functions/delivery-opening-hours.js\` matching React Bangkok timezone policy. Admin SDK Firestore transaction atomically reads store schedule, manual override and order ID; blocks closed/missing/retail-only/duplicates, creates new pending Delivery with server-owned status/ID/timestamps.
- React now submits \`createPublicDeliveryOrder\` via callable after existing gift/Slip2Go steps, preserving API shape. \`firestore.rules\` blocks all client direct Delivery order creates on root/tenant paths and orderType-morph updates; Takeaway, Table, other channels retain create permissions. Existing orders are unchanged.
- New \`delivery-server-guard.spec.mjs\` 7/7 PASS and updated \`delivery-opening-hours.spec.mjs\` 10/10 PASS; Operational, Full React Parity, Vite build/postbuild & Function Node syntax PASS. Build **2026.10.09.498** asset \`/react/assets/index-CNsdruuu.js\`.
- Rollout must be ordered: deploy **only** \`functions:submitPublicDeliveryOrder\` -> verify -> **hosting:foodapp** -> verify new JS -> **firestore:rules** -> verify. Do not deploy other Functions/Rules, no data mutation, no main merge/reset/clean. Java is unavailable on Mac so Firestore Emulator not executed; rely on static contract tests and Firebase compilation. User should refresh cached prior Delivery builds to avoid client direct-write denial after Rules change.
- PRODUCTION CONFIRMED: implementation commit \`728a6eb7\` and Rules cleanup \`44d373fb\` pushed. Callable \`functions:submitPublicDeliveryOrder\` Node22 Gen2 deployed in asia-southeast1, invalid-input live probe HTTP 400; a valid-shaped fake COD request for nonexistent tenant was rejected by real Firestore transaction (HTTP 404 DELIVERY_STORE_STATUS_UNAVAILABLE) without creating an order. Hosting \`foodapp\` deployed Build .498, live /admin, Delivery, Cashier & Kitchen routes HTTP 200 and bundle byte-identical. Firestore Rules compiled and deployed **twice**, final clean version without compiler warnings and blocking public client Delivery creates on root and tenant paths, old Table/Takeaway create rules unchanged. Chrome post-Rules Delivery PC 1280/Mobile 390 read-only smoke PASS. Java unavailable so emulator not run, and real authenticated checkout remains manual acceptance. New functionality is closure enforcement, not general spam/App Check/payment fraud prevention; anonymous guests may order via guarded callable while store is open. See latest WORKLOG.

## Latest: Weekly Delivery opening hours + emergency open/close — Build 2026.10.09.497

- Requested restaurant shop weekly schedule (each Monday–Sunday with enabled checkbox + per-day opening/closing HH:MM), with a separate immediate override for emergencies/renovation (open now, close now, normal schedule; optional reason and Bangkok-local end time). Checkout outside allowed periods shows a prominent "store closed" status and blocks new Delivery orders. Table, Takeaway, Retail POS unaffected.
- \`DeliveryHoursEditor.jsx\` lives inside Admin Settings; weekly \`deliveryHours\` saved with existing Store Settings button; \`deliveryManualStatus\` saved immediately and separately via \`saveAdminStoreSettings\`. Current status uses saved schedule (not unsaved edits). Settings live at \`tenants/{tenantId}/settings/store\`; **no DB backfill**; older shops remain open 24/7 until weekly schedule explicitly enabled, so current merchants do not unexpectedly close at deployment.
- \`deliveryOpeningHours.js\` evaluates weekdays + 24h/overnight hours in Asia/Bangkok, temporary closure/reopen expiry; customer \`DeliveryPage.jsx\` live \`onSnapshot\` and 15s tick display closed banner/owner reason, disable cart actions and Submit; first settings snapshot must load before page ready.
- \`publicStorefrontData.js\`: uncached store status read before payment step; Firestore \`runTransaction\` checks the latest store settings alongside the Delivery order write, rejects if closed. **Security caveat:** separate Firestore Rules or server-side order submission is still needed against arbitrary malicious SDK writes; Functions/Rules have not been deployed or changed (Hosting-only policy). Existing orders, payout/Slip2Go logic unaffected.
- Version 0.4.280 Build **2026.10.09.497**, main asset \`/react/assets/index-xdqGCsHK.js\`. Targeted opening-hours regressions 10/10 PASS, Operational PASS, full React Parity PASS, build/contract PASS, responsive static Chrome layout 320–1366px PASS. TH/EN/MY/LO/KM messages. Worklog has scope and verification.
- PRODUCTION CONFIRMED: commit dcdb1325 pushed to feature/react-firebase-port (0/0); Hosting:foodapp deployed to penguin-food.web.app. Live /admin, /delivery, /cashier, /kitchen reference index-xdqGCsHK.js and new Firebase runtime firebase-IqF1EeP8.js; CSS and JS match Mac bytes. Read-only Chrome Production Delivery PC 1280/Mobile 390 loaded; old unconfigured test shop remained open. No real tenant Admin override save or customer order/payment tests. If user wants rule-level protection against direct Firestore SDK writes outside schedule, obtain explicit Rules/Function rollout approval first. Never merge main, reset/clean or delete historic Vite bundles.

## Latest: Show independent delivery pin only after map projection — Build 2026.10.09.496

- After .495, live Google Maps production smoke showed an overlay pin could flash at top-left before Maps initialization, because JSX made pin visible as soon as valid coords arrived.
- .496 fixes this: the independent geo-anchored pin remains hidden until \`mapState==="ready"\` **and** \`syncVisiblePin\` has calculated a valid projected pixel position; default CSS visibility is hidden. Cleanup/invalid pin also hide. Preserves closest saved address selection (<=100m after profile loading), standalone saved editor, customer confirmation, and self-delivery route sharing.
- Release Build **2026.10.09.496**, generated asset \`/react/assets/index-C7iJdWGI.js\`. Targeted location regressions **12/12 PASS**, React parity and build contract PASS. Google Maps real production acceptance still pending until Hosting release checked; no real customer writes.
- PRODUCTION VERIFIED: commit 5de1b27f pushed to feature/react-firebase-port; Firebase Hosting foodapp deployed to penguin-food.web.app. Chrome on real Production and actual Google Maps JavaScript, using isolated guest address fixture and emulated GPS, PASS on PC 1280 and Mobile 440: selected nearest saved B, map content loaded and projected marker visible. Still require real device/customer verification. No Cloud Functions/Rules, tenant writes, main merge, reset, or historic bundle removal.

## Follow-up: Google Maps lite/static renderer visible pin — Build 2026.10.09.495

- Post-.494 Production browser check found Google Maps could render using StaticMapService/lite HTML instead of classic \`.gm-style\`, with correct Saved Address values but no reliable native Marker visual. Prior \`.gm-style\` wait timeout was a too-specific map-renderer check, not proof that Google Maps API was absent.
- \`react-app/src/utils/mapPinProjection.js\` projects the saved coordinate to viewport pixels using Mercator zoom/centre with world wrap, and \`DeliveryLocationPicker.jsx\` draws an independent, pointer-transparent visible pin anchored to the true customer coordinate. It updates on Google map centre/zoom/idle, stays positioned when map pans, and hides invalid/offscreen pins. Native Marker remains for drag interaction. \`delivery-location-map.css\` adds high-contrast marker styling.
- Build **2026.10.09.495**, bundle \`/react/assets/index-BGHWZobX.js\`. Regression 12/12, React parity and operational contracts, Vite build/contract PASS. Chrome compiled-app PC width 1280 & mobile 440 using controlled Maps renderer: visible overlay pin at selected saved B; pan east moves projected pin left. No real customer's GPS was used. Earlier .494 fix (profile-before-GPS and map load race) remains.
- Implementation commit/push and Hosting production verification pending at this checkpoint. Deploy Hosting:foodapp only, no Functions/Rules/tenant writes, no merge main, no deletion of old bundles. Real iOS/Android Google Maps acceptance still required.

## Latest Google Maps marker and address-first loading checkpoint — Build 2026.10.09.494

- User found that after .493 the selected Saved Address and numeric coordinates did not always produce a visible Google Maps marker. Root cause: async Google Maps init captures null \`normalized\`, creates a hidden pin, and missed new \`value\` updates that arrived before \`mapRef.current\` existed; map click listeners also captured old React callback.
- Fix \`DeliveryLocationPicker.jsx\`: read latest coordinates via \`locationRef\` at API completion; synchronize marker creation/visibility/position and map centre/zoom when Maps becomes ready, even if address loads before map. Remove marker for invalid/cleared pin; use \`applyRef\` to keep click/drag up to date. PC and Mobile both.
- Fix \`DeliveryPage.jsx\`: start initial geolocation only **after** the saved address book loads, then select nearest valid saved pin within 100m (Laravel policy). When no saved pin near GPS, keep GPS and prompt to enter/verify delivery address + pin with store; when GPS unavailable, explain default saved fallback. Existing explicit pin confirmation remains. Messages localized TH/EN/MY/LO/KM.
- Build **2026.10.09.494**, main asset \`/react/assets/index-D8_RhRxF.js\`. Location integrity regressions **11/11 PASS**, React parity PASS, build contract PASS, Git diff --check PASS. Chrome on Mac with controlled Google Map/Marker mock: Desktop 1280px & Mobile 440px rendered correct marker at auto-nearest Saved B with zoom 16, changing to Saved A moved pin, clicking map updated pin and deselected A. These are real DOM interactions on compiled app but not live device GPS or production Google Maps tiles.
- Implementation commit/push and Hosting release pending when checkpoint was drafted. Update after production verification. Only Firebase Hosting; no Functions/Rules, customer profile/order writes, main merge, reset/clean or deletion of existing hashed assets.

## Latest Laravel GPS-nearest and driver-route checkpoint — Build 2026.10.09.493

- User specifically wants **Laravel MASTER location flow**: auto request device GPS when customer opens Delivery on PC/mobile, select the nearest saved address to that GPS (up to 100 metres) even when it is *not* the default saved address. Explicit clicks/drags must never auto-snap. If no saved pin is nearby, use raw GPS; if GPS unavailable, fallback to default saved address.
- Read-only Laravel files used for reference: \`public/assets/js/delivery-location-map.js\`, \`delivery-location-address-resolver.js\` and \`delivery-addresses-normal-button.js\` from \`/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80\` (main).
- React now requests fresh GPS on page mount and waits for guest/customer profile before initial selection; \`deliveryLocationPolicy.js\` provides 100m closest saved-match only for \`current-location\` sources. User manual choices win if GPS callback arrives later. Strict GPS accuracy, no silent saved pin rewriting, separate Saved Address map, payment lock and explicit checkout pin confirmation remain protected.
- User also wants self-delivery driver Maps link from **store -> customer**, not current-driver-position -> customer. \`deliveryDriverMapsUrl(order, storeLocation)\` now requires validated origin from existing read-only \`getOperationalStoreSettings(tenantId)\` (\`tenants/{id}/settings/store\`: \`storeLatitude/storeLongitude\`) and validated order \`deliveryLatitude/Longitude\`. Missing store/customer pins block share with a localized error. Other delivery providers excluded.
- Build **2026.10.09.493**, Production asset \`/react/assets/index-CkmdkY6R.js\`; location regressions 9/9 PASS, driver route 6/6 PASS, operational & React parity suite PASS, build verification PASS. Chrome local and **Production** browser PC and Mobile: closer saved B wins against default A automatically; manual override intact; GPS denied falls back to A. See latest WORKLOG.
- **PRODUCTION CONFIRMED:** implementation commit \`bbd881f9\` pushed to \`origin/feature/react-firebase-port\`, Firebase Hosting \`hosting:foodapp\` deployed to \`penguin-food.web.app\`. Live Delivery/Cashier/Kitchen routes HTTP 200 reference \`index-CkmdkY6R.js\`, SHA256 byte-identical to Mac; prior .492 JS still accessible. Real iOS/Android GPS and authenticated Cashier Google Maps sharing still require manual acceptance. No Functions/Rules, customer data writes, main merge, reset/clean, or historical bundle deletion.
- **Supersedes Build .492 behavior** that deliberately did NOT choose a nearby saved address. The user's new requirement explicitly restores that Laravel behavior; do not regress to no-match mode.

## Latest Delivery GPS/saved-address checkpoint — Build 2026.10.09.492

- User reported GPS/current location and previously saved address pins mismatching, after the earlier driver-share release.
- Fix: **removed automatic 100m nearest-saved-address snapping**. Fresh GPS never gets replaced by a nearby saved pin. Initial default saved address still prefills, and explicit Saved Address selection pins exact saved coords. Google map viewport pans to selected saved pin.
- Saved Address editor has an **independent pinned map**; new address starts unpinned, editing existing address shows only that address's own stored coordinate, and only explicit Save Address persists it. Checkout no longer silently rewrites saved coordinates after successful order.
- GPS must be fresh, accuracy estimate <=100m; coarse/unavailable fix warns and leaves old pin unchanged. Checkout requires explicit customer pin confirmation before locking payment or submitting; checkout lock prevents pin/text selection changes. TH/EN/MY/LO/KM localized.
- Regression tests 8/8 PASS, operational PASS, React parity PASS, build contract PASS; Chrome local-browser guest scenario with saved A/B very close + GPS different: PASS; coarse 350m GPS rejects and warns: PASS. Final bundle **\`/react/assets/index-CsqMnk5f.js\`** Build **2026.10.09.492**.
- **PRODUCTION CONFIRMED:** implementation commit \`f6769081\` pushed to \`origin/feature/react-firebase-port\`; Firebase Hosting \`foodapp\` deployed successfully. Live Delivery, Cashier and Kitchen canonical routes HTTP 200 and use \`/react/assets/index-CsqMnk5f.js\` with SHA-256 byte-identical to Mac; Live Delivery CSS matches. No Functions/Rules/customer data mutation, no main merge, no reset/clean of historical bundles.
- After release, read-only Chrome smoke at real Production with isolated guest profile and mocked geolocation PASS (Saved A, different GPS <100m away, Saved B editing independent). Previously saved pins that are already incorrect **cannot be recovered automatically**: customer must explicitly edit, reposition on map and save. Physical GPS/Google Maps on real iOS/Android remains an acceptance test, not proven by Chrome mocked geolocation. Details in latest \`docs/WORKLOG.md\`.

## Latest self-delivery driver-share checkpoint — Build 2026.10.08.491

- User requested a **share-to-driver Google Maps button for store-managed Delivery only**, not Lalamove. Implementation is on \`feature/react-firebase-port\`; authoritative history in the last section of \`docs/WORKLOG.md\`.
- Cashier's Delivery order card now offers both \`ตรวจสอบบน Google Maps\` and \`แชร์พิกัดให้คนขับ\`, using the already persisted order deliveryLatitude/deliveryLongitude. Native share when available, otherwise clipboard, otherwise manual copy. Order number/address and Maps URL only; no phone. Invalid coordinates disable sharing. Lalamove/third-party excluded, including orders with Lalamove dispatch evidence. Legacy self-order with missing provider but no Lalamove metadata supported.
- React Build .491 **Production released**; generated bundle \`/react/assets/index-cdWz40EM.js\`. Targeted regressions 6/6 PASS, Operational PASS, React Parity PASS, build contract PASS, isolated Chrome responsive panel at 320/390/440/1024px PASS.
- Production CONFIRMED: commit \`35833f0c\` pushed to \`origin/feature/react-firebase-port\` and \`hosting:foodapp\` deployed successfully. Production /cashier, /cashier/quick-order, /s/saas-test-shop/delivery and /kitchen return HTTP 200 referencing \`/react/assets/index-cdWz40EM.js\` (SHA-256 matches Mac build); Cashier responsive CSS live and byte-identical. No Functions/Rules, tenant data, bundle deletion, or main merge.
- Important outstanding issue **not fixed by this feature**: auto-detected GPS vs saved address coordinate mismatches in DeliveryPage. Sharing uses the saved order pin, so customer/staff must confirm the pin before giving to driver. User follow-up for real mobile share/LINE and Google Maps app is still required.

## Latest checkout/receipt checkpoint (2026-10-08, supersedes earlier .487-.489 notes)

- Prior Build 2026.10.08.489 IS on Production (observed live asset `index-BCW1U1rO.js` matching local SHA-256), despite the historical .489 handoff claiming it was not deployed. Do not deploy .489 again.
- React Build 2026.10.08.490 Production release fixes Delivery PromptPay QR PNG downloads (including native-touch-safe link), successful Delivery checkout browser Back/history, and Quick Order receipt tab afterprint/paid-Walk-in cashier notification replay. See the latest section of `docs/WORKLOG.md` for causes, implementation and regression details.
- Operational PASS; React Parity PASS; targeted regressions 5/5 PASS; Build contract PASS. Built hashed asset: `/react/assets/index-BC-WUDBh.js`. Chrome Desktop and mobile-touch simulation downloaded valid actual PNG files.
- **PRODUCTION CONFIRMED:** implementation commit `fad923ad` pushed to `origin/feature/react-firebase-port`, Firebase Hosting `foodapp` deployed successfully. Live Delivery, Quick Order, Receipt, Cashier and Kitchen canonical pages HTTP 200 and all load `/react/assets/index-BC-WUDBh.js`, matching local Build 2026.10.08.490 SHA-256; previous .489 bundle is still accessible.
- Only Firebase Hosting release is permitted for this frontend fix. Never deploy Cloud Functions / Rules without explicit permission, merge main, or delete old hashed assets. Real customer Delivery and staff receipt workflow E2E still require user verification.

## Current repository state

- Active path: `/Users/natchanonsripleng/Desktop/Sites/food-order-app`
- Active branch: `feature/react-firebase-port`
- Staff Shifts implementation commit `52191579 feat: migrate POS staff shifts to React`, corrective visual commit `e4d51e06 fix: finalize POS shifts visual parity`, and confirmation-dialog parity commit `f062ad45 fix: replace POS native confirms with app dialog` are pushed.
- Canonical Products /pos/products is complete on Production Build 2026.10.04.382 via implementation commit `005b7d83` and readiness corrective commit `525fcec0`.
- Canonical Stock Movements implementation commit `0bd89a9a feat: migrate POS stock movements to React` and corrective visual commit `d958d964 fix: finalize POS stock movements visual parity` are pushed.
- Canonical Stock Movements is complete on Production Build 2026.10.04.384.
- Canonical Stock Counts implementation commit `4aa5227a feat: migrate POS stock counts to React` is pushed and complete on Production React Build 2026.10.04.385 / Public Build 2026.10.04.100. Preserve any remaining uncommitted/untracked work.
- Do not reset / clean / discard.
- Never merge to `main` unless the user explicitly requests it.

Laravel MASTER reference:
- `/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80`
- branch `main`
- Laravel MASTER is the UI/behavior source of truth.

Local React dev server:
- `http://127.0.0.1:5002`

## Current objective

Maintain the completed and Production-deployed full-React frontend while preserving business behavior and tenant/data safety. Laravel MASTER remains authoritative for non-POS migration areas unless a newer user instruction overrides it. For POS route-specific UI from `/pos/sales` onward, the user now explicitly prefers intentional modern visual redesign over legacy visual parity.

Active focus as of 2026-10-08: **Restaurant/Cafe Delivery Slip2Go candidate is complete on React Build 2026.10.08.483, source commit ed16dcc8 (feat: verify restaurant Delivery slips via central Slip2Go with cashier fallback). Customer PromptPay slips are checked with PENGUIN central Slip2Go credentials/credits but receiver validation uses each tenant store's own PromptPay proxy. Auto-match requires authoritative server menu subtotal + delivery fee + total, exact slip receiver/amount, unique bank transaction reference, and a fresh server proof bound to order/cart/slip. Duplicate/amount mismatch/receiver mismatch/invalid results stop checkout so the customer can re-upload or switch to COD. Slip2Go/config/quota/rate-limit or unconfirmable delivery-fee paths fall back to server-recorded Cashier manual review. Cashier sees every Delivery order and manual approval runs through a trusted callable with actor audit; auto-matched orders need no receive-payment action. COD enters Kitchen immediately; PromptPay enters only after server auto-match or Cashier approval; Kitchen admission notifications fire on that transition. Firestore Rules protect manual-review payment fields from client staff writes. Candidate validation: Functions syntax PASS, Operational PASS, React parity PASS, Slip2Go+Kitchen 12/12 PASS, Firestore Rules dry-run compile PASS, targeted 4-Function dry-run PASS, React build contract PASS on /react/assets/index-BFsKHcE-.js, Hosting-emulator P0 52/52 PASS, Delivery parity 6/6 PASS. Delivery Success browser suite had 5/5 skipped because no success-order fixture was supplied, with no failures. **Production remains Build 2026.10.08.482. Nothing from .483 is deployed. Coordinated release requires Hosting + verifyDeliveryPaymentSlip, finalizeDeliveryPaymentSlip, approveDeliveryPaymentReview, notifyKitchenDeliveryAdmitted + Firestore Rules; do not deploy backend/Rules without explicit user authorization.** No merge to main.**

Previous active focus earlier on 2026-10-05: **React canonical `/pos` mobile/tablet sale workflow is now Production-deployed on React Build 2026.10.05.424 / Public Build 2026.10.05.139 via `0dbedc6c fix: restore POS mobile sale cart`. The React Tailwind responsive layer intentionally hides the desktop cart panel below 1024px, but React had not recreated Laravel's `retail-mobile-cart-bar.js` replacement UI, so products could be added while there was no visible bill/cart/payment path on mobile. React now renders the Laravel-style bottom sale-cart bar and slide-up/centered drawer through 1023px, including cart rows, net total, checkout, Hold Bill, and Held Bills. Production verification passed with deployed `/react/assets/index-BIOAaUA1.js`: at 440x956 the bar appears after adding a product, opens the drawer, and opens the existing payment dialog; at 768px the centered tablet bar works; at 1024px the mobile bar is hidden and the desktop cart panel is visible. Horizontal overflow, page errors, request failures, and HTTP errors were zero. Four expected customer-display Firestore write attempts occurred while adding products during verification and were intercepted/blocked, so Production data was not modified. POS migration remains complete through `/pos/settings`; remaining routes are `/pos/backup` and `/pos/users`, with `/pos/backup` next.**

Retail POS migration / design rule (updated by user 2026-10-04): **preserve all business logic, permissions, tenant scope, Firestore behavior, actions, export/print workflows, and important stable DOM/action contracts while replacing legacy implementation with React. The shared POS navigation drawer remains the approved tenant-selectable theme system (Modern Card v2.3 default). NEW visual exception explicitly approved at 20:39 on 2026-10-04: starting with `/pos/sales` (Sales History) and subsequent POS management/report screens, route-specific UI no longer has to visually match the old legacy 1:1 layout. These screens should be actively redesigned to be modern, colorful, graphic-rich, easier to scan, and responsive, while preserving the underlying behavior/data boundaries. Do not revert redesigned screens merely to satisfy old visual-parity expectations; update regression contracts to guard functionality plus the approved new visual structure.**

Retail POS current checkpoint: **canonical POS routes remain React and Production remains on Build 2026.10.08.482. The .483 candidate is Restaurant/Cafe Delivery Slip2Go only; no Retail POS business logic, collections, payment flow, or sale behavior is changed. Existing Backup/Users safety, five-theme navigation, Master business access and POS initial-readiness behavior remain unchanged.**

Customer React production-test checkpoint (2026-09-30 evening):
- Table Order React is deployed for cross-device/mobile testing on the canonical customer URL `/s/{slug}/order` without requiring `/react`.
- Final build commit before deploy: `affb7d25` (`build: finalize Order React test deploy`).
- React Version `0.4.280` / Build `2026.09.30.295`; public storefront Version `0.16.32` / Build `2026.09.30.010`.
- Generated production candidate shell references `/react/assets/index-BoWOX-Jp.js`.
- User confirmed Firebase Hosting deploy completed. Current next step is real production testing on desktop + mobile before starting Takeaway React.
- Historical note: Takeaway / Delivery / Delivery Success were outside this Order-only test cutover. Retail POS was paused at that point but resumed on 2026-10-03 as documented above.

PENGUIN branding checkpoint (2026-10-02):
- Public-facing brand is PENGUIN; compact fallback mark is PG. Visible KINJAI, LUKKAJA, Food Order Delivery, FOOD ORDER QR, standalone FOD, and KJ branding must not surface in the UI.
- Uploaded Platform App Icon is the first-choice header icon globally; Logo remains primary for login/large logo surfaces.
- Header fallback order: App Icon -> Logo -> PG. Login/large-brand order: Logo -> App Icon -> PG. Favicon order: Favicon -> App Icon -> Logo.
- Internal repo/Firebase/schema/DOM/translation identifiers are intentionally unchanged, including fod_* keys, FOD_WALLET_* error codes, Firebase project identifiers, and the existing penguin-food.web.app Hosting/auth origin.
- Current candidate release identity: React 0.4.280 / 2026.10.08.483; public storefront historical identity remains 0.16.32 / 2026.10.07.172. Candidate bundle is /react/assets/index-BFsKHcE-.js. Production remains Build 2026.10.08.482 until an explicitly authorized coordinated Hosting + Functions + Firestore Rules release. Candidate source is ed16dcc8; Slip2Go/Kitchen regression 12/12, P0 candidate 52/52, Delivery parity 6/6, Rules/Functions dry-runs PASS.
- Primary production Hosting origin remains https://penguin-food.web.app. Legacy https://natchanon-food-order-delivery.web.app remains reachable during transition but is no longer in deploy target foodapp.
- Delivery customer auth remains privilege-isolated from staff auth: Google popup runs only in broker app penguin-google-customer-broker-v1, callable createDeliveryCustomerSession exchanges it for a namespaced cust_... custom-token session in penguin-storefront-customer-v2, and Firestore/Storage rules explicitly exclude customerContext tokens from all staff-role paths. Staff/Owner/Super Admin remain on [DEFAULT]; Delivery logout affects only customer/broker apps.
- Pull, test/build, commit generated assets, and deploy Hosting before Production visual verification.
- If uploaded Logo / App Icon artwork itself contains an old brand, replace that artwork from Platform Branding after deploy.

Documentation rule as of 2026-09-30:
- `docs/WORKLOG.md` is the chronological source for completed fixes and implementation-affecting investigations.
- **Update `docs/WORKLOG.md` after every completed change before moving to the next task.**
- Every entry must include the symptom/request, root cause when known, implementation summary, important files, verification result, commit/push/merge/deploy state, and any remaining follow-up.
- `docs/NEXT_CHAT_HANDOFF.md` remains the current continuation checkpoint; it does not replace the chronological worklog.

## Canonical production URL cutover — 2026-09-30

Production cutover is deployed on the existing URLs without `/react`:
- Customer storefront remains `/s/{slug}/order`, `/delivery`, and `/takeaway`; production checks returned HTTP 200 on all three.
- Migrated staff/admin routes use `/login`, `/cashier`, `/kitchen`, `/waiting-queue`, `/admin`, `/platform`, `/reports/...`, and related original paths.
- `/react/**` is compatibility-only and canonicalizes to the no-`/react` path, including canonical login `next` values.
- `/pos` remains legacy until the paused Retail POS checkpoint is resumed and completed.
- Current Hosting release identity: React `0.4.280` / `2026.09.30.294`; public storefront `0.16.32` / `2026.09.30.009`.
- Latest Hosting redeploy commit: `98e68180` (`chore: prepare canonical hosting redeploy`), pushed to `origin/feature/react-firebase-port`. Earlier canonical cutover commits remain `d8c5eaf4`, `2d94caa4`, `3ece7604`. No merge to `main` was performed.
- Verification: operational + React parity contracts passed, React build passed, full P0 browser smoke passed 52/52 before deploy, and the final route/auth correction gate passed 37/37.
- Firebase Hosting target `foodapp` deployed successfully at `https://natchanon-food-order-delivery.web.app`.
- Deployment scope was Hosting only. Firestore Rules, Storage Rules, and Cloud Functions were not deployed in this cutover.
- Important follow-up: the first Hosting release warned that rewrite function `lalamoveWebhook` had no valid endpoint. Do not deploy all local Functions just to clear this warning; verify/deploy that Function deliberately when the Lalamove webhook scope is resumed.
- See `docs/WORKLOG.md` for the detailed implementation and deployment record.

## Super Admin Console callable repair — 2026-09-29

Root cause found while testing `/react/platform` Slip2Go Test Connection:
- React referenced Platform callable Functions from `functions/platform-settings.js`, but `functions/index.js` did not export that module.
- Production Firebase therefore had only the older Google API pair and did not have Branding, Slip Verification, or Lalamove Platform callables.
- Added all 11 `platform-settings.js` exports to `functions/index.js` and added regression coverage in `tools/react-foundation-contract.mjs` so React Platform callable dependencies cannot silently disappear from the Functions entrypoint again.
- Deployed Functions-only (no Hosting deploy / no Build bump) for the 9 previously missing callables: Branding 2, Slip Verification 3, Lalamove 4.
- Verified production `functions:list` now contains all 11 Platform callables.
- Enhanced `testPlatformSlipVerification` to return safe diagnostic fields: status, HTTP status, Slip2Go result code, and provider message. React `PlatformPage` now shows those details in the Quota/status line on failure instead of discarding them behind the generic toast.
- Rebuilt local React bundle for Hosting Emulator; the diagnostic Function update was deployed Functions-only.
- Audited downstream Super Admin dependencies. `tenant-lalamove-wallet.js` was not exported/deployed, so all 9 tenant Lalamove Settings/Wallet callables were added to `functions/index.js` and deployed Functions-only.
- Repaired source entrypoint exports for Revenue Share, Subscription Admin, and Subscription Pricing modules so production does not depend on stale previously deployed Functions that are absent from current source exports.
- Repaired operational downstream exports for Google Delivery, Walk-in/Table operations, and Lalamove dispatch. The 6 missing production callables (`assignWalkInTable`, `moveTableSession`, and the 4 Lalamove dispatch actions) were deployed Functions-only.
- Deployed the two SaaS Setup callables that were previously local-only: `inspectLegacySaasMigration` and `migrateLegacySaasStore`.
- Added `tools/react-callable-contract.mjs` + `npm run test:react-callables`. It scans React literal callable references and fails when `functions/index.js` lacks an export.
- Final production dependency audit: React references 52 callable Functions and Firebase production contains all 52 required names (`MISSING=0`).
- Aggregate verification passed: `npm run test:react-parity`, `npm run test:operational`, and `git diff --check`.

Slip2Go test path remains `GET /api/account/info` with Bearer secret. Success is code `200001`; connection errors can now distinguish invalid credential/account/package, exhausted quota/credit, rate limiting, timeout/unavailable, and IP whitelist responses.

Slip2Go migration repair completed 2026-09-29:
- Laravel MASTER still had `https://connect.slip2go.com` in `platform_contact_settings.slip2go_api_url`, while Firebase `platformPrivateSettings/slipVerification` had the Secret/provider/receiver data but no API URL.
- Added one-time guarded backfill in `functions/platform-settings.js` for Slip2Go providers with an existing Secret and missing URL.
- Backfill writes only `slip2GoApiUrl` plus a migration marker; it does not modify the existing Secret or receiver data.
- Production log confirmed `SLIP2GO_API_URL_LEGACY_BACKFILL` executed successfully with provider `slip2go_fallback_vision` and URL `https://connect.slip2go.com`.
- `getPlatformSlipVerification` and `testPlatformSlipVerification` were redeployed Functions-only after adding the migration guard.

## Subscription Pricing callable repair — 2026-09-29

- `/react/platform/pricing` could load/calculate pricing but Save returned the generic failure toast.
- The submitted values visible during the failure (590 monthly, 12 months, amount discount 1180, VAT none/0) are valid against both Laravel MASTER and the current Firebase validation rules.
- Production `updateSubscriptionPricing` was still running the older 2026-09-19 deployment revision while the current source/entrypoint had been repaired later.
- Added safe diagnostic logging to `updateSubscriptionPricing` for validation/write failures (no secrets involved).
- Redeployed the complete pricing trio Functions-only from the current source: `getPublicSubscriptionPricing`, `getSubscriptionPricing`, and `updateSubscriptionPricing`.
- Deployment completed successfully. No Hosting deploy / Version-Build bump was performed.

## Super Admin Console status

Canonical URLs already wired to React:

- `/platform`
- `/platform/owners`
- `/platform/contact`
- `/platform/pricing`
- `/admin/tenants`

React aliases under `/react/...` remain available during migration.

Routing notes:
- `react-app/src/main.jsx` supports `/react/...` and canonical paths.
- `vite.react.config.js` copies the React entry to migrated canonical Super Admin entrypoints.

Main Console areas already present:
- Platform Branding
- Google Maps Browser API
- Google Routes API
- Google Cloud Vision API
- Slip Verification configuration
- Lalamove Central configuration
## Google API / Map status

The following Cloud Functions were missing from deployed Firebase and were deployed during this session:

- `getPlatformGoogleApis`
- `updatePlatformGoogleApis`

Firebase project: `chat-45754`
Region: `asia-southeast1`

This was a Functions-only deployment. No Firebase Hosting deployment occurred for that action.

Current map flow:
- Super Admin Console loads and saves Browser / Routes / Vision keys.
- Admin reads Browser key through `getDeliveryGoogleMapsConfig`.
- Google Maps is preferred.
- If Google auth/render fails, Admin falls back to OpenStreetMap/Leaflet.
- User later confirmed Google Maps configuration is working.

Do not remove the fallback unless explicitly requested.
## Super Admin subpages

### /platform/owners
Adjusted:
- canonical React route
- Back-to-platform button on the left
- arrow icon
- modal focus
- Escape closes modal
- password confirmation validity
- saving-state parity

### /platform/contact
Adjusted:
- public contact settings
- Google Customer Login settings UI
- Laravel-like save/load behavior

Follow-up:
- Verify customer-side Google login runtime actually consumes the Super Admin setting.

### /platform/pricing
Adjusted:
- pricing save/reset parity
- pricing is consumed by Register/Public Signup
### /admin/tenants

Added/audited:
- revenue share overview/review
- Lalamove approval/wallet actions
- backend Super Admin authorization
- subscription management for non-revenue-share tenants
- `backfillTenantSubscriptions`
- `updateTenantSubscription`
- localized report period/date display

Follow-up:
- Compare subscription card/action behavior against Laravel MASTER with real Firebase tenant data.
- Continue full tenant-card parity audit.

## SaaS Setup migration status — 2026-09-29

Laravel MASTER route:
- `/super-admin/saas-setup`

Implemented locally in React/Firebase:
- React route/page and canonical Hosting entry for `/super-admin/saas-setup`
- exact MASTER SaaS Setup translations for Thai / English / Myanmar / Lao / Khmer
- source `shops/default-shop`, target tenant, overwrite semantics, progress log, and summary behavior preserved
- legacy source reads/writes moved behind Super Admin-only callable Functions because current Firestore Rules intentionally do not expose `shops/*` to browser clients
- new callables: `inspectLegacySaasMigration` and `migrateLegacySaasStore`
- regression coverage added to `tools/react-foundation-contract.mjs`

Local verification passed:
- `npm run test:react-foundation`
- `npm run test:react-migration`
- `npm run build:react`
- `git diff --check`
- local Hosting Emulator returns the React bundle for both canonical and `/react/super-admin/saas-setup` paths

Deployment status:
- the two new callable Functions are **not deployed yet**
- Firebase Hosting is **not deployed yet**
- do not rely on the production SaaS Setup page until both callable Functions are deployed and the next Hosting release uses a new Build per the mandatory rule below.
## Shared UI parity completed

### Global FOD alignment
The generated FOD text is globally centered in shared React `.brand-mark`.

Source:
- `react-app/public/parity/css/app.css`

Regression test:
- `tools/react-foundation-contract.mjs`

### Collapse/expand chevron alignment
All cards using `AdminCollapsibleCard` center the Bootstrap chevron glyph.

Source:
- `react-app/public/parity/css/admin-workspace.css`

### Sales Report
Adjusted:
- header/back-button layout
- date localization follows selected language
- Laravel-style manual date formatting for Myanmar / Lao / Khmer

Date helper:
- `react-app/src/i18n/I18nProvider.jsx`
## Admin parity completed in this session

- Admin QR action buttons moved toward Laravel MASTER.
- Menu image positioning now uses direct vertical drag instead of the blue range slider.
- Google Map reads central Browser key and has OpenStreetMap fallback.
- Shared FOD alignment is global, not page-specific.
- Shared collapse chevron centering is global, not card-specific.

## Backend files currently important

- `functions/platform-settings.js`
- `functions/google-delivery.js`
- `functions/slip-verification.js`
- `functions/lalamove-dispatch.js`
- `functions/lalamove-webhook.js`
- `functions/tenant-lalamove-wallet.js`
- `functions/tenant-admin.js`
- `functions/saas-migration.js`
- `functions/revenue-share.js`
- `functions/subscription-pricing.js`
- `functions/subscription-pricing-core.js`

Before relying on a new callable, confirm that the named Function is actually deployed.

### Cashier loading deadlock repair — 2026-09-29

Root cause of `/react/cashier` being stuck forever on the simple loading screen:
- The page was blocked at `AuthProvider.status === "loading"`, confirmed via a temporary Cashier debug marker and Chrome headless DOM inspection.
- Port `5002` is Firebase Hosting Emulator, not the Vite dev server. Source changes under `react-app/src` are not visible there until `npm run build:react` rebuilds `public/react/`.
- `AuthProvider` now keeps Firebase `onAuthStateChanged` as the primary path but has an initial-state watchdog. If no initial callback arrives within 6 seconds it continues from `auth.currentUser`.
- User profile lookup `users/{uid}` has a 10-second timeout, so auth can no longer remain in loading forever.
- No stale cached role/profile is trusted as an authorization fallback.
- Cashier no longer blocks on the heavy `loadOperationalSnapshot()` (settings + menus + tables + orders + held bills). It opens from `watchOperationalOrders()` like MASTER/legacy behavior and has an 8-second page-data watchdog.
- Verified against the user's normal Chrome profile: `/react/cashier` rendered the real Cashier page with the current bill after the repair.
- Temporary AUTH/TENANT/STYLES/CASHIER_DATA debug marker was removed before final build.
- Cashier action-button icon spacing root cause was fixed: React order-card icons were missing Laravel MASTER's `app-icon` class, while the old spacing rule depended on `body[data-roles="cashier"]` which the Cashier page does not set. All Cashier button icons now use `app-icon`, and shared React `icons.css` gives any text button with direct `.app-icon + span` the standard 7px icon/text gap. This prevents the recurring icon-touching-label problem across React buttons without relying on page role attributes.

### Waiting Queue post-save / translation repair — 2026-09-29

React `/react/cashier/waiting-queue` fixes:
- Waiting Queue translator now prefers `waiting-queue-master-translations.json` and falls back to the older generated translation file only when needed.
- Raw keys such as `common.minute_range`, `common.remaining_minutes`, and `actions.seat` must never appear in the UI.
- The seat action now uses `seat.open` (Laravel label: เปิดโต๊ะ).
- Staff cancel-queue prompt now differentiates dismiss vs destructive confirm clearly: the left dismiss action remains `ยกเลิก` with X, while the confirm action is `ยกเลิกคิว` with a check-circle icon. React `sweetDialog` now supports explicit `confirmIcon` / `cancelIcon` overrides so labels containing “ยกเลิก” do not force both actions to the same X icon. Regression coverage is in `tools/react-foundation-contract.mjs`.
- After saving a queue, the Add Queue dialog is closed from the browser top layer first, then the Ticket dialog is opened on the next animation frame.
- Ticket `showModal()` is guarded so a dialog DOMException cannot tear down the React view.
- The Add Queue form also prevents native browser navigation at submit-capture level.
- React QR output is a data-URL `<img>`; waiting queue CSS explicitly keeps that image visible even though Laravel MASTER normally renders a QR `<canvas>`.

### React global form validation parity — 2026-09-28

React now mounts `FormValidationUi` once at the app root, porting Laravel MASTER `form-validation-ui.js` behavior across React forms:
- browser native validation bubbles are disabled with `form.noValidate = true`
- HTML constraints (`required`, `type`, `min/max`, `minLength/maxLength`, `pattern`) remain the validation engine
- errors/success are rendered with Laravel-style `data-validation-state` and `.bootstrap-invalid-feedback`
- messages come from `shared.validation.*` and follow the active locale
- `#registerForm` remains excluded because Laravel MASTER also gives registration its own validation flow
- dynamic React forms are picked up through `MutationObserver`

Waiting Queue dialogs were also corrected to use native `dialog.showModal()` / `close()` via refs instead of React `open={...}`, so Add Queue / Ticket / Seat dialogs enter the browser top layer and get the proper modal backdrop.

### Quick Order operational deployment update — 2026-09-28

Deployed to Firebase project `chat-45754` in `asia-southeast1`:
- `createWalkInOrder`
- `releaseQuickOrderHeldBill`

These are required by React `/react/cashier/quick-order` for:
- receiving payment + creating/sending a Walk-in order to the kitchen flow
- resuming/deleting held Quick Order bills

This was a Functions-only deployment. No Hosting deploy occurred, so Version/Build was not bumped.
## Mandatory Firebase Hosting Version / Build rule

**Every Firebase Hosting deployment must use a new Build.**

Minimum:
- Build changes every Hosting deploy.
- Version should bump for a user-visible release/milestone.
- Never reuse the exact same Version + Build pair.

Current React footer identity prepared for the next Hosting deployment:
- Version: `0.4.280`
- Build: `2026.09.30.294`

Current public storefront `public/assets/js/app-info.js` identity prepared for the next Hosting deployment:
- Version: `0.16.32`
- Build: `2026.09.30.009`

Before the next Hosting deploy, decide the next release identity and synchronize active release surfaces.
Review/update at minimum before Hosting deploy:
- `react-app/src/components/ParityFooter.jsx`
- `public/assets/js/app-info.js`
- current release note in `README.md`
- this handoff if it remains the active state document

Then run:

```bash
npm run test:react-foundation
npm run test:react-migration
npm run build:react
git diff --check
```

Use `npm run test:operational` when operational/POS/order logic changes.

Hosting command:

```bash
npx firebase-tools deploy --only hosting --project chat-45754
```

Do not add Hosting to a Functions deployment unless Hosting assets are intentionally being released.
## Parity verification system — 2026-09-29

A complete verification framework is now defined so the user is not expected to manually click every menu/button:
- plan: `docs/PARITY_VERIFICATION_PLAN.md`
- route/action matrix: `react-app/migration/parity-verification-matrix.json`
- matrix validator: `tools/react-parity-matrix.mjs`
- commands: `npm run test:react-parity-matrix` and aggregate `npm run test:react-parity`

Definition of Done is stricter than "page renders": route/access, visual parity, complete action inventory, navigation/dialog/toast behavior, Firebase/Function side effects, failure paths, languages, and responsive behavior must all pass before a route can be marked `verified`.

Current truth:
- the matrix covers all 53 registry routes structurally
- P0 static action inventory is generated for all 20 P0 routes and follows Laravel MASTER script-generated buttons as well as static markup
- Playwright is installed and `npm run test:react-p0-browser` currently passes 50 browser tests using the Mac's installed Google Chrome
- the browser suite covers all P0 route smoke checks, anonymous auth boundaries, public Waiting Queue failure/responsive states, Login validation/password/language interactions, and Waiting Queue Display safe controls
- `npm run test:react-p0-actions` passes source/service side-effect contracts for Cashier, Waiting Queue, Admin Tenants, and SaaS Setup
- authenticated write/destructive E2E is still pending because Firestore Emulator requires Java and this Mac currently has no Java/OpenJDK runtime
- never substitute uncontrolled production writes for the missing isolated Firestore Emulator coverage
- canonical P0 audit currently shows a mixture of React and legacy entries; the matrix validator now forbids marking a route `verified` unless its canonical entry is React

Do not claim that every button has been tested until P0/P1/P2 action inventories and browser/data coverage are completed per the plan.

## Revenue-share suspension access flow — 2026-09-29

Laravel MASTER behavior was audited and React/Firebase was corrected to match it:
- Laravel `AuthorizeLegacyWebPage` redirects any non-super-admin tenant user with `revenueShareSuspended=true` away from protected tenant pages to `/reports/revenue-share`.
- Laravel API middleware blocks non-revenue-share APIs with HTTP 423 `TENANT_REVENUE_SHARE_SUSPENDED`, while revenue-share APIs remain available so the store can submit payment evidence.
- Laravel `TenantAccess::allows()` intentionally keeps Owner/Admin sessions valid during revenue-share suspension; other tenant roles remain blocked.
- React previously treated every revenue-share suspension as `TENANT_INACTIVE` in both login and `TenantProvider`, causing the indefinite loading/redirect problem. Owner/Admin now retain tenant context while suspended; cashier/kitchen/other roles remain blocked.
- Added React `RevenueShareSuspensionGuard`: protected tenant routes redirect suspended Owner/Admin to `/reports/revenue-share` before those pages mount/load deeper data. Public Waiting Queue customer/display routes are excluded.
- Added suspension detail fields to Firebase `getTenantRevenueShareAccess` and Laravel `/api/tenant/revenue-share/access`: reason, suspended time, period type/start/end. Firebase callable was redeployed Functions-only.
- Added a clear suspension warning banner to Laravel MASTER and React Revenue Share pages. It distinguishes `missing_payment`, `rejected_payment`, and generic suspension and explains that the store is restored automatically after payment approval.
- Added suspension translations for Thai, English, Myanmar, Lao, and Khmer.
- Found and fixed a second loading cause: React requested `revenue-share-report.css` but the file was absent from parity assets. The CSS is now copied from Laravel MASTER and included permanently in `tools/sync-react-parity-assets.py`.
- Translation parity sync was hardened to include every PHP language file across the five supported locales (53 groups currently), preventing generated parity translations from silently dropping groups such as `cashier_documents`.
- Storage rules were verified: Owner/Admin can still create/read revenue-share slip files while the tenant is revenue-share suspended; tenant active status is not required for that path.
- Verification passed: Laravel PHP/JS syntax, `npm run test:react-foundation`, `npm run test:react-callables`, `npm run build:react`, and `git diff --check` for both repositories.

## Subscription expiry / suspension login enforcement — 2026-09-29

Laravel MASTER and React/Firebase now distinguish subscription expiry from other tenant suspension states instead of collapsing everything into `TENANT_INACTIVE`.

- Laravel `TenantAccess::subscriptionStatus()` already computes effective status on every request from `subscriptionExpiresAt + gracePeriodDays`; React previously checked only stored `subscriptionStatus` / `active`, which allowed an expired-but-not-yet-synced tenant to keep using the dashboard.
- Added React `react-app/src/auth/tenantAccess.js` with the same effective-status semantics: active, grace, expired, suspended, revenue-share active/suspended.
- `authFlow.js` now blocks new login with specific `TENANT_SUBSCRIPTION_EXPIRED` or `TENANT_SUSPENDED` errors.
- `TenantProvider` now uses a Firestore `onSnapshot` listener plus a 30-second time-based access recheck. This handles both Super Admin status changes and subscriptions crossing the expiry/grace boundary without requiring a page reload or waiting for the scheduled sync job.
- Existing signed-in expired/suspended tenants are signed out and hard-redirected to `/react/login?reason=subscription_expired` or `/react/login?reason=tenant_suspended`. A previous React Router/signOut race that could land on public `/react` instead of Login was fixed by sequencing sign-out then `window.location.replace()`.
- Login page shows the specific reason immediately before any new credential submission. Added Thai, English, Myanmar, Lao, and Khmer strings for expired package and suspended store.
- Laravel MASTER now returns specific API errors `TENANT_SUBSCRIPTION_EXPIRED` / `TENANT_SUSPENDED`, web middleware redirects expired/suspended sessions to Login with the matching `reason`, and the legacy login UI maps those codes/reasons to the same messages.
- Revenue-share suspension remains a separate exception: Owner/Admin retain tenant context and are redirected to `/reports/revenue-share`; other roles remain blocked.
- Added `npm run test:tenant-access` behavioral contract covering active, grace, expired, suspended, inactive, and revenue-share suspension cases. P0 browser coverage also verifies the expired redirect message on Login.
- Verification passed: React tenant-access contract, foundation contract, callable contract, React build, Playwright expired-login UI test, Laravel `LegacyAuthContractTest`, Laravel `WebPageAuthorizationContractTest`, and `git diff --check`.

## Mandatory UI layer policy — 2026-09-29

A global stacking policy is now mandatory across Laravel MASTER and React/Firebase. Full policy: `docs/UI_LAYER_POLICY.md`.

Required order, highest to lowest:
1. **Toast Alert** — must always remain visible and must never be covered.
2. **SweetAlert / shared confirmation dialog**.
3. **Modal / native `<dialog>` / drawer-style modal**.
4. Normal page UI and loading overlays.

Implementation details:
- Canonical layer tokens are in Laravel MASTER `public/assets/css/ui-layer-stack.css`; React receives the parity copy through `tools/sync-react-parity-assets.py`.
- `toast-top-layer.js` is now a full Top Layer manager, not just a z-index helper. Native `showModal()` participates in the browser Top Layer and can beat any normal z-index. Chromium can also keep a native modal above a body-level popover, so the manager mounts overlays inside the topmost native modal host when one exists, then promotes active Sweet Dialog first and visible Toast last.
- Global order is therefore enforced as **Toast > Sweet Dialog > Modal**, including when a native modal opens after an existing Toast/Sweet Dialog.
- Do not solve new page issues by inventing a larger hard-coded z-index. New Toast/Dialog/Modal components must use the shared selectors/data-layer hooks and central tokens.
- Added `npm run test:ui-layers` plus a Playwright browser test that opens a native modal, Sweet Dialog, and Toast together and verifies actual visual/top-layer order.

## Revenue-share save failure / Cloud Function mismatch — 2026-09-29

The `/react/admin/tenants` revenue-share modal showed `บันทึกส่วนแบ่งไม่สำเร็จ` even though the submitted rate/cycle were valid.

Root cause:
- Local React and Laravel MASTER intentionally do **not** ask for or submit `recipientName` in this modal.
- The deployed `updateTenantRevenueShare` Cloud Function was stale. Its deployed source still rejected enabled revenue-share settings unless `recipientName.length >= 2`.
- Cloud log at approximately 09:05 ICT confirmed the callable request reached `updateTenantRevenueShare` with valid Firebase Auth.
- The stale deployed function hash was `fc70e695d7b8aacd0d582d380ac9baf21851a9fe`.

Resolution:
- Kept React aligned 1:1 with Laravel MASTER; did not add a legacy recipient-name field.
- Deployed **only** `functions:updateTenantRevenueShare` from the current local source. Firebase Hosting was not deployed and Version/Build were not changed.
- New deployed function hash: `25cfe5941b9061c2d97d94986a9adc197ae4ef5b`, state ACTIVE.
- Function syntax, React foundation contract, UI layer contract, React build, and `git diff --check` passed after the fix.
- No commit / push / merge performed.

## Admin Tenants initial loading flow — 2026-09-29

The `/react/admin/tenants` page previously showed two consecutive loading states: the full-page PageReadyOverlay first, then the page rendered while the tenant list still showed `กำลังโหลดรายการร้านค้า...`.

Root cause:
- The full-page loader waited only for Auth + parity styles, not the initial tenant list.
- Worse, React serialized the critical `listTenants()` call behind `backfillTenantSubscriptions()`, so the tenant list did not even start loading until maintenance/backfill work finished.
- Laravel MASTER does not do this; its initial flow starts tenant list and sales loading immediately/in parallel.

Resolution:
- Added `initialTenantsReady` as a critical page-readiness condition for Super Admin.
- `listTenants()` now starts immediately as soon as the Super Admin profile is ready.
- The full-page loader remains visible until the first tenant list request completes, so the initial page reveal should already contain the tenant list (or a load error) instead of a second tenant-list loading phase.
- Subscription backfill now runs in the background and no longer blocks initial rendering.
- If backfill actually updates tenant records, the tenant list is refreshed silently without showing the section loading placeholder again.
- Added regression assertions to the React foundation contract to preserve this ordering.
- Verification passed: React foundation contract, React build, and `git diff --check` in both repositories.

## Home dashboard icon palette stability — 2026-09-29

The staff home icon palette regressed to green after parity sync because `home-dashboard.css` bound card identity to Laravel-only href selectors such as `/kitchen`, `/cashier`, `/admin`, and `/waiting-queue/`, while React routes use `/react/...`.

Resolution:
- Dashboard visual identity is now route-independent and uses semantic `data-dashboard-card` keys in both Laravel MASTER and React.
- Keys currently include `kitchen`, `cashier`, `waiting_queue`, `admin`, `admin_users`, `revenue_share`, `pos`, and `pos_catalog`.
- Canonical color selectors live in Laravel MASTER `public/assets/css/home-dashboard.css` and are synced to React.
- Required palettes: Kitchen orange, Cashier blue, Waiting Queue green, Admin teal, Staff Admin purple. POS/revenue-share keep their defined green/teal palettes.
- React foundation contract now asserts semantic keys/selectors and explicitly rejects returning to `.nav-card[href="/kitchen"]` route-coupled styling.
- Browser computed-style verification confirmed all five primary icon foreground/background colors are distinct and correct.
- React foundation test, React build, and `git diff --check` passed in both repositories.

## Button icon spacing + User Menu palette stability — 2026-09-29

Two UI regressions were fixed after parity sync:
- Quick Order held-bill action buttons (`เปิดบิลต่อ`, `ลบ`) had icons touching their labels because the shared spacing selector only matched `.app-icon + span`, while these buttons use a plain Bootstrap `<i>` followed by `<span>`.
- React User Profile menu icon colors regressed to the default green because `icons.css` still keyed palettes from Laravel-only hrefs such as `/cashier/table-qr`, `/admin`, and `/admin/users`, while React uses `/react/...` routes.

Resolution:
- Shared button spacing now covers direct `.app-icon + span`, `i + span`, and `svg + span` patterns with a 7px gap. Quick Order held-bill actions also carry an explicit local 7px gap safeguard.
- User Menu visual identity is route-independent and uses `data-user-menu-key` in both Laravel MASTER (`local-auth-service.js`) and React (`UserMenu.jsx`).
- Semantic keys include `home`, `platform`, `tenants`, `waiting_queue`, `table_qr`, `admin`, and `admin_users`; password and logout continue using semantic action/state selectors.
- Canonical user-menu palettes remain: Home/Platform green, Waiting Queue green, Open Table blue, Store Admin cyan/teal, Staff Admin purple, Change Password amber, Logout red.
- React foundation contract now rejects Laravel-only href color selectors and verifies semantic menu keys plus generic icon/text button spacing.
- Chrome computed-style verification confirmed held-bill button gap = 7px and distinct User Menu foreground/background colors.
- React foundation test, React build, Laravel JS syntax, and `git diff --check` passed.

## Owner password dialog shared styling — 2026-09-29

React UserMenu password-change dialog rendered as an unstyled raw form because the dialog CSS only existed inside Laravel `local-auth-service.js` via runtime `ensurePasswordStyles()` injection; React reused the markup but had no equivalent injected style.

Resolution:
- Moved canonical Owner Password Dialog styling into Laravel MASTER `public/assets/css/icons.css`, which is synced to React parity assets.
- Removed the duplicated runtime CSS injection from Laravel `local-auth-service.js`; the function now relies on shared CSS.
- Added `data-ui-layer="modal"` to both Laravel and React password-dialog backdrops and registered `.owner-password-backdrop` in `ui-layer-stack.css`.
- Layer order remains: Toast `2147483647` > Sweet Dialog `2147483600` > Password/other Modal `2147483000`.
- Chrome computed-style verification: backdrop fixed/full viewport, centered grid, modal z-index `2147483000`, dialog ~497px desktop width with 26px radius.
- Hosting Emulator serves the new password-dialog CSS from `/react/parity/css/icons.css`.
- UI layer contract, React foundation contract, React build, Laravel JS syntax, and `git diff --check` all passed.

## Owner password dialog viewport centering — 2026-09-29

After the shared password-dialog CSS was restored, React still rendered the modal clipped toward the top instead of centered in the viewport.

Root cause:
- React rendered `OwnerPasswordDialog` as a descendant of `UserMenu` inside `.app-header`.
- `.app-header` uses `backdrop-filter: blur(10px)`, which creates a containing block for fixed descendants in Chromium/WebKit.
- Therefore `.owner-password-backdrop { position: fixed; inset: 0; place-items: center; }` was centered relative to the header containing block instead of the browser viewport.
- Laravel MASTER did not have this problem because `local-auth-service.js` appends the password backdrop directly to `document.body`.

Resolution:
- React `OwnerPasswordDialog` now uses `createPortal(..., document.body)` from `react-dom`, matching Laravel MASTER behavior.
- The modal remains tagged `data-ui-layer="modal"`, so global stacking remains Toast > Sweet Dialog > Modal.
- Added React foundation regression assertions requiring the password dialog to portal to `document.body`; do not replace this with top/margin offsets.
- Verification passed: React foundation contract, UI layer contract, React build, and `git diff --check` in both repositories.

## Cashier Table QR desktop 4-column layout — 2026-09-29

The `/react/cashier/table-qr` desktop page was too narrow because it inherited the shared `.container` max-width of 1120px and `.grid-3` three-column layout.

Resolution:
- Added a page-scoped Desktop rule in Laravel MASTER `order-delivery-workspace-theme.css` for `body.od-qr-page` only.
- At viewport widths >= 1200px, the Table QR container expands to `min(1440px, calc(100% - 48px))`.
- `#availableTables`, `#occupiedTables`, and `#walkInTables` render 4 equal columns on Desktop.
- Tablet/Mobile continue to use the existing shared responsive grid behavior; other `.grid-3` pages are unaffected.
- Synced the canonical CSS to React parity assets.
- Chrome computed-style verification at 1600px viewport: container 1440px and 4 columns of ~342.5px each.
- React foundation contract now locks the page-scoped 1440px/4-column rule.
- React foundation test, React build, and `git diff --check` passed in both repositories.

## Admin Users initial loading + header placement — 2026-09-29

Two regressions on `/react/admin/users` were fixed:
- Initial render showed two loading phases because the full-page PageReadyOverlay did not wait for `listStaffUsers()`; after the overlay disappeared the staff table still showed `กำลังโหลด...`.
- The back button had been incorrectly moved into the right action group. Required layout is left: brand + back button; right: locale + User Profile.

Resolution:
- Added `initialUsersReady`; the full-page loader now remains until the first staff-list request completes (success or handled error), so the initial page reveal no longer exposes a second table-loading phase.
- Header now uses `.admin-users-header-leading` for `brand + ← กลับหน้าจัดการร้าน` on the left.
- `.admin-users-header-actions` contains only LocaleSwitcher + UserMenu on the right, with the standard 8px gap.
- Laravel MASTER uses the same leading/actions structure; local-auth service moves locale/UserMenu into the existing right action container.
- Added React foundation regression assertions for initial staff readiness and left/right header structure.
- Chrome layout verification at 1600px: leading starts at x=16, back button x≈185; right actions x=1360..1584, locale immediately before User Menu.
- React foundation test, React build, and `git diff --check` passed in both repositories.

## Admin menu sorting mobile touch parity — 2026-09-29

On `/react/admin`, category/menu ordering showed drag handles on Mobile but could not actually be dragged by touch.

Root cause:
- React used native HTML5 `draggable` + `dragstart/drop`, which works with desktop mouse drag but is not reliable/available for touch dragging on mobile browsers.
- Laravel MASTER already uses SortableJS 1.15.6 with explicit coarse-pointer/touch fallback options.

Resolution:
- React Admin now imports and uses `sortablejs` for both `#categorySortList` and `#itemSortList`, matching Laravel MASTER behavior.
- Dragging is handle-only via `.sort-handle` and preserves the MASTER touch options: 180ms touch delay, `delayOnTouchOnly`, coarse-pointer threshold 8, `forceFallback`, `fallbackOnBody`, and fallback tolerance 5.
- Removed the old category/menu HTML5-only `draggable/onDragStart/onDrop` implementation.
- Added stable `data-sort-category` / `data-sort-menu-id` keys and React refs; Sortable `onEnd` updates React order state.
- Added React foundation regression assertions preventing fallback to HTML5-only drag/drop.
- Real Chrome touch emulation at 440x956 passed: touch-drag changed order from `A,B,C` to `B,C,A` and fired Sortable `onEnd`.
- React build, React foundation contract, and `git diff --check` passed.

## Admin category drag smoothness parity — 2026-09-29

After enabling SortableJS touch dragging on `/react/admin`, category dragging still felt less smooth than menu/product dragging.

Root cause:
- React rendered each category sort row itself as a `<button>` with `onClick` while also using that same row as the Sortable draggable item.
- On touch devices the category row therefore participated in both tap/click selection and drag gesture handling, unlike menu/product rows.
- Laravel MASTER already avoids this conflict: the draggable category row is a `<div class="sort-item">`, the handle owns drag, and a separate inner button owns category selection.

Resolution:
- React category rows now match Laravel MASTER structure: draggable outer `div.sort-item`, separate `.sort-handle`, and a nested transparent selection button.
- Selected category styling now uses the MASTER `active-category` class.
- SortableJS remains handle-only, so dragging the handle no longer triggers category selection/click behavior.
- React foundation contract now prevents category sorting from regressing to a clickable draggable-row implementation.
- Real Chrome touch emulation at 440x956 passed: drag reordered `A,B,C` to `B,C,A`, `onEnd` fired, and no category click was emitted during the drag (`selected` remained null).
- React foundation contract, React build, and `git diff --check` passed in both repositories.

## Admin category drag visual latency — 2026-09-29

User clarified the category-sort issue was visual latency: the dragged graphic followed the finger more slowly than the product/food sorter.

Root cause / comparison:
- The product/food sorter uses a lower-latency Sortable profile: animation 120ms, touch delay 80ms, threshold 4px, scroll sensitivity 60/speed 14.
- Admin category sorting had been using animation 180ms, touch delay 180ms, threshold 8px and forced fallback on touch, which made the dragged visual feel delayed.
- Admin parity CSS also lacked the product sorter's `.sort-fallback` visual treatment, and the combined `admin-retail-pos-parity.css` still carried the older drag styling.

Resolution:
- Laravel MASTER `admin-sort.js` and React Admin now use animation 120ms, touch delay 80ms, threshold 4px, handle-only drag, scroll sensitivity 60/speed 14.
- Mobile still uses fallback drag for reliability, but the fallback clone now has `transition:none`, `will-change:transform`, stronger drag shadow/background and explicit z-index.
- Updated both canonical `admin-sort.css` and the later-loaded `admin-retail-pos-parity.css` duplicate so the old drag style cannot override the low-latency visual.
- React foundation contract now locks the low-latency Sortable profile.
- Real Chrome touch emulation verified the fallback clone tracks the touch position with approximately 0px delta after activation, and reordered `A,B,C` to `B,C,A` successfully.
- React foundation contract, React build, Laravel admin-sort JS syntax, and `git diff --check` passed.

## Retail POS pause checkpoint — 2026-09-30

Decision:
- **Pause Retail POS work here.**
- Active development now returns to **Order / Delivery / Takeaway** and those three flows should be completed before returning to POS.
- Do not throw away or restart the POS migration when work resumes; continue from this checkpoint and the current uncommitted source.

Repository safety at this checkpoint:
- Active branch remains `feature/react-firebase-port`.
- HEAD remains `013fd5ad feat: centralize subscription pricing and header layout`.
- POS work described below is still part of the large uncommitted/untracked React migration.
- No commit / push / merge / Hosting deploy was requested for this POS checkpoint.
- Do not reset / clean / discard any of this work.

### POS sale / receipt / printing checkpoint

Completed or materially implemented:
- `/react/pos` remains the React/Firebase retail sale screen using Laravel MASTER as the 1:1 UI/behavior reference.
- Receipt popup is implemented at `/react/pos/receipt`.
- Receipt page uses the Laravel MASTER receipt CSS through parity assets.
- Manual and Auto Print flows wait for fonts/content before calling `window.print()`.
- Paper selection supports the current 58mm / 80mm / A4 flow.
- A React-specific print bug was found and fixed: Laravel MASTER print CSS hides `body > :not(.page)`, while React wraps the page in `#root`; React now explicitly preserves `#root` during print.
- Native Chrome Print Preview was verified after that repair and the receipt is visible instead of printing a blank page.
- Full-tax-invoice action/dialog is present in the Receipt flow, including the DBD/tax-buyer lookup path.
- Firestore tax-invoice support and running-number work was added locally.
- A4 tax-invoice print route exists at `/react/pos/tax-invoice`.
- Tax Invoice A4 pagination is set to 20 items per page.
- Receipt and tax-invoice CSS remain tied to Laravel MASTER parity sync.
- The legacy post-payment `paymentCompleteDialog` was removed from React after checking current Laravel MASTER runtime: current MASTER closes the payment dialog, resets the sale, shows success feedback, and only opens Receipt automatically when Auto Print is enabled. The old `retail-pos-complete.js` file exists in MASTER but is not part of the current `/pos` runtime.
- Receipt print safe padding was discussed but intentionally **not changed** because Laravel MASTER currently prints with zero page margin/padding; preserve parity until a coordinated MASTER + React change is requested.

### POS navigation checkpoint

`PosNavigation` was updated locally so the main POS menu no longer intentionally sends migrated items back to legacy pages.

React routes now exist for the sales-side group:
- `/react/pos`
- `/react/pos/sales`
- `/react/pos/tax-invoices`
- `/react/pos/returns`
- `/react/pos/shifts`

React routes now also exist locally for:
- `/react/pos/products`
- `/react/pos/stock-movements`
- `/react/pos/stock-counts`
- `/react/pos/purchases`
- `/react/pos/payables`
- `/react/pos/suppliers`
- `/react/pos/customers`
- `/react/pos/settings`
- `/react/pos/backup`
- `/react/pos/users`

Navigation label behavior was also repaired:
- React previously displayed raw translation keys such as `pos_users.permission_items.pos_sales`.
- Laravel MASTER has label fallback behavior.
- React now has a fallback label path so missing permission translations display the intended Thai label instead of the raw key.

### POS supporting-page local implementation status

The following work exists locally and must be preserved, but should be treated as **migration work pending final 1:1 review**, not as production-complete simply because the route renders:

Sales / tax / return / shift:
- Sales history reads Firebase sales data and includes the Receipt reprint path.
- Tax-invoice listing reads `taxInvoices` and opens the A4 print route.
- Return flow has local Firestore transaction work for return/VOID, stock restoration, stock movements, and RF/VD running numbers.
- Shift flow has local open/close shift data work and SH running numbers.

Stock:
- Stock movement page reads the existing `stockMovements` data.
- Stock-count flow was added locally using the same product stock transaction model rather than a separate stock implementation.
- Stock Count writes `stockCounts`, adjusts product stock, and creates movement type `count`.

Purchasing:
- Local Firebase purchasing data layer was added for `suppliers` and `purchases`.
- Receive-stock work updates stock, average cost, and stock movement in one transaction.
- Payables use purchase balance/payment history.
- Supplier CRUD is present locally.

Customer / settings / system:
- Customer CRUD was added on the same `customers` collection used by POS/customer loyalty.
- POS Settings reads/writes tenant `settings/store`, `tax`, `payment`, `receipt`, and `loyalty`.
- POS Settings reuses the existing React `AdminMap` component so Google Maps Browser key → Leaflet fallback behavior does not split into another map implementation.
- POS role settings are stored in `settings/pos-roles` and `PosNavigation` now loads the shared Firebase role settings rather than depending only on localStorage.
- Local staff-role source was extended to support `manager` and `stock` roles in addition to the existing POS staff roles.
- Local callable source `functions/retail-pos-backup.js` was added for tenant-scoped owner-only POS backup/restore.

### Critical deployment state when POS is resumed

**Do not assume the new POS write paths are deployed.**

At the pause point:
- Firestore Rules changes for the newer POS collections/operations are local source changes and have not been deliberately deployed as part of this POS work.
- New/changed callable Functions for POS Backup/Restore and expanded staff roles are local source changes and have not been deliberately deployed as part of this POS work.
- No Firebase Hosting deploy was performed for this POS checkpoint.
- Therefore no Hosting Version/Build bump was performed for this checkpoint.
- Local testing was being done through the Firebase **Hosting emulator only**. This is important: Hosting emulator rendering does not prove undeployed production Firestore Rules or Cloud Functions write paths.
- Read/render checks can pass while a production write still fails until the matching Rules/Functions are deployed.

When deployment is eventually requested:
1. Review exactly which Rules/Functions changed and deploy only the required backend pieces first when appropriate.
2. Test real write paths for Return/VOID, Shift open/close, Stock Count, Purchasing/Payables/Suppliers, Customers/Settings, role permissions, and Backup/Restore.
3. For any Hosting deploy, obey the mandatory rule: change Build first, review Version, run tests/build, and never reuse the same Version+Build pair.

### POS runtime verification state

Last broad checks before pausing:
- `npm run test:react-foundation` passed after the POS additions.
- `npm run test:operational` passed.
- `npm run build:react` passed; the build included 131 modules in the last full run.
- `git diff --check` passed.
- The React POS supporting routes were opened in real Chrome from the local Hosting emulator.
- The first batch of screenshots made some newer pages look blank because captures were taken before asynchronous Firebase data finished loading.
- `/react/pos/settings` was rechecked with a longer wait and rendered correctly with real store/tax data.

Known POS follow-up before calling the module complete:
- Replace blank initial waits on the newer supporting pages with the standard full-page readiness/loading treatment instead of returning visually empty while Firebase is loading.
- Re-run visual parity comparison page-by-page against Laravel MASTER; the newer supporting pages are not yet declared visually final.
- Re-run PC / Tablet / Mobile checks.
- Verify permissions for owner/admin/manager/cashier/stock/kitchen roles.
- Verify all write flows after the required backend Rules/Functions are deployed.
- Re-test sales-history → reprint, tax-invoice issue/print, return/VOID stock effects, shift totals, stock count, purchasing/average cost/payables, customer/loyalty, settings/map, backup/restore, and users/roles end-to-end.
- Keep the existing Receipt/Print fixes intact while doing that work.

## Recommended next development order

The active priority was intentionally changed on 2026-09-30:

1. Return to the customer-facing **Order** flow and finish `/order` React/Firebase parity against Laravel MASTER.
2. Finish **Delivery** end-to-end, including shared catalog/cart/customer/address/payment/map/delivery dependencies that the Laravel MASTER flow requires.
3. Finish **Takeaway** end-to-end with the same 1:1 parity rule.
4. Reconcile the shared Order / Delivery / Takeaway components so common fixes are not duplicated or allowed to drift between the three channels.
5. Verify the three flows on Desktop / Tablet / Mobile and test the real button/action path from selecting products through order submission and post-submit state.
6. Run React foundation/operational/parity checks and `git diff --check` before considering those three flows complete.
7. Only after Order / Delivery / Takeaway are complete, return to **Retail POS** and resume from the POS pause checkpoint above.
8. Do not commit / push / merge / deploy until explicitly requested.

## New-chat instruction template

Use Desktop Commander and continue at:
`/Users/natchanonsripleng/Desktop/Sites/food-order-app`

Read `README.md` → `STRUCTURE.md` → `docs/NEXT_CHAT_HANDOFF.md` → `docs/WORKLOG.md` → `docs/SAAS_MIGRATION.md`, then inspect Git branch/HEAD/status.
Preserve all uncommitted work. Do not commit/push/merge until explicitly requested.
Update `docs/WORKLOG.md` after every completed change before starting the next task.
Use Laravel MASTER at `/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80` branch `main` as the 1:1 UI/behavior reference.
Current active focus after the 2026-09-30 POS checkpoint is to finish Order / Delivery / Takeaway first; resume POS only afterward from the documented checkpoint.
Before every Firebase Hosting deploy, change Build, review Version, build/test, and never deploy the same Version+Build pair twice.

### React blank-page / stale entry bundle repair — 2026-09-29

Root cause confirmed with Chrome DevTools Protocol on /react/cashier/waiting-queue:
- The blank page was not a WaitingQueuePage render crash.
- Chrome failed the React entry module because a previously-open tab referenced an old hashed /react/assets/index-*.js that had been removed by Vite emptyOutDir: true.
- Firebase Hosting rewrite for the missing JS returned /react/index.html as text/html, causing Chrome's strict module MIME error and leaving only the blank/fallback page.
- Vite now uses emptyOutDir: false so previous hashed entry bundles survive subsequent local builds.
- Firebase Hosting now sends Cache-Control: no-cache, no-store, must-revalidate for /react and /react/**.
- react-app/index.html has a one-time entry-module recovery reload for stale/missing /react/assets/* module scripts; main.jsx clears the recovery marker after the entry module executes.
- Auth bootstrap now uses Firebase auth.authStateReady() and no longer treats a temporary currentUser === null timeout as a real logout; unresolved auth becomes an error after 15 seconds instead of redirecting incorrectly.
- Final verification after cleanup: current Waiting Queue build rendered .waiting-page with the real queue/table data, title จัดการคิวรอโต๊ะ, and no React exception/MIME entry failure.
- Temporary WaitingQueueDebugBoundary was removed before final build.

### Waiting Queue post-save white-screen root cause — 2026-09-29

Exact post-save crash confirmed:
- After createWaitingQueue() succeeded, submitAdd() called setTicket(row).
- The ticket QR effect then called qrDataUrl(url, 220).then(setTicketQr).
- react-app/src/utils/localQr.js qrDataUrl() is synchronous and returns a data:image/svg+xml string, not a Promise.
- Calling .then() on that string threw during the React effect immediately after the add dialog closed, producing the user-observed white screen.
- Fixed WaitingQueuePage to call setTicketQr(qrDataUrl(url, { size: 220, margin: 4 })) inside try/catch.
- Repository search confirmed this was the only incorrect Promise-style qrDataUrl usage; Cashier, Quick Order, Receipt, Admin QR, and Table QR already use the synchronous API correctly.
- Added a react-foundation regression assertion forbidding qrDataUrl(url, 220).then in WaitingQueuePage.
- Full post-save flow verified in an isolated offline Chrome profile so no Firebase test queue was created: add dialog opened, save completed locally, add dialog closed, ticket dialog opened, queue W004 was shown in the test profile, QR src began with data:image/svg+xml, and .waiting-page remained mounted with no runtime exception.


## 2026-10-08 — Master business editor + signup card
- Master business selector in Super Admin tenant Edit; signup snapshot and revenue-share settings remain separate.
- Candidate Build 2026.10.08.474; see WORKLOG for release details.


### Production checkpoint — Build 2026.10.08.474
- Tenant Master business editor + signup card refresh committed 647e7bf2 and deployed to Hosting and updateTenant Function.
- Production HTML and CSS verified via HTTP. Authenticated editing interaction is not yet independently browser-verified.
- Untracked old candidate bundle: public/react/assets/index-Dplusb-p.js; do not randomly delete.

\n## 2026-10-08 — Revenue-share scope correction
Build candidate 2026.10.08.475: business type is Master-derived read-only in Revenue Share dialog; dual-business delivery-only excludes Retail POS, storefront/all includes POS. See WORKLOG.


### Production verification — Build 2026.10.08.475
- Revenue share Master-derived read-only business field + dual-business channel scope fix deployed to Hosting and five revenue-share Functions.
- Production HTML verifies index-4BuXq3cq.js; commit 959d5a43. Authenticated live tenant edits not performed.


## 2026-10-08 — In-progress Master business module access
Candidate Build .476 on local Mac only; React homepage and route guard updates pass tests. Firestore Rules and public/callable access audit outstanding. Not deployed. Respect no-Rules deployment rule without explicit approval; do not declare completion. See WORKLOG.


### Build .476 — Tenant Master access
- Home/private routes and tenant Firestore business collections enforce Master separation. User approved Rules deployment. No main merge. Retain generated old bundles.


### Production confirmed — Build 2026.10.08.476
- Master business Home/route filtering and Firestore tenant business collection access deployed successfully with user authorization.
- Production bundle index-BOJWGx2k.js; implementation commit 3ac480f5. Check WORKLOG. No main merge.
- Authenticated tenant smoke not performed; shared settings and callable access are outside this deployment scope.


## 2026-10-08 — Signup information visual compact layout
- Build 2026.10.08.477: expanded Super Admin tenant signup summary to full-width, Master left/detail grid right with responsive stacking. No backend logic changes. See WORKLOG.


### Production confirmed — Build 2026.10.08.477
- Compact full-width Super Admin signup information layout deployed on Hosting; implementation 9b4c0432. See WORKLOG.


## 2026-10-08 — Signup summary grid-span fix .478
- User reported .477 left-column layout. .478 forces registration summary to span all parent tenant-card grid columns; see WORKLOG.


## 2026-10-08 — Build .479 Home/POS loading fixes
- Home report readiness held until getTenantRevenueShareAccess resolves for owner/admin, POS Master guard uses styled full-screen overlay, Retail POS heading has green marker.
- Operational/React parity/Build PASS. See WORKLOG.


### Production confirmed — Build 2026.10.08.479
- Hosting complete, bundle index-BVRccUB-.js verified. Home loading, POS guard overlay and Retail POS heading marker fixes implemented; see WORKLOG.


## 2026-10-08 — Auto-save admin order .480
- Both category/menu order buttons renamed บันทึก; Sortable onEnd auto-persists on drop with queued latest change when saves overlap.
- Build .480. See WORKLOG for tests/deployment checkpoint.


### Production deployed — Admin sorting Auto-save Build .480
- Hosting updated with on-drop Auto-save for category/menu and renamed Save buttons. Implementation 1b562128. See WORKLOG.

## 2026-10-08 — Build .481
- Shortened Lalamove revoke button only, for mobile label fit; see WORKLOG.

### Build .481 deployed
- Short Lalamove revoke label in /admin/tenants deployed; implementation 290a4405.

## 2026-10-08 — Build .482
- Shortened Lalamove approval label; see WORKLOG.


## 2026-10-08 — WIP Delivery Slip2Go checkout / cashier / kitchen
- Started only: kitchen admission gate and tests in local working tree. NOT committed, pushed or deployed.
- Requires server-side verification + tenant-specific receiver + safe cashier manual approval + notifications before release.
- See latest WORKLOG. Do not deploy partial filter on its own.


## 2026-10-08 — Delivery Slip2Go central integration .483
- New restaurant Delivery verification callable and backend payment-finalization + kitchen alert triggers, merchant PromptPay receiver validation, manual cashier fallback and gated kitchen.
- Client messages localized. Modified Rules for kitchen payment field protection. Build .483 candidate.
- Before completing rollout inspect Firebase function deployment, callable runtime and authenticated checkout manual/E2E smoke; see WORKLOG.


### Shipping fee authenticity .483
- Server verifies delivery fees against persisted Lalamove quote, cached Google route or configured manual zone before Slip2Go auto-paid. Unverifiable -> cashier manually confirms, mismatched -> customer retries. Added quotePublicLalamoveDelivery to deployment scope. Firestore Rules dry-run clean.


### 2026-10-08 — Slip2Go Build .483 DEPLOYED
- User authorized and deployment succeeded: 5 Functions (verifyDeliveryPaymentSlip/finalizeDeliveryPaymentSlip/approveDeliveryPaymentReview/notifyKitchenDeliveryAdmitted/quotePublicLalamoveDelivery), Firestore Rules, and Hosting foodapp.
- Production /admin and /delivery reference index-BFsKHcE-.js, asset 200; no main merge.
- Next step: authenticated live E2E for matched/rejected slips, auto-paid/cashier manual and Kitchen notification; no real slip tested yet. See WORKLOG.


## 2026-10-08 — Delivery mobile sticky categories .484
- Mobile Delivery: only category tab strip is sticky; search scrolls with menu; active category follows current visible menu and tabs center automatically. Desktop/Table Order behavior unchanged. Hosting-only release; see WORKLOG.


### Build .484 delivered
- Delivery mobile category-only sticky/scroll-spy released to Firebase Hosting, implementation 3f4cb08a. Production verification recorded in WORKLOG.


## 2026-10-08 — Build .485 corrective mobile category pinning
- .484 sticky did not work according to user. .485 uses viewport fixed category strip + measured scroll anchor, search stays normal. Hosting only.


### Build .485 live
- Corrective viewport-fixed Delivery category scrolling released via Hosting, implementation 7df5d1f6. Live mobile visual confirmation still needed.


## 2026-10-08 — Delivery mobile both controls fixed Build .486
- Both category tabs and menu search now pinned together on mobile Delivery. Previous .485 pinned category alone. See WORKLOG.


## 2026-10-08 — Build .487 cashier legacy payment/audio candidate NOT DEPLOYED
- Legacy 07/10 slip receipt fails direct payment update since Firestore .483 protected fields. New candidate accepts pre-rollout legacy cashier approval via trusted callable, and kitchen notifier filters out unadmitted order IDs. Test/build then seek explicit Functions rollout permission. See WORKLOG.


### Build .487 deployed to Production
- Authorized and successfully deployed approveDeliveryPaymentReview Function and Hosting foodapp; /cashier serving index-B1NTOMkh.js.
- Follow up: real cashier legacy-slip settlement and browser sound bell/permission tests; see WORKLOG.

## 2026-10-08 — Quick Order display QR pairing repair, Build .488 (SOURCE ONLY, NOT DEPLOYED)
- User reports /pos/customer-display quick-order-* pairing QR / Open POS goes Retail POS.
- Confirmed previous URL-only commit d126ac8 was never built/deployed. Further issues: restaurant Master guard treated /pos/customer-display as Retail; QuickOrderPage ignored paired displayId after scanning/login.
- Code prepared on feature/react-firebase-port: new /cashier/customer-display route, QuickOrder links to it, pairing QR selects /cashier/quick-order for quick-order-* IDs, QuickOrder reads displayId/registerId from URL and writes to paired Firestore display, login preserves next path + query, restaurant-only legacy quick-order displays handled in MasterBusinessGuard.
- Regression script tests/react-parity/quick-order-display-pairing.spec.mjs added to React parity suite. Release prepared 2026.10.08.488.
- Desktop Commander quota exhausted; no local npm tests/build or Firebase Hosting deployment possible from this chat. Production remains .487 pending verified build and deploy, NO main merge.
- Next: on authorized Mac run git pull --ff-only origin feature/react-firebase-port, npm run test:operational, npm run test:react-parity, npm run build:react (generates .488), npx firebase-tools deploy --only hosting:foodapp --project chat-45754, then authenticated QR + button smoke tests including staff-device pairing and restaurant-only Master.

## 2026-10-08 — Build .489 Quick Order cashier back icon alignment (SOURCE ONLY)
- Scoped quick-header-back icon centered Y on desktop, X+Y on mobile using 40x40 square and 18px icon box. Added mobile accessible name and regression checks.
- Static GitHub source checks 8/8 PASS. Desktop Commander quota remains exhausted; no local tests/build or Hosting deployment performed. Production still .487.
- This release also contains previous unreleased .488 Quick Order display pairing changes. Mac must pull ff-only, test, build, deploy Hosting, then verify both icon and QR pairing. Never reset/clean or merge main. See WORKLOG.
