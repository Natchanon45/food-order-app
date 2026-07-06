# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B004 Firestore Rules Hotfix
Version: 0.13.20
Build: 2026.07.06.040

Change: updated Firestore Security Rules for Retail POS sync. Added tenant-scoped `runningNumbers` access, relaxed POS sale sync validation for offline sales without `cashierId`, allowed POS stock update with `shopId`, and added `customerDisplays` tenant rules. This fixes permission-denied errors during running number reservation and POS sync transactions.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only firestore:rules,hosting
