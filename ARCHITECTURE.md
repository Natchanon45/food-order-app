# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.32
Build: 2026.07.06.052
Milestone: P9-B005 Repository Layer and POS UX Hotfix

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Current UX rule: the local TH Sarabun PSK font override is scoped to `/pos/customer-display` only. The main POS page must not load this override. Customer Display uses the local font files and enlarges text to about 2x the previous display size.

Completed in this build: customer-display-only TH Sarabun PSK font hotfix.

Next task: continue P9-B005 repository integration, then move to P9-B006 Firestore Composite Index.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
