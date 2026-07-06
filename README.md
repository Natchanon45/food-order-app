# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 CustomerDisplay Compact QR Pairing
Version: 0.13.37
Build: 2026.07.06.057

Change: moved the Customer Display QR Pairing UI into a compact top-header control. The PC customer display now shows a small QR/iPhone button near the top of the page; clicking it expands a QR panel similar to streaming-device pairing patterns such as WeTV/Viu. Scanning the expanded QR on iPhone opens POS with the matching displayId.

The previous Multi Register and direct URL flows remain supported. Existing fallback `main-register` behavior remains available for backward compatibility.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
