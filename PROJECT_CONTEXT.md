# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.83
Build: 2026.07.06.003
Milestone: P10-B001 VAT Settings Foundation

Change: added VAT settings foundation for Retail POS store settings. Added VAT registered status, VAT rate, default sale VAT mode, branch data, tax invoice display name and address, and tenant-scoped settings persistence. POS sale calculation and receipt VAT rendering are planned for the next milestone.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
