# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P11-B001 Customer Display Foundation
Version: 0.12.89
Build: 2026.07.06.009

Change: removed the receipt logo/icon from the POS receipt header and added the first Customer Display foundation. Added a new /pos/customer-display page, display styles, realtime display viewer, and POS publisher that syncs current cart/customer/VAT totals to a tenant-scoped customerDisplays record with localStorage fallback. The POS page now loads the display publisher and bumps the receipt tax invoice cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
