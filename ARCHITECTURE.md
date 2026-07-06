# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.35
Build: 2026.07.06.055
Milestone: P9-B005 CustomerDisplay MultiRegister

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Current Customer Display rule: POS machines publish Customer Display snapshots to `customerDisplays/{displayId}`. Each POS has local `retail_pos_register_config` with `registerId` and `displayId`, and each display snapshot includes `tenantId`, `registerId`, `displayId`, `sessionId`, `status`, `items`, totals, and `updatedAt`. `/pos/customer-display?displayId=display-01` watches only the matching display document. If no displayId is provided, the system falls back to `main-register` for backward compatibility.

Usage examples: `/pos?registerId=pos-01&displayId=display-01` publishes to `customerDisplays/display-01`; `/pos/customer-display?displayId=display-01` watches that document. To sell on POS A and show on display B, configure POS A with `displayId=display-02` and open display B with `/pos/customer-display?displayId=display-02`.

Completed in this build: Customer Display Multi Register support.

Next task: continue P9-B005 repository integration, then move to P9-B006 Firestore Composite Index.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
