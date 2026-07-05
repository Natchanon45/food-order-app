# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.93
Build: 2026.07.06.013
Milestone: Sales Page Stabilization

Change: stabilized /pos/sales by removing stacked helper scripts from the Sales page and using the main retail-sales.js renderer only. The page now loads only toast, retail-sales.js, and navigation scripts, reducing duplicate observers/import chains that could freeze the Sales History page. VAT columns remain handled by the main sales renderer.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
