# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Sales VAT Helper Cache Fix
Version: 0.12.88
Build: 2026.07.06.008

Change: fixed Sales History VAT columns not loading by bumping the cached sales VAT helper script on the sales page. This ensures the VAT report helper runs after deploy and aligns table rows with the VAT headers. Follow-up patch after P10-B004.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
