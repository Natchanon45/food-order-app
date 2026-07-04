# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Hardening 002`
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
- Unified Order / Delivery / POS Menu
- Dashboard Tenant-safe Link Correction
- Dashboard Final Grouping
- POS Payment UX Update
- Retail Category/Product Sort Manager
- Product Image Storage Rules Fix
- POS Display Order Hard Rollback
- Admin Icon Theme Color Fix
- Admin Action Button Desktop/Mobile Polish
- Main Login UI Polish
- Public Landing Icon Polish
- Login User Circle Icon Polish
- Login Input Icon Color Polish
- Login Footer + Legal Pages Polish
- Public Landing Mobile Layout Polish
- Public Landing Pricing CTA Design
- Public Pricing Final Polish
- Login Copy + Version Size Polish
- Pricing Card Header Alignment Polish
- Support Email Badge Polish
- Legal Support Email Badge Polish
- Badge Row Responsive Polish
- Sales Report Icon Polish
- Sales Report Icon Hotfix
- Sales Report Back Label Polish
- Sales Report Back Icon Duplication Fix
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Sales Report Back Icon Duplication Fix

- แก้ปุ่ม `ย้อนกลับ` หน้า `/admin/sales-report` ไม่ให้แสดงลูกศรซ้ำ 2 อัน
- เพิ่ม class `.app-icon` ให้ icon ลูกศรเดิม เพื่อให้ `ui.js` ตรวจพบว่าเป็น icon ที่ decorate แล้วและไม่เติมซ้ำ
- ปรับ `sales-report.js` query string เป็น `v=20260704-004` เพื่อกัน browser cache หลังแก้ HTML ที่อ้างอิง JS
- แก้เฉพาะ UI ปุ่มย้อนกลับ ไม่แตะ logic รายงาน, การคำนวณ, Tenant, Firestore หรือ Stock Transaction

## Sales Report Back Label Polish

- ปรับปุ่มกลับหน้า `/admin/sales-report` จาก `กลับ` เป็น `ย้อนกลับ`
- เพิ่ม icon ลูกศรซ้ายให้ปุ่ม `ย้อนกลับ` โดยไม่ใช้ class `.bi` เพื่อไม่ชนกับ hotfix ที่กัน icon ซ้ำ
- แก้เฉพาะ UI ปุ่มย้อนกลับ ไม่แตะ logic รายงาน, การคำนวณ, Tenant, Firestore หรือ Stock Transaction

## Sales Report Icon Hotfix

- แก้ปุ่ม `กลับ` หน้า `/admin/sales-report` ไม่ให้แสดง icon ซ้ำ
- แก้หัวข้อกราฟให้มี icon ตลอด แม้ `sales-report.js` จะเปลี่ยนข้อความตามช่วงรายงาน
- ปรับ `sales-report.js` query string เป็น `v=20260704-002` เพื่อกัน browser cache หลังแก้ JS
- แก้เฉพาะ UI icon ของรายงานยอดขาย ไม่แตะ logic รายงาน, การคำนวณ, Tenant, Firestore หรือ Stock Transaction

## Next Tasks

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- ทดสอบการ apply ลำดับสินค้าใน `/pos` แบบปลอดภัยก่อนเปิดใช้อีกครั้ง
- แยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
firebase deploy --only storage
```