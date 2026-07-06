# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 CustomerDisplay MultiRegister
Version: 0.13.35
Build: 2026.07.06.055

Change: added backward-compatible Multi Register support for Customer Display. POS now uses local `retail_pos_register_config` with `registerId`, `displayId`, and `sessionId` and publishes snapshots to `customerDisplays/{displayId}`. `/pos/customer-display?displayId=display-01` now watches only that display document. If no displayId is provided, the system falls back to `main-register` so existing deployments continue working.

Usage examples: open POS with `/pos?registerId=pos-01&displayId=display-01`, then open Customer Display with `/pos/customer-display?displayId=display-01`. To sell on POS A but show on display B, set POS A to `/pos?registerId=pos-01&displayId=display-02` and open `/pos/customer-display?displayId=display-02` on display B.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
