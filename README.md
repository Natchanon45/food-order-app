# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B004 Pending Number Helper Hotfix
Version: 0.13.21
Build: 2026.07.06.041

Change: added `pendingDocumentNumber()` export to `retail-pos-firestore-foundation.js` and bumped POS safe-confirm cache. This restores the sale save flow that depends on the shared pending SALE number helper, so the after-sale and loyalty point save path can continue.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only firestore:rules,hosting
