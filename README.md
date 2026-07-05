# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P10-B001 VAT Settings Foundation
Version: 0.12.83
Build: 2026.07.06.003

Change: added VAT settings foundation for Retail POS store settings, including VAT registered status, VAT rate, default sale VAT mode (include/exclude), tax branch data, tax invoice display name/address, short tax invoice foundation, tenant-scoped Firestore settings persistence, and cache bumps for the settings page. POS sale calculation and receipt VAT rendering are planned for the next milestone.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
