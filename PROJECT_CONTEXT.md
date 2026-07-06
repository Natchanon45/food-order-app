# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.56
Build: 2026.07.06.076
Milestone: P9-B006-14 Print Font Scope Polish

Change: standardized local Thai font loading. TH Sarabun PSK Local is now defined in one shared CSS file and scoped to printed paper surfaces (`.receipt`, `.tax-paper`) plus the customer display shell. Receipt/tax invoice toolbars, headers, buttons, and tax buyer modal keep the normal app UI font so the popup controls look consistent.

Completed: P9-B005 Customer Display work and P9-B006 Full Tax Invoice through print font scope polish.

Usage: open a receipt after sale. The popup toolbar and buyer modal should use the normal app UI font, while the printable receipt/tax invoice paper uses TH Sarabun PSK Local. Customer Display keeps the local Thai font scoped to its display shell.

Deploy rules: use hosting-only deploy for `public/` asset changes. Deploy functions only when files under `functions/` or function rewrites/routes change. This build only needs hosting deploy.

Next Task: improve customer tax profile management, tax invoice running number counter, and void/cancel tax invoice support.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
