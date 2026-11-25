# Latest Source JSX rebaseline — P1 Platform / Pricing / Contact slice

**Date:** 2026-11-25 (Asia/Bangkok)
**Source NEW (user-selected, read-only):** `cosmatch/lukkhaja`, `feature/react-golang-vite-tailwind-axios@7bf9d15934f387cd887b46d1b17ca1f2924ffab0`. Source HEAD and `git ls-remote` agreed; clean Working Tree.
**Target:** `Natchanon45/food-order-app`, `feature/react-firebase-port`, base `fc48054952f912694cce7cd6d59276f6a4e975be`.
**Status:** **P1 new-Source UI and safe receiver adapter implemented locally**; provider-side financial method switching and later modified Source modules **not ported yet**. No Production deployment, merge `main`, real money, Source edits or APK/IPA.

## Rebase inventory

See [Complete 65-page JSX inventory](./LUKKAJA_JSX_SOURCE_REBASELINE_20261125.md). Source now has 65 top-level pages / 36,001 lines vs Target 53 pages / 30,893 lines at the start of the new rebase. 52 shared filenames, 13 Source-only, 1 Firebase-specific Target-only. Old pinned Source was `8b108f1` on a different branch; Source latest changes include 15 JSX commits and 8 changed page files since that old pin. **Do not wipe an existing Firebase port to restart from zero.**

## Completed UI / action families (10)

1. Pricing Premium form matches latest Source removal of the obsolete Slip2Go quota editor. The billing model retains `monthlySlipQuota` and Reset preserves the previously stored value, not the legacy default.
2. Existing Premium monthly/annual, VAT, discount, Delivery share and immutable threshold history remain functional and Firebase-protected.
3. New `PlatformCollectionPreferences` section uses Source bank/PromptPay vs Stripe cards, setup guidance, provider navigation and responsive CSS. **Both payment-method choices and Save are deliberately disabled** until PENGUIN has provider-confirmed routing/webhook/LINE settlement support. A receiver account is never presented as proof of payment.
4. Platform central receiver card follows the Source new JSX: bank dropdown with dynamic label, bank account, Thai/English recipient name, optional PromptPay phone/citizen fields, semantic notes and effective-date anchor `#platformReceiverSettings`.
5. Retired Slip2Go API URL, token and provider-test fields were removed from the visible Platform receiver card. Existing private legacy data and backend compatibility APIs remain unchanged for future, separately approved migration/audit.
6. Receiver BankSelect gains Source dynamic-label behaviour; Source `react-port-platform-receiver-redesign.css` and `react-port-platform-collection.css` are copied into scoped PENGUIN UI style modules.
7. New Firebase `getPlatformReceiptReceiver` is **Superadmin-only** and reads `platformPrivateSettings/receiptReceiver`. When this document is absent, it may display a valid old receiver as an **unconfirmed draft** without copying or changing the old `platformPrivateSettings/slipVerification` document.
8. New `updatePlatformReceiptReceiver` is Superadmin-only, checks bank/PromptPay inputs, compare-and-swap `expectedRevision` in Firestore transaction, writes only the dedicated private receiver document, and confirms canonical readback. No Tenant invoice, payment, Stripe or wallet document is written. `paymentRoutingEnabled:false` is explicit.
9. Browser Client refuses silent repeat after an uncertain write; it locks Save until reload and requires Server+readback revision/field confirmation. A conflicting revision also locks until new read.
10. Contact LK Shop heading copy updated from latest Source while keeping P1.3 scoped Firebase pairing and email-verification guards intact.

## Firebase / security pseudocode (6)

```text
1. GET receiver:
   validate signed verified user via common Callable guard
   validate active Superadmin profile
   read platformPrivateSettings/receiptReceiver
   if absent, inspect legacy Slip2Go receiver only for a draft
   return revision and config; paymentRoutingEnabled=false; no write

2. POST receiver:
   validate active Superadmin and bank code/account/name/PromptPay
   require expectedRevision, begin Firestore transaction
   reread actor privilege and private receiver version
   reject stale revision; write only private receiver doc + server timestamp
   reread canonical version and payload to confirm success

3. Render Source latest Platform:
   load actual receiver with authorized Firebase Callable
   collapsed ControlCard expands on #platformReceiverSettings
   dynamic 010xx bank select + PromptPay with form checks
   require confirmation before Save; error/unknown reply locks retry

4. Price reset:
   update Premium editable defaults
   preserve existing deliveryThreshold and historical monthlySlipQuota
   hide obsolete Slip2Go quota editor only; keep immutable threshold schedule

5. Source payment method UI:
   show two source options, readiness links, and status
   disable all switching and payment activation until real Firebase
   LINE bank matching and Stripe webhook integration is audited
   do not mark any invoice Paid from form configuration alone

6. Accept:
   test Account/Auth role access, input/PromptPay validation,
   revision concurrency, old secret untouched, no Tenant writes
   run Chrome real React + Firebase Emulator and responsive checks
   never use default Production project or email external addresses
```

## Automated acceptance

| Suite | Result |
|---|---|
| Latest-source static/React boundary | 5/5 PASS |
| Existing updated page/financial contracts (Pricing, Contact, bank picker, Firebase readiness) | 14/14 PASS |
| Isolated Firebase Firestore receiver policy (roles, invalid bank, revisions, legacy read, no payment mutation) | 6/6 PASS |
| Real signed React Chrome + Auth/Functions/Firestore/Storage emulators (320/390/768/1440, hidden quota, disabled rails, receiver save + independent canonical reread, existing secret unchanged) | 1/1 PASS |
| React Build / generated Hosting contract | PASS |
| Full React Parity | **PASS, exit 0**, complete serial `npm run test:react-parity` after reconciling old contracts to the current Firebase and pinned JSX Source |
| Managed Email Callable security audit | **6/6 PASS**, 46 modules / 146 Callable definitions all pass the shared pre-handler gate |
| Foundation and P0 actions | **PASS**, including new receipt-recipient read/update authority |
| Final React Build / generated Hosting contract | **PASS, exit 0**, `2026.11.09.535`, `/react/assets/index-80qqAEP2.js`; all build-only `public/**` files discarded, no deploy |

Run `npm run test:p15-new-source-contract` and `npm run test:p15-source-platform`. Full regression independently passed via `npm run test:react-parity` (**exit 0**). Runner uses the fixed `demo-penguin-hybrid` project with local JDK21, Firestore port 8189 (8080 belongs to another service), explicit double emulator opt-in, no external browser provider network access, two isolated backend/Browser sessions, and temporary config cleanup. Preserve the original `tools/p14-run-local-acceptance.mjs` and its test history.

## Security audit expansion and preservation

The former P1.3e Callable contract expected exactly 45 protected modules / 144 protected v2 Callables. This new central receiver adds one module and two Callables. The updated **strict audit checks all 46 modules / 146 onCall definitions**, each using `managed-email-callable` as a pre-handler guard, rather than skipping or weakening the test. Older Source-only React contract assumptions about Slip2Go UI were upgraded to enforce no retired provider fields and to verify `updatePlatformReceiptReceiver` + canonical readback; existing atomic Owner/Staff/Tenant contracts were reconciled to the already-implemented PENGUIN Firebase operation-recovery interfaces. All updated tests passed, and the **entire Full React Parity suite exited 0**.

## Remaining new Source deltas — do not claim complete

**Next high-priority module:** Source `AdminTenantsPage.jsx` now uses unified `wallet.topupHistory`, approval appeal reference guard, `BankalertStripeHistory unified`, and notification row identifiers; Target Firebase wallet API still differs. Port it only after confirming the canonical bank and Stripe evidence in Firebase, and test stale/missing/duplicate rows across Owner vs Superadmin.

Source `PlatformCollectionPreferences` also exposes an operational Stripe vs LINE/LK Connect payment switch and `PlatformCompanionPairing` with real Go backend. PENGUIN **does not have equivalent verified routing provider support**: switching remains blocked by design, to be implemented in its own Billing/Provider module with Staging confirmation, webhook signature verification, idempotent receipts, provider/manual-review guard, private secrets, and safe rollback. The currently ported section is a **read-only setup surface**, not working payment collection.

After these gates: Source Admin Merchant pages, Cashier/Kitchen/Delivery LINE and Lalamove transition changes, and POS. The 13 Source-only Master/Bridge pages are NOT automatically standalone Firebase routes. P1.3 real provider Staging remains independently blocked due missing authorized Staging Firebase project/inbox. Do not issue invoices or migrate source data in this module.
