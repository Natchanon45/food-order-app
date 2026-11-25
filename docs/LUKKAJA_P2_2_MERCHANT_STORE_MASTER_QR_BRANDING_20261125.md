# P2.2 — Merchant Store Master, QR and Source Y-axis branding

**Date:** 2026-11-25, Asia/Bangkok
**Source (read-only):** cosmatch/lukkhaja / feature/react-golang-vite-tailwind-axios @ 7bf9d15934f387cd887b46d1b17ca1f2924ffab0
**Target:** Natchanon45/food-order-app / feature/react-firebase-port, based on P2.1 @ a53935056be40fe43d7ed5649323ca639a1377f9.
**Status:** **P2.2 COMPLETE in isolated local Firebase+Chrome acceptance**. Not deployed. This does NOT mean the entire 10-page P2 Merchant Admin/onboarding Phase is complete.

## Source-to-target inventory and routing choice

The Source-only AdminStoreMasterPage.jsx is a 364-line incremental extraction that is not referenced by its Source router. Existing Target AdminPage.jsx already owns the same Store Basics/settings form, location, hours, payment options, delivery provider/Lalamove, promotions, distance fee configuration, menu/table master and Delivery/Takeaway QR cards. Introducing a second standalone page would duplicate the editable store model and risk divergent Firestore state. P2.2 completes **the Store Master / branding / QR slice inside the existing AdminPage route** and verifies the previously ported Store master actions against strict Firebase rules. Source QR and branding are ported semantically; brand name, Firebase adapter and production limits remain PENGUIN.

## Completed action families (10)

1. **Store route/layout:** Original AdminPage retains one Store card with Source-compatible storeMasterCard ID and collapsible Store Basics, location, opening hours, payment, delivery, promotion, fee and Lalamove sections. Source-only AdminStoreMasterPage is NOT added to App.jsx; no second settings store.
2. **Store Basics:** Store name, phone and address remain controlled inputs; Save is via the existing tenant-scoped saveAdminStoreSettings Firebase adapter. The page independently compares canonical readback text, number, fee, promotion, opening-hour, logo/cover URL and focus values before showing success.
3. **Logo image:** Single image preview plus choose/remove actions, HTTPS-only saved URL for remote image, local blob URL for a selected upload and cleanup of blob URLs. Modern circular logo in real Delivery, Takeaway, table and Quick Order hero is retained; no synthetic/default image uploaded.
4. **Cover crop:** New Source behavior has ONE real crop frame with CSS object-fit cover and object-position 50% Y%. Dragging the picture down decreases Y by the physical overflow, dragging up increases Y; clamp [0,100], skip a crop-less image, pointer capture supports mouse/pen/touch, keyboard ArrowUp/ArrowDown with Shift step, Home resets to 50, explicit Reset.
5. **Cover storage model:** On edited focus, X becomes 50 and Y is stored to 0.1%. Legacy historical X remains untouched until an explicit focus edit; no silent DB backfill. Choosing a new cover resets X/Y to 50. The Public four surfaces continue to read persisted focus from store settings.
6. **Image upload:** On Save, the existing adapter compresses JPEG/PNG/WebP originals <= 8 MB to WebP <= 5 MB, uploads only to tenants/{tenantId}/product-images/store-branding/..., obtains Firebase Storage URL, saves to Firestore, and confirms readback. No public Storage write policy is opened.
7. **QR Delivery:** On-device QR PNG from the Source local QR encoder, standard 4-module quiet zone, copied store URL, printable card and file download. No outbound quickchart.io QR request or extra dependencies.
8. **QR Takeaway:** Same on-device PNG and copy/download/print, with distinct /takeaway URL and filename. Both keep the original PENGUIN brand and paper layout.
9. **Firebase role isolation:** Existing Firestore Storage rules grant owner/admin from authorized Tenant; cashier, other-Tenant owner and anonymous are denied. New Emulator test verifies saved Shop name, location/crop Y, bank recipient fields and logo/cover upload/readback without Production side effects.
10. **Responsive / regression:** Source branding CSS, four Chrome widths, logo crop, cover pointer + keyboard + reset + remove, QR download and print markup. Original roles/settings and financial routes unchanged.

## Pseudocode (7)

    LOAD:
      require authorized Owner/Admin and active tenant via existing Auth/Tenant UI
      fetch tenants/{tenantId}/settings/store and related existing Store master
      initialize form fields, fee tier, logo and hero focus without migration

    PICK LOGO OR COVER:
      require JPEG/PNG/WebP and size <= 8 MB before accepting new file
      use object-URL preview only; revoke preview URL on replacement/unmount
      if cover changed, set X=50 Y=50; no network upload until Save

    DRAG COVER:
      measure rendered cropped picture overflow inside fixed banner frame
      on pointer down: capture pointer, remember initial Y and pointer position
      on move: Y = clamp(initialY - deltaPixels*100/overflow)
      persist X=50 Y; keyboard ArrowUp/Down (2%, Shift 10%), Home=50
      if no overflow, no fabricated movement

    SAVE SETTINGS:
      compress selected pictures to WebP <= 5 MB in client canvas
      upload each to own Tenant Storage, never cross-Tenant
      merge settings through existing Firebase service, preserving unrelated keys
      independently verify returned Firestore snapshot against saved payload
      only then release pending files and show saved

    PRINT/DOWNLOAD QR:
      encode exact current local-origin /s/{tenant.slug}/delivery or /takeaway URL
      create PNG in a local canvas with solid black/white modules and quiet zone
      render image as a data URL; download PNG or print the current paper markup
      never call a third-party QR image URL

    ACCESS GUARD:
      Owner/Admin of same Tenant: allowed settings write and scoped image upload
      Cashier/foreign Tenant/anonymous: prohibited by Firestore and Storage
      do not loosen auth, payments, Cloud Functions or storage paths

    ERROR/RETRY:
      disable save while busy; upload or Firestore errors show failure
      never claim saved if post-write readback disagrees; keep unsaved edits
      no auto-billing, no Production provider keys or payment notification writes

## Acceptance scenarios (16)

- Existing AdminPage owns only one Store card, no duplicate Source-only route.
- Store values read back from canonical settings/store by the authorized Owner.
- Admin of the same Tenant can update Store profile with limited rights.
- Cashier cannot alter Store settings or brand Storage.
- Other Tenant Owner cannot alter Store settings or brand Storage.
- Anonymous cannot create a Store settings document.
- Store logo and cover both upload to correct tenant Storage path.
- A saved hero Y focus persists unchanged across canonical readback.
- Legacy focus defaults to 50 when missing or invalid; old X is not silently backfilled.
- Only one cover image preview exists, not a second source preview or marker UI.
- Drag up/down has correct physical semantics and bounded focus.
- Keyboard arrows, Shift, Home and explicit Reset work on the crop frame.
- Removing cover revokes preview, clears focus and does not save automatically.
- Four widths 320/390/768/1440 show no horizontal page overflow.
- Delivery and Takeaway QR are independent locally generated PNG images.
- The PNG download and printed paper have the intended PENGUIN brand without calling external QR service.

## Financial and release boundaries

Changing the Store recipient fields is a configuration action, NOT a verified payment. Source LINE/LK Connect topup and stripe live payment are separate provider/bank-authority modules with independent acceptance. COD remains subject to previously approved temporary restrictions; the P2.2 visual port does not enable it. No Production update, Provider-key change, historical Tenant migration, mobile app build or main-branch merge.

## Local QA receipts

- Strict Source Store Master/branding/QR policy + previous regression: 16/16 PASS.
- Demo Auth+Firestore+Storage Emulator: 1/1 PASS with authorized same-Tenant Owner/Admin and denied Cashier/foreign Owner/anonymous; persistent Store profile + logo/cover paths.
- Real Chrome 320/390/768/1440, drag/keyboard/remove, offline PNG QR/download and the real printHtml generated paper (including the embedded PNG/PENGUIN branding): **1/1 PASS**. A physical printer and OS-native print dialog were NOT tested.
- Full React Parity: **PASS, EXIT 0** (complete serial suite, including all retained merchant, finance, security, storefront and POS contracts). Final React Build and generated Hosting Contract: **PASS, EXIT 0**, build version 2026.11.09.535, bundle /react/assets/index-CIkIr1RM.js. Temporary public build products restored/removed, no deploy.
- Source Git tree read-only and untouched. Target changes committed and pushed only to feature branch; verify Git remote SHA in closing report.

## Next P2 phase boundaries

P2.2 is fully scoped to the **Store Master/branding/QR** module. Other P2 files and flows (signup/onboarding, login/bridge/session, Admin Sales Report and deeper Provider-controlled settings) continue under separate independently tested modules. Do not mark the entire P2 phase complete on this commit.
