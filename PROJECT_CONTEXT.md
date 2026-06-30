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

- Version: `0.12.13`
- Build: `2026.06.30.079`
- Branch: `feature/retail-pos`
- Milestone: `P9-B004 Offline Queue Worker + Retry + Conflict Resolver`

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

## รายละเอียด P9-B004

แก้จากไฟล์จริง `retail-offline-sale-sync.js` และ `retail-pos-sync-status.js`

ทำแล้ว:

- เพิ่ม `OfflineQueueWorker` สำหรับ sync queue อัตโนมัติ
- เพิ่ม retry delay/backoff สำหรับรายการ `failed`
- เพิ่ม stale syncing recovery เพื่อ retry รายการที่ค้าง `syncing`
- เพิ่ม conflict metadata เช่น `conflictType`, `conflictResolution`
- เพิ่ม helper `getOfflineSyncQueue()`, `retryFailedOfflineSales()`, `resolveOfflineSaleConflict()`
- ปุ่ม Sync manual จะ retry รายการ failed ได้
- `/pos/index.html` bump cache เป็น `retail-offline-sale-sync.js?v=20260630-079` และ `retail-pos-sync-status.js?v=20260630-079`

## Current Milestone

`P9-B004 Offline Queue Worker + Retry + Conflict Resolver`

## Regression Tests สำคัญ

1. ขาย offline 1 บิล แล้วสถานะต้องเป็น `pending`
2. ต่อเน็ตแล้ว worker ต้อง sync อัตโนมัติ
3. ถ้า sync fail ต้องเป็น `failed` พร้อม `nextRetryAt`
4. เมื่อถึงเวลา retry ต้องกลับไป sync ใหม่ได้
5. ถ้า conflict เช่น stock ไม่พอ ต้องเป็น `conflict` พร้อม `conflictType`
6. กดปุ่ม Sync ต้อง retry รายการ failed ได้
7. sync สำเร็จแล้วต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

## งานถัดไป

1. P9-B005 Repository Layer
2. P9-B006 Firestore Composite Index
3. P9-B007 Audit Log
4. P9-B008 Shift Opening / Closing
5. P9-B009 Refund / Return / Void

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable `saleId` เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
