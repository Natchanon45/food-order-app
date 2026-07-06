# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B003 Counter
Version: 0.13.17
Build: 2026.07.06.037

Change: implemented idempotent POS counter reservation. `reserveRunningNumber()` now reads counter and running-number reservation before writing. Each saleId gets one reservation row in `runningNumbers`, so retry/sync with the same stable saleId returns the same document number and does not increment the counter again.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
