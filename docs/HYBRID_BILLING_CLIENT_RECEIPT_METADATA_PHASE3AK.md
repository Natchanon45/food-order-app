# Phase3AK — Client-side Delivery receipt-review metadata integrity

Date 2026-10-21 (Asia/Bangkok). GitHub-only source candidate. **DO NOT DEPLOY**.

## Gap detected after Phase3AJ
The existing tenant `orders/{orderId}` Hybrid Delivery Rules guard already forbade direct Client SDK writes of `paymentStatus`, `paidAt`, money totals, refund/receipt references, and Lalamove completion fields. However, COD/non-PromptPay Delivery was not covered by the separate `protectedDeliveryManualReview()` PromptPay-only attestation guard. Hybrid staff could still write review/verification metadata without server payment authorization. Such metadata must never be treated as actual bank proof, and leaving it mutable invited misleading audit records.

## Minimal fail-closed source change
`firestore.rules` function `hybridDeliveryReceiptFieldsUnchanged()` now rejects a changed field among:
`paymentReceivedAt`, `paymentReviewedAt`, `paymentReviewedByUid`, `paymentReviewedByEmail`, `paymentReviewedByRole`, `slipVerifiedAt`, `slipVerificationProvider`, `slipVerificationStatus`, `slipCheckStatus`, `paymentReviewRequired`.
The existing `isHybridTenant` and `orderType=delivery` predicates are unchanged, so the candidate preserves an ordinary status-only update when operationally authorized and leaves non-PromptPay legacy behavior unchanged. Source-only: Admin SDK bypasses Firestore Client Rules, and privileged legacy/backoffice/REST/import writer enrollment remains incomplete.

## Isolated Auth + Firestore Emulator regression
`tests/react-parity/hybrid-billing-rules-emulator.spec.mjs` adds a ten-field matrix for both Hybrid Owner and Super Admin (direct `updateDoc` and `setDoc merge`), asserts no forged metadata persisted, and verifies ordinary `status` updates still work. A separate test verifies that Legacy non-PromptPay Owner can still use its previous review metadata path. Both are isolated under `demo-penguin-hybrid-rules-uat`, loopback 127.0.0.1:8188 and Auth 9098, not production.

Code commits: `871332476e31ecc760aa82a6d2775ce81b523b9f`, `807103abdff4eb9ef049892e17d0744c9ebead05`. Push run `39572387854` and PR run `39572394193` initially pending; inspect final CI output separately before claiming verified counts.

## Remaining Release Gates
Neither the cashier non-PromptPay canonical paidAt trusted writer nor source-complete suspended Hybrid backend/Rules enforcement is delivered. Do NOT close the original two Emulator TODO; do not count the mock gateway as global enforcement. Phase3AC 10k demo journal writers at 2 workers are not source-complete or 8-worker proven. Authenticated provider PAID_OUT, independent posted bank/Wallet credits, immutable next-open-day adjustments, finance/tax approval, App Check devices and Owner/Super Admin UAT remain blocked. All four flags FALSE, finance candidates unexported, Draft PR unmerged, no real money writes, no Firebase deploy.
