# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.63
Build: 2026.07.07.007
Milestone: P9-B006-18 POS Continuous Scanner

Change: updated the POS sales barcode scanner to support continuous scanning. On the `/pos` sales barcode input, scanning a product now adds it to the bill and keeps the camera open until the user presses the close button. A short duplicate cooldown prevents the same code from firing repeatedly too fast. Other barcode scan flows keep their previous one-scan behavior.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support.

Usage: open `/pos` on mobile, press the barcode scanner button, scan products continuously, and press the X button only when finished. Hard refresh `/pos` after deploy if the browser still uses the cached scanner script.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
