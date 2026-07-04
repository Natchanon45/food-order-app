# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Public Registration Phase 1`
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
- Hotfix Manual Sync
- POS Hardening 001
- POS Hardening 002
- Business Unit Staff Filter Fix
- Public Trial Signup Phase 1
- Signup Email Verification Hotfix
- Register Existing Auth Email + Layout Hotfix
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Register Existing Auth Email + Layout Hotfix

- ถ้าอีเมลสมัครมีอยู่ใน Firebase Authentication แล้ว ระบบจะลอง sign in ด้วยรหัสที่กรอกและไปต่อ flow ยืนยันอีเมล
- ถ้า sign in ไม่สำเร็จ จะแจ้งว่าต้องลบ user จาก Firebase Authentication Users หรือใช้รหัสเดิมให้ถูกต้อง
- ปรับหน้า `/register/` ให้กว้างขึ้น อ่านง่ายขึ้น ช่องอีเมลเต็มแถว และลดความแน่นของการ์ดแพ็กเกจ
- bump `/register/` script เป็น `public-register.js?v=20260704-003`

## Signup Email Verification Hotfix

- ปรับ `/register/` ให้ส่ง email verification ก่อนบันทึก pending signup
- เพิ่มข้อความ error เฉพาะกรณีส่งอีเมลยืนยันไม่สำเร็จ
- ปุ่มส่งอีเมลอีกครั้ง reload สถานะ user และแจ้งให้ตรวจ Inbox / Spam / Junk

## Public Trial Signup Phase 1

- เพิ่มหน้า `/register/` สำหรับสมัครร้านใหม่
- เพิ่ม Cloud Functions สำหรับบันทึกคำขอสมัครและ activate tenant หลังยืนยันอีเมล
- Premium trial ถูกตั้งเป็นแผนเริ่มต้น 30 วัน
- ระบบสร้าง tenant, owner profile, membership, store settings, POS settings และ subscription settings หลัง verify สำเร็จ
- เพิ่ม Firebase Auth helpers สำหรับ email verification ใน frontend
- ปุ่ม `ลงทะเบียน` หน้าแรกยังต้อง patch ต่อ เพราะไฟล์ landing เดิมเป็น one-line HTML และ GitHub block การอัปเดตไฟล์นั้นในรอบนี้

## Previous Fixes

- Business Unit Staff Filter Fix
- Restaurant Staff Role Function Fix
- Admin Staff Callable Hotfix
- POS User Visibility Fixes
- Login Home Link
- Sales Report Back Icon Duplication Fix

## Next Tasks

- Patch public landing `ลงทะเบียน` CTA to `/register/`
- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- ทดสอบการ apply ลำดับสินค้าใน `/pos` แบบปลอดภัยก่อนเปิดใช้อีกครั้ง

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```