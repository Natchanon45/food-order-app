# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Receipt Modal Close Guard
Version: 0.12.99
Build: 2026.07.06.019

Change: added a POS receipt modal close guard to prevent the page from getting stuck after a successful sale. The guard closes the print-bill modal from the close button, backdrop click, Escape key, or after printing, and clears any stuck modal/inert state so the POS screen becomes clickable again. Bumped the POS receipt modal guard cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
