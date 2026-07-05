# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.87
Build: 2026.07.06.007
Milestone: Sales VAT Report Stability

Change: fixed Sales History freezing by limiting the VAT report helper MutationObserver to the sales table body with debounce and an enhancement guard. Also improved POS cart summary spacing between discount and VAT controls. UI/stability patch after P10-B004.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
