# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 CustomerDisplay QR Icon Exact Markup
Version: 0.13.39
Build: 2026.07.06.059

Change: updated the Customer Display compact QR Pairing trigger to use the exact Bootstrap icon markup `<i class="bi bi-qr-code"></i>`. The customer display page now loads the local Bootstrap Icons stylesheet directly, removes the fallback symbol from the trigger, and keeps the full QR panel hover/focus-only.

The previous Multi Register and direct URL flows remain supported. Existing fallback `main-register` behavior remains available for backward compatibility.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
