# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.71
Build: 2026.07.07.015
Milestone: POS Font Family Standard

Change: standardized web UI fonts to a Thai sans/no-head stack and standardized printable receipt/tax documents to local TH Sarabun PSK via shared font variables.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through POS continuous scanner support, plus POS font family standardization.

Usage: open POS web pages and verify screen UI uses the Thai sans/no-head stack. Open receipt and full tax invoice print pages and verify printable paper areas use `TH Sarabun PSK Local` from `/assets/fonts/`.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
