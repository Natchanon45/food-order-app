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

- Version: `0.12.53`
- Build: `2026.07.02.007`
- Branch: `feature/retail-pos`
- Milestone: `P9-B006 Firestore Composite Index`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation (P9-B001) เสร็จแล้ว
- P9-B002 Running Number เสร็จแล้ว
- P9-B003 Counter service กลางเสร็จแล้ว
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จแล้ว
- P9-B005 Repository Layer เสร็จแล้ว
- P9-B006 Firestore Composite Index เสร็จแล้ว

## Current Milestone

`P9-B006 Firestore Composite Index`

## แก้แล้วรอบนี้

- อัปเดต `firestore.indexes.json`
- เพิ่ม index สำหรับ sales: channel/date/month/cashier/shift/reporting
- เพิ่ม index สำหรับ stockMovements: product/date/reference
- เพิ่ม index สำหรับ syncQueue: channel + syncStatus + updatedAt
- เพิ่ม index สำหรับ auditLogs: entityId/action/createdBy + createdAt
- เพิ่ม index สำหรับ returns: saleId/createdBy/status + createdAt
- เตรียมฐานให้ P9-B007 Audit Log, P9-B008 Shift, P9-B009 Refund และ P9-B010 Performance
- Developer Panel เป็น Version `0.12.53` Build `2026.07.02.007`

## Regression Tests สำคัญ

1. Deploy indexes แล้วรอ Firebase สร้าง index สำเร็จ
2. เปิด POS แล้วขาย Online ได้ตามเดิม
3. เปิดรายงานยอดขายรายวัน/รายเดือนต้องไม่ขึ้น error ต้องสร้าง index
4. ค้นหาข้อมูล sales ตาม cashier/shift/date ต้องพร้อมรองรับ
5. ตรวจ stock movements ตาม product/date/reference ต้องพร้อมรองรับ
6. ตรวจ syncQueue ตาม status ต้องพร้อมรองรับ
7. ตรวจ auditLogs ตาม action/entity/createdBy ต้องพร้อมรองรับ
8. ตรวจ returns ตาม sale/status/user ต้องพร้อมรองรับ
9. ตรวจว่าไม่กระทบ Food Order / Delivery
10. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

1. P9-B007 Audit Log
2. P9-B008 Shift Opening / Closing
3. P9-B009 Refund / Return / Void
4. P9-B010 Performance (Cache / Virtual List / Search)

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
