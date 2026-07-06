# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 CustomerDisplay QR Helper Text Removal
Version: 0.13.40
Build: 2026.07.06.060

Change: removed the `Hover เพื่อแสดง QR` helper text from the Customer Display compact QR Pairing trigger. The trigger now shows only the exact Bootstrap QR icon `<i class="bi bi-qr-code"></i>` and the Thai label `เชื่อมอุปกรณ์`, while the full QR panel remains hover/focus-only.

The previous Multi Register and direct URL flows remain supported. Existing fallback `main-register` behavior remains available for backward compatibility.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
