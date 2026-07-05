# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.96
Build: 2026.07.06.016
Milestone: POS Loyalty Order + Sales Receipt VAT Fix

Change: fixed PC payment dialog loyalty placement by adding an explicit flex-order stylesheet so the loyalty box stays directly below the member/customer selector. Added a direct Sales receipt enhancer for /pos/sales to display short tax invoice title, VAT rows, customer information, and loyalty points without relying on the POS receipt renderer.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
