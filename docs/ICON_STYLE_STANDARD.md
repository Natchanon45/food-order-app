# PENGUIN SVG outline icon standard

Owner's selection: 25 October 2026, screenshot showing the **first monochrome food-delivery rider/scooter icon** (IconPacks [Fast Food Delivery Bike #12992](https://www.iconpacks.net/free-icon/fast-food-delivery-bike-12992.html)).

## Standard for future icon changes

- Prefer **monochrome black-and-white outline/line-art**, not multicolor clip art and not filled emoji. Use **SVG with transparent background**, scalable at desktop and mobile sizes.
- **Use CSS `currentColor`** to recolor the same artwork in its context (green, blue, muted, hover/disabled states); keep background circles, button dimensions, position and padding from the approved page.
- Save files in the repo (`react-app/public/parity/icons/` is canonical). Reference the asset locally rather than linking to external providers at runtime. For React + Firebase Hosting, the build publishes it under `public/react/parity/icons/`.
- To reuse an icon in an inline card, apply a dedicated CSS mask like `background-color:currentColor; -webkit-mask:url(...) center / contain no-repeat; mask:url(...) center / contain no-repeat`. Keep accessibility text on the adjacent label and set the decorative icon `aria-hidden="true"`.
- **Only replace the requested icons**; leave unrelated icons and approved layouts intact. Icon choice is semantic: scooter/rider for Delivery, store for POS, wallet for settlement, parcel for Lalamove cost.
- Preserve evidence of the source, review the source's current license before adding future artwork, and keep an appropriate attribution/provenance comment. Do not automate scraping icon websites. If a pixel-perfect upstream SVG is required, download it manually from the official icon page and provide that SVG for review; the current asset is the **original SVG downloaded from IconPacks** by the project owner on 25 October 2026 and then included as a project asset. Its native paths are preserved; CSS masks supply the color.
- For each change: commit source/icon and tests on **`feature/react-firebase-port` in GitHub first**, pull Mac with `git pull --ff-only`, build/test, commit generated Hosting files, push, deploy **Hosting** to `https://penguin-food.web.app`, verify the deployed bundle, and do not merge `main` without instruction.

## Current Delivery example

The SVG is `react-app/public/parity/icons/delivery-bike-outline.svg`. `RevenueShareReportPage.jsx` uses `delivery-bike-line-icon` for Delivery sales, Delivery billing-cycle cumulative calculation and the customer delivery-fee panel. `revenue-share-report.css` masks the SVG with `currentColor`; no monetary code or Firestore data is modified.

Reference terms (as of 25 October 2026): https://www.iconpacks.net/terms/ — free commercial use and modification without mandatory credit, subject to restrictions on redistribution, resale as-is, and automated site access.
