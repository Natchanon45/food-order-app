# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: POS Receipt Customer Display Polish
Version: 0.12.95
Build: 2026.07.06.015

Change: moved the Customer Display shortcut visually to the left of the menu button, strengthened the receipt enhancement helper to show short tax invoice title, VAT rows, customer information, and loyalty points, added a placement guard to keep the loyalty box directly below the member/customer selector, removed the customer-display footer instruction text, and changed the paid message to “ขอบคุณที่ใช้บริการ”.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
