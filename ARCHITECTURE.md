# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.40
Build: 2026.07.06.060
Milestone: P9-B005 CustomerDisplay QR Helper Text Removal

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Current Customer Display rule: POS machines publish Customer Display snapshots to `customerDisplays/{displayId}`. Each POS has local `retail_pos_register_config` with `registerId` and `displayId`, and each display snapshot includes `tenantId`, `registerId`, `displayId`, `sessionId`, `status`, `items`, totals, and `updatedAt`. `/pos/customer-display?displayId=display-pc-01` watches only the matching display document and shows a compact hover/focus QR Pairing control in the top header.

Compact QR Pairing workflow: the PC opens `/pos/customer-display?displayId=display-pc-01`; the header shows a small exact Bootstrap icon markup `<i class="bi bi-qr-code"></i>` with only `เชื่อมอุปกรณ์`; hovering or focusing the control reveals the full QR panel for `/pos?registerId=iphone-01&displayId=display-pc-01`; the selling device scans that QR, opens POS, stores the display config through the existing Multi Register flow, and publishes sales back to `customerDisplays/display-pc-01`.

Completed in this build: removed QR helper text from the compact Customer Display pairing trigger.

Next task: continue P9-B005 repository integration, then move to P9-B006 Firestore Composite Index.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
