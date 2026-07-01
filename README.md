# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B007 Audit Log`
- Developer Panel version/build ปัจจุบัน: `0.12.54` / `2026.07.02.008`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Take Away ส่งเข้าครัวและ Cashier แล้ว
- Food Order ปิดครบแล้ว

## Retail POS Status

ทำแล้ว:

- P9-B001 POS Firestore Foundation
- P9-B002 Running Number
- P9-B003 Counter
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver
- P9-B005 Repository Layer
- P9-B006 Firestore Composite Index
- P9-B007 Audit Log
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Current Milestone

`P9-B007 Audit Log`

## Audit Log Service

- เพิ่ม `public/assets/js/retail-pos-audit-log.js`
- รองรับ `POS_AUDIT_ACTIONS` สำหรับ sale, sync, shift, refund, return, void และ stock
- รองรับ `buildAuditLogRow()` สำหรับสร้าง audit row พร้อม tenant metadata
- รองรับ `setAuditLogInTransaction()` สำหรับใช้ใน Firestore Transaction
- รองรับ `writeAuditLog()` สำหรับเขียน audit log แบบ async
- รองรับ `saleAuditSummary()` สำหรับสรุป sale ใน audit log

## Regression Tests

1. เปิด POS แล้วขาย Online ได้ตามเดิม
2. ตรวจ auditLogs ใน Firestore หลังขาย Online ต้องยังมีรายการ `pos_sale_completed` จาก flow เดิม
3. Audit row ต้องมี `tenantId`, `shopId`, `createdBy`, `action`, `entityId`
4. `buildAuditLogRow()` ต้องแจ้ง error ถ้าไม่มี action หรือ entityId
5. ตรวจว่าไม่กระทบ Offline Sync
6. ตรวจว่าไม่กระทบ Food Order / Delivery
7. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

1. P9-B008 Shift Opening / Closing
2. P9-B009 Refund / Return / Void
3. P9-B010 Performance (Cache / Virtual List / Search)

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
