# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string กัน browser cache
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.20`
- Build: `2026.06.30.086`
- Branch: `feature/retail-pos`
- Milestone: `P9-B006 Firestore Composite Index`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation P9-B001 เสร็จ
- P9-B002 Running Number เสร็จ
- P9-B002.1 Firestore Rules for Running Number เสร็จ
- P9-B002.2 POS Auth Warning Cleanup เสร็จ
- P9-B003 Counter เสร็จ
- P9-B003.1 POS Menu Open Fix เสร็จ
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จ
- P9-B004.1 POS Menu Spacing เสร็จ
- P9-B005 Repository Layer เสร็จเบื้องต้น
- P9-B005.1 POS Receipt Print Fix เสร็จ
- P9-B005.2 POS Receipt Data Hydration & Print Cleanup เสร็จ
- P9-B005.3 POS Receipt Settings Restore & Loyalty Calculation Fix เสร็จ
- P9-B005.4 POS Receipt Loyalty Fix เสร็จ
- P9-B006 Firestore Composite Index เสร็จ

## รายละเอียด P9-B006

เพิ่ม Firestore composite indexes สำหรับ Retail POS collections ที่ใช้ query แบบ filter + sort และเตรียมรองรับรายงาน/ประวัติ/queue ใน Milestone ถัดไป

แก้แล้ว:

- เพิ่ม indexes สำหรับ `sales`: status/dateKey/monthKey/customerId/paymentMethod + createdAt และ syncStatus + updatedAt
- เพิ่ม indexes สำหรับ `saleItems`: saleId/productId/dateKey + createdAt
- เพิ่ม indexes สำหรับ `stockMovements`: productId/dateKey/referenceId + createdAt
- เพิ่ม index สำหรับ `syncQueue`: syncStatus + updatedAt
- เพิ่ม index สำหรับ `loyaltyLedger`: customerId + createdAt
- เพิ่ม indexes สำหรับ `shifts`: status + updatedAt และ createdBy + status + updatedAt
- คง index เดิมของ `orders` ไว้

## Current Milestone

`P9-B006 Firestore Composite Index`

## Regression Tests สำคัญ

1. `firestore.indexes.json` ต้องเป็น JSON valid
2. `firebase.json` ต้องยังอ้าง `firestore.indexes.json`
3. เปิด `/pos` แล้วขายได้ตามเดิม
4. เปิด `/pos/sales` แล้วโหลด sales ด้วย `createdAt desc` ได้ตามเดิม
5. Deploy indexes ด้วย `firebase deploy --only firestore:indexes`
6. Hosting deploy เดิมยังใช้ `firebase deploy --only hosting`
7. Firestore rules เดิมไม่ถูกแก้
8. sync ซ้ำต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

## งานถัดไป

1. P9-B007 Audit Log
2. P9-B008 Shift Opening / Closing
3. P9-B009 Refund / Return / Void
4. P9-B010 Performance

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable `saleId` เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
