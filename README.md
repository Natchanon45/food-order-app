# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer / POS UX Hotfix
Version: 0.13.26
Build: 2026.07.06.046

Change: refined Retail POS PC cashier UX. Product hover now fades in/out with a bottom-heavy black gradient that is darkest at the lower edge and gradually fades upward. The PC cart panel is more compact, with smaller text, tighter rows, compact summary controls, and a scrollable cart area sized to show at least five selected product rows in normal desktop use.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
