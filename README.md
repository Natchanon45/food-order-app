# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Cashier Access Fix`
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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Cashier Access Fix

- แยกสิทธิ์ cashier ร้านอาหารออกจาก cashier Retail POS ด้วย business unit/module
- หน้าแรกซ่อน Retail POS card สำหรับ cashier ร้านอาหาร
- `/pos` ใช้ guard แบบตรวจ module เพิ่ม
- `/pos/login` ไม่รับบัญชี cashier ร้านอาหาร
- ไม่แตะ logic ขาย, สต็อก, sync หรือ transaction

## Public Registration Phase 2

- เปิดใช้งานปุ่ม `ลงทะเบียน` หน้าแรกให้ลิงก์ไป `/register/`
- เปลี่ยน note หน้าแรกให้สื่อว่า Premium Trial สมัครใช้งานจริงหลังยืนยันอีเมล

## Previous Fixes

- Register Slug Pattern Hotfix
- Register Existing Auth Email + Layout Hotfix
- Signup Email Verification Hotfix
- Business Unit Staff Filter Fix
- Restaurant Staff Role Function Fix
- Admin Staff Callable Hotfix
- POS User Visibility Fixes
- Login Home Link
- Sales Report Back Icon Duplication Fix

## Next Tasks

- POS Hardening 003
- ทดสอบการ apply ลำดับสินค้าใน `/pos` แบบปลอดภัยก่อนเปิดใช้อีกครั้ง
- Package Selection Phase 3 หากต้องเปิดเลือก Free/Pro/Premium จริงในอนาคต

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```