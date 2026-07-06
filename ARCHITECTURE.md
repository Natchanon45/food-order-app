# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.34
Build: 2026.07.06.054
Milestone: P9-B005 Repository Layer and POS UX Hotfix

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Current Customer Display rule: `/pos/customer-display` sorts displayed cart items by latest add/update activity. When an existing item is added again and only quantity changes, that item moves to the top of the Customer Display list. This is display-only ordering and must not alter POS cart totals, sale totals, stock deduction, or receipt logic.

Completed in this build: Customer Display latest-item ordering hotfix.

Next task: continue P9-B005 repository integration, then move to P9-B006 Firestore Composite Index.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
