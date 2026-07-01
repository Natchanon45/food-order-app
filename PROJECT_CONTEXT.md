# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Take Away + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.54`
- Build: `2026.07.02.008`
- Branch: `feature/retail-pos`
- Milestone: `P9-B007 Audit Log`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation (P9-B001) เสร็จแล้ว
- P9-B002 Running Number เสร็จแล้ว
- P9-B003 Counter service กลางเสร็จแล้ว
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จแล้ว
- P9-B005 Repository Layer เสร็จแล้ว
- P9-B006 Firestore Composite Index เสร็จแล้ว
- P9-B007 Audit Log เสร็จแล้ว

## Current Milestone

`P9-B007 Audit Log`

## แก้แล้วรอบนี้

- เพิ่ม `retail-pos-audit-log.js` เป็น Audit Log Service กลางของ POS
- เพิ่ม `POS_AUDIT_ACTIONS` สำหรับ sale / sync / shift / refund / return / void / stock
- เพิ่ม `buildAuditLogRow()` สำหรับสร้าง audit row พร้อม tenant metadata
- เพิ่ม `setAuditLogInTransaction()` สำหรับเขียน audit log ใน Firestore Transaction
- เพิ่ม `writeAuditLog()` สำหรับเขียน audit log แบบ async ทั่วไป
- เพิ่ม `saleAuditSummary()` สำหรับสรุปข้อมูล sale ที่ใช้ใน audit log
- เตรียมฐานให้ P9-B008 Shift Opening / Closing และ P9-B009 Refund / Return / Void
- Developer Panel เป็น Version `0.12.54` Build `2026.07.02.008`

## Regression Tests สำคัญ

1. เปิด POS แล้วขาย Online ได้ตามเดิม
2. ตรวจ auditLogs ใน Firestore หลังขาย Online ต้องยังมีรายการ `pos_sale_completed` จาก flow เดิม
3. เปิด Console แล้ว import/use Audit Service ต้องสร้าง row ที่มี `tenantId`, `shopId`, `createdBy`, `action`, `entityId`
4. `buildAuditLogRow()` ต้อง throw ถ้าไม่มี action หรือ entityId
5. `setAuditLogInTransaction()` ต้องใช้ได้ใน transaction ของโมดูลถัดไป
6. ตรวจว่าไม่กระทบ Offline Sync
7. ตรวจว่าไม่กระทบ Food Order / Delivery
8. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

1. P9-B008 Shift Opening / Closing
2. P9-B009 Refund / Return / Void
3. P9-B010 Performance (Cache / Virtual List / Search)

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
