# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 CustomerDisplay Hover QR Pairing
Version: 0.13.38
Build: 2026.07.06.058

Change: refined the Customer Display compact QR Pairing UI. The compact top control now uses a Bootstrap `bi-qr-code` icon instead of a miniature QR image, changes iPhone wording to the generic Thai label `อุปกรณ์`, and shows the full QR panel only on hover/focus instead of opening immediately after page load.

The previous Multi Register and direct URL flows remain supported. Existing fallback `main-register` behavior remains available for backward compatibility.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
