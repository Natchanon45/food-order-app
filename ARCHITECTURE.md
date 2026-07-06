# Food Order App Architecture

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.13.30
Build: 2026.07.06.050
Milestone: P9-B005 Repository Layer and POS UX Hotfix

Core rules remain unchanged. All business data must include tenantId. Retail POS must work online and offline. Offline sales must sync back to Firestore. Duplicate bills are not allowed. Stock must not be deducted twice. The same stable saleId must be used for local sale and Firestore sync. Firestore transactions must read required documents before writes. HTML asset query versions must be bumped when referenced JS or CSS changes.

Current UX rule: the customer display shortcut in the POS header is an icon-only button. It uses Bootstrap Icons display markup, a black button background, and a dark green display icon. The button keeps accessible label and title text and still opens the customer display page.

Completed in this build: customer display Bootstrap display icon hotfix.

Next task: continue P9-B005 repository integration, then move to P9-B006 Firestore Composite Index.

Deploy commands:
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
