# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 CustomerDisplay QR Pairing
Version: 0.13.36
Build: 2026.07.06.056

Change: added QR Pairing for the PC-as-Customer-Display and iPhone-as-POS workflow. `/pos/customer-display?displayId=display-pc-01` now shows a pairing card with a QR code. Scanning it on iPhone opens `/pos?registerId=iphone-01&displayId=display-pc-01`, allowing the iPhone to sell and scan while the PC shows the customer display for that displayId.

The previous Multi Register flow remains supported. Existing direct URLs still work, and the fallback `main-register` display remains available for backward compatibility.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
