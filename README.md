# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Retail POS Bootstrap Toast Icons
Version: 0.12.80
Build: 2026.07.05.010

Change: replaced Retail POS toast pseudo/emoji/SVG icons with real Bootstrap Icons in the DOM using bi-check-circle for success and bi-x-circle for error, while preserving top-layer behavior and 20px padding. UI-only change.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
