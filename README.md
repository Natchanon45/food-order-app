# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Unified Login Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.70` / `2026.07.02.024`

## Retail POS Status

ทำแล้ว:

- P9-B001 POS Firestore Foundation
- P9-B002 Running Number
- P9-B003 Counter
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver
- P9-B005 Repository Layer
- P9-B006 Firestore Composite Index
- P9-B007 Audit Log
- P9-B008 Shift Opening / Closing
- P9-B009 Refund / Return / Void
- P9-B010 Performance
- Public Registration Phase 2
- Cashier Access Fix
- Unified Login Fix
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Unified Login Fix

- ใช้ `/login` เป็นหน้าเข้าสู่ระบบหลัก
- เคลียร์ POS session เก่าก่อนเข้าสู่ระบบใหม่
- รองรับการเข้า POS ผ่าน `/login?next=/pos/` โดยไม่ต้องเข้าสู่ระบบซ้ำ
- `/pos/login` ไม่แสดงฟอร์มเดิมแล้ว
- ปิด autocomplete ของฟอร์ม login
- ไม่แตะ logic ขาย สต็อก sync หรือ transaction

## Previous Fixes

- Cashier Access Fix
- Public Registration Phase 2
- Register Slug Pattern Hotfix
- Signup Email Verification Hotfix
- Business Unit Staff Filter Fix
- POS User Visibility Fixes

## Next Tasks

- POS Hardening 003
- ทดสอบการ apply ลำดับสินค้าใน `/pos`
- Package Selection Phase 3

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```