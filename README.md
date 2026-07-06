# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B004 Loyalty + Receipt Privacy Hotfix
Version: 0.13.22
Build: 2026.07.06.042

Change: improved POS loyalty saving and receipt privacy. Loyalty points now save from the sale-saved event instead of timing guesses, with customerId fallback from the saved sale. Receipt output and sales receipt dialog now show the correct tax title, VAT rows, loyalty point summary, and masked customer name/phone.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only firestore:rules,hosting
