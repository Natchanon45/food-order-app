# Food Order App — Project Context

Repository: Natchanon45/food-order-app
Branch: feature/retail-pos
Version: 0.12.94
Build: 2026.07.06.014
Milestone: POS Sales Table + Receipt + Loyalty Fix

Change: fixed Sales History rows to render all VAT columns directly from the main retail-sales.js renderer, bumped Sales JS/CSS cache, hid receipt header icons via receipt CSS rules, forced the POS loyalty points box to stay directly below the member/customer selector, and added a Customer Display button linking to /pos/customer-display from the POS header.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
