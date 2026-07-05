# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P10-B002 POS VAT Mode Per Sale
Version: 0.12.84
Build: 2026.07.06.004

Change: added POS VAT mode selection per sale for VAT-registered stores. POS now loads tenant-scoped VAT settings, lets the cashier choose include VAT or exclude VAT for the whole bill, calculates VAT after discount and point discount foundation, updates payment totals, and saves VAT fields with each sale for online and offline flows. Receipt VAT rendering and VAT sales reports are planned for the next milestones.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
