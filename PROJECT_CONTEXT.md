# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.04
Build: 2026.07.06.024
Milestone: POS After Sale UI Restore

Change: added a POS after-sale UI restore guard to recover the product grid and page state after saving a bill. The guard listens to sales/product localStorage updates, repeatedly clears stuck dialog/inert/page state, and restores image product card markup after retail-pos.js re-renders the grid. Added product card restore CSS and bumped POS cache.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
