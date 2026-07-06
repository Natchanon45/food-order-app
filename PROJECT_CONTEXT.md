# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.09
Build: 2026.07.06.029
Milestone: POS Save Timeout Fallback

Change: added a POS Firestore save timeout fallback so the payment modal cannot stay stuck while preserving the stable saleId for offline sync.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
