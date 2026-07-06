# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B002 Running Number
Version: 0.13.13
Build: 2026.07.06.033

Change: aligned the POS safe confirm flow with the P9-B002 running-number foundation. Local/offline sales now keep the same stable saleId, use a shared pending SALE document number while waiting for sync, and carry P9-B002 running-number metadata so the offline sync transaction can reserve the final Firestore SALE number without creating duplicate bills or double stock deductions.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
