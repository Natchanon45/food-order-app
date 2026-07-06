# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 CustomerDisplay Mobile Header Polish
Version: 0.13.41
Build: 2026.07.06.061

Change: polished the Customer Display mobile header layout. On narrow screens, the header now uses a two-column responsive grid so the FOD badge/title, connection status, and compact QR pairing trigger no longer crowd each other. The QR trigger remains compact with the exact Bootstrap QR icon and the full QR panel remains hover/focus-only.

The previous Multi Register and direct URL flows remain supported. Existing fallback `main-register` behavior remains available for backward compatibility.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
