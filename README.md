# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Save Timeout Fallback
Version: 0.13.09
Build: 2026.07.06.029

Change: added a POS Firestore save timeout fallback so the payment modal cannot stay stuck while preserving the stable saleId for offline sync.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
