# Food Order / Delivery / Retail POS

Branch: feature/retail-pos
Milestone: P9-B005 Repository Layer
Version: 0.13.23
Build: 2026.07.06.043

Change: extended the Retail POS repository layer as the central access point for tenant document refs and local POS data. Added repository helpers for tenant-scoped collection/doc refs, local value storage for active shift and store settings, local customers/settings repositories, and local product/stock movement helpers while preserving offline sale queue behavior.

Deploy: git pull --rebase origin feature/retail-pos && firebase deploy --only hosting
