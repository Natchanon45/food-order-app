# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: Retail POS Toast Icon Padding
Version: 0.12.78
Build: 2026.07.05.008

Change: fixed Retail POS toast icon rendering by replacing icon-font content with SVG mask icons and increased toast padding from 10px to 20px while keeping top-layer behavior. UI-only change.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
