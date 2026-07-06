# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.10
Build: 2026.07.06.030
Milestone: POS Save Freeze Guard

Change: removed the legacy after-sale localStorage hook that could repeatedly restore product cards during payment save and freeze the POS page.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
