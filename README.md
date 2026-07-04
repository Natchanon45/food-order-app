# Food Order / Delivery / Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Receipt Print Polish`
- Version/Build: `0.12.70` / `2026.07.02.024`

## This Change

- Polished POS receipt customer name display.
- Improved mobile print timing for receipt modal.
- Bumped receipt modal script to `v=20260705-002`.
- Display/print-only change.

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```