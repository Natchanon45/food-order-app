# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.41
Build: 2026.07.06.061
Milestone: P9-B005 CustomerDisplay Mobile Header Polish

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Current Customer Display rule: POS machines publish Customer Display snapshots to `customerDisplays/{displayId}`. Each POS has local `retail_pos_register_config` with `registerId` and `displayId`, and each display snapshot includes `tenantId`, `registerId`, `displayId`, `sessionId`, `status`, `items`, totals, and `updatedAt`. `/pos/customer-display?displayId=display-pc-01` watches only the matching display document and shows a compact hover/focus QR Pairing control in the top header.

Mobile Customer Display layout rule: on narrow screens the header uses a two-column responsive grid so the FOD badge/title and connection status stay on the left while the compact QR pairing trigger stays aligned on the right. The compact QR uses the exact Bootstrap icon markup `<i class="bi bi-qr-code"></i>` with `เชื่อมอุปกรณ์`; hovering or focusing the control reveals the full QR panel for pairing the selling device.

Completed in this build: Customer Display mobile header polish.

Next task: continue P9-B005 repository integration, then move to P9-B006 Firestore Composite Index.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
