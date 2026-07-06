# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Sticky Cart Panel
Version: 0.13.03
Build: 2026.07.06.023

Change: added a PC-only sticky cart layout for the POS screen. The right-side Sales panel now stays visible in the viewport while the bill summary, VAT section, hold buttons, and payment button remain fixed at the bottom of the panel. Only the cart item list scrolls vertically when many items are added. Bumped the POS sticky cart CSS cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
