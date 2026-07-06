# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.61
Build: 2026.07.07.005
Milestone: P9-B006-16 Customer Display Pairing Panel Fix

Change: fixed the Customer Display header layout after the font rollback. The pairing QR panel is now styled by the Customer Display CSS itself: the header shows a compact connection button, and the QR panel is hidden until hover/focus. The customer display CSS asset version was bumped to load the fix.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through customer display pairing panel fix.

Usage: open `/pos/customer-display?displayId=display-pc-01` and verify the header shows only the compact connection button. The QR panel should appear only when hovering or focusing the button.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
