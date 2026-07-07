# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.81
Build: 2026.07.07.025
Milestone: POS Mobile Button Layout

Change: improved mobile POS button layout by compacting the `/pos` header actions, reducing the visible sync status footprint on small screens, and reorganizing receipt/tax print toolbar buttons into clearer mobile rows.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus local POS UI font coverage, menu icon cleanup, UI font-weight tuning, POS drawer title icon cleanup, POS legacy drawer icon guard, POS menu group chevron cleanup, POS menu pseudo-chevron cleanup, POS theme alignment with Order/Delivery, mobile product image-card overlay tuning, and mobile POS button layout tuning.

Usage: open `/pos` on a mobile viewport and verify the header buttons fit cleanly with the POS title, the sync status appears as a compact dot/button control, and the customer display button remains icon-only. Open a POS receipt window on mobile and verify the full tax invoice button uses its own row while print/close buttons align evenly below it. Verify buttons and forms still use `Kanit Local` from `/assets/fonts/`, POS menu group expand/collapse buttons still show exactly one Bootstrap chevron, and receipt/full tax invoice print pages still use `TH Sarabun PSK Local` from `/assets/fonts/`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
