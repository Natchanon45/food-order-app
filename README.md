# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Sales VAT Report Stability
Version: 0.12.87
Build: 2026.07.06.007

Change: fixed Sales History freezing by limiting the VAT report helper MutationObserver to the sales table body with debounce and an enhancement guard. Also improved POS cart summary spacing between discount and VAT controls. UI/stability patch after P10-B004.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
