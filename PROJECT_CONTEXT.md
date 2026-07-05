# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.91
Build: 2026.07.06.011
Milestone: Customer Display Equal Height + Sales Stability

Change: adjusted the Customer Display PC layout so the left customer/totals column and the right product list card align as a full-height two-column view. Stabilized Sales History by disabling the wide VAT report observer helper, replacing it with a lightweight non-observer VAT row patcher, and bumping Sales script cache versions.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
