# P3.4 — Delivery Checkout original-slip staging, explicit review, signed original-order correction

Date: 26 November 2026, Asia/Bangkok.

Source READ ONLY: cosmatch/lukkhaja, feature/react-golang-vite-tailwind-axios @ 7e47e85f9012e4b084b68d816b32b6e60b15f3d2.
Target WRITE: Natchanon45/food-order-app, feature/react-firebase-port, starting @ 4c1d112c04d784aec99c968f2406aee9e0e821cf.
Existing P3.4 high-DPI Thai QR source refresh remains in docs/LUKKAJA_P3_4_SOURCE_REFRESH_THAI_PAYMENT_QR_20261125.md.

## Scope and latest JSX adaptation

DeliveryPage.jsx (Source 1618 LOC): staged original slip begins on file selection and displays a striped, 9-second genuine upload progress indicator, never implying bank paid. Checkout review includes a read-only cart, delivery fee and total, explicit PromptPay payment selection and one confirmation. The Source Laravel/Go payment API is NOT copied. On the Firebase Target, per-file transfer uses Firebase Storage resumable upload; the immutable proof is already staged when the customer explicitly submits the order.

DeliverySuccessPage.jsx (Source 1006 LOC): a customer who still has the unique first-create 256-bit capability in this exact browser may request a scoped correction-state check and submit an original slip against the *same* pending PromptPay Delivery order. The capability is returned only on first successful intake and its SHA-256 digest is stored in the order. The public order snapshot never contains the plaintext token. Existing confirmed QR five-minute path and its separate late-slip secret remain separate.

One existing shared PublicCartList component now has optional readOnly presentation to display the original cart unchanged inside the review modal. No additional project or duplicate pages.

## Completed action families (13)

1. Select a real JPG, PNG, WebP <=8MB original slip and automatically stage to real Firebase Storage, not to an external QR/slip service.
2. Callback receives actual Storage bytesTransferred/totalBytes; visual progress never leads actual recorded bytes or shows 100 prior to successful Storage acknowledgement.
3. Preserve visibly striped upload progress for ~9s even if the upload finishes quickly; 100% is file transport only, NOT bank paid.
4. Checkout disabled during a running slip upload. The customer may remove the image only after it has completed, or choose a new image after an explicit error.
5. Stage is bound to Tenant, stable order ID and same File object. The checkout consumes exactly the existing stored path, never reuploads on confirm.
6. Checkout uses a Source-like review dialog with existing cart rows in read-only mode, original food total, delivery fee and net amount.
7. Payment options in review are restricted to currently authorized PromptPay; COD is globally held and unimplemented live Stripe is not shown as payable.
8. Modal body scroll and viewport 320/390/768/1440; close, Escape, focus return and explicit confirmation never bypass existing delivery route/address/server gate.
9. For non-five-minute-QR PromptPay, first-create delivery callable returns a unique 256-bit correction capability, persisted only in sessionStorage scoped to exact tenant/order. The only server persisted field is its SHA-256 digest.
10. A new public correction-state Callable checks token/tenant/order matching, 14-day expiry, pending payment state and current original proof; it never exposes a paid or COD option.
11. A new original-order correction Callable validates exact path, original Storage image bytes/MIME/metadata/size and global SHA-256 uniqueness before accepting any slip.
12. Transaction atomically writes one immutable revision audit and global duplicate claim, and updates the original order to pending_manual_review; it never sets paymentStatus=paid, admits Kitchen, dispatches riders or approves refunds.
13. Same exact successful submission returns idempotent alreadySubmitted on an ambiguous retry; mismatched path, reused proof, stale token, wrong tenant or paid order are rejected.

## Pseudocode (8)

    CHECKOUT_SELECTION:
      if current payment QR locked and valid JPG/PNG/WebP:
        reserve original existing order ID
        begin resumable Firebase Storage upload immediately
        progress from real byte counters with 9sec visual hold
        after Storage ack set staged path and 100%
        do not start a bank request

    CHECKOUT_REVIEW:
      show read-only original cart + food/fee/total + authorized payment rail
      on explicit confirm check original address/store/quote constraints
      if upload has not fully finished: block original submission
      if proof staged: bind same file, tenant and order ID
      only single original-order intake can create customer bill

    INITIAL_CAPABILITY:
      server creates 256-bit random secret for first PromptPay order
      store SHA256 digest in order; return plaintext only to creating browser
      never expose the secret in public get/order data
      browser saves it in tenant/order-specific sessionStorage

    CORRECTION_RIGHTS:
      verify token constant-time against digest
      verify same Tenant, delivery type, PromptPay method and non-QR mode
      require original pending_verification order created within 14 days
      only allow a missing or expressly rejected proof and limited revisions
      if not eligible: hide file input, never offer COD or manual paid

    CORRECTION_UPLOAD:
      customer file selection immediately stages a new unique Storage object
      display real transfer bytes and progress; no automatic approval
      once stored, confirm original order's slip path to signed Callable

    CORRECTION_TRANSACTION:
      read original order and global proof hash claim
      recheck token, pending status, no duplicate image
      create immutable audit and duplicate hash claim
      store manual_review pending; do not mark paid or release Kitchen

    RETRY:
      same order + same authenticated image path -> alreadySubmitted
      different path, wrong tenant or changed order state -> refuse
      retain same order ID; no new order, invoice, QR or COD

    QA:
      pure/legacy contracts + actual Chrome/real Firebase Emulator
      cross-tenant, wrong token, duplicate, pending->paid, mobile responsive
      complete serial React Parity + React Build/Hosting Contract
      isolate nonproduction demo; never invoke live providers

## Acceptance scenarios (18)

1. Checkout selects image; staging starts automatically.
2. Real Storage progress follows transferred bytes, no premature 100%.
3. Short upload displays progress ~9 seconds, then "100% not bank paid".
4. Upload failure can be retried, no duplicated order or automatic verification.
5. Existing order ID and same File are reused for final order submission.
6. Checkout review renders original food/qty/note without altering the cart.
7. Review shows fee and total and only authorized PromptPay option.
8. Review confirmation is explicit; Escape/close/focus works at four viewport widths.
9. Signed original customer capability exists only in first create response, not the public order document.
10. Customer same tab/tenant/order is authorized while pending; wrong token denied.
11. Cross-tenant token or expired order is denied.
12. Paid/accepted/admitted-unverified order blocks new corrections.
13. Customer stages real JPG/PNG proof to the scoped tenant/order Storage path.
14. Upload alone does not change bank/order state, verification quota or Kitchen.
15. Signed submit records manual_review only, with one immutable audit and duplicate SHA256 claim.
16. Same HTTP POST repeated after success returns alreadySubmitted without a second audit.
17. Different/invalid path and forged paymentStatus are denied.
18. Existing confirmed-QR 5-minute capability/expiry/late-slip path remains independent; COD remains globally disabled.

## Verified test receipts

- Pure policy/Source/receipt contract: 7/7 PASS.
- Existing delivery server/security/reconciliation regression: 33/33 PASS.
- Real anonymous Chrome + Firebase Auth/Firestore/Functions/Storage Emulator: 1/1 PASS; real image upload, SHA256 claim, original order, wrong token, idempotency, paid deny, no Kitchen/payout; responsive 320/390/768/1440.
- Standalone real Chrome Checkout review: 1/1 PASS, all four widths.
- Full serial React Parity **PASS Exit 0**; final React Build and generated Hosting Contract **PASS Exit 0** (version 2026.11.09.535, /react/assets/index-BRwHz-t7.js). Generated-only public output cleaned.

## External providers and outstanding Source parity

Current PENGUIN non-five-minute QR checkout still uses the existing pre-order slip verification path before order creation, unlike the latest Source notification-first/optional-slip and Go bank observation. Full provider bank receipt correction, Stripe LIVE hosted checkout, Lalamove real quote/dispatch and M7 quota/appeal events require proper authorized Staging with independently signed provider and bank evidence. Therefore this is a **completed and tested local security/UI slice of P3.4, not a claim that both DeliveryPage and DeliverySuccessPage have complete latest-Source parity**. Local simulation cannot prove real bank payment. No Production, main merge, Source changes, APK or IPA.

Conservative fixed 65-page Master Checklist remains **15/65 accepted/dispositioned (23.1%)** and **50/65 pending latest-Source complete acceptance (76.9%)**, including these two partial Delivery pages. Existing Test/Build passing does not override this acceptance definition.
