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

- Version: `0.12.50`
- Build: `2026.07.02.004`
- Branch: `feature/retail-pos`
- Milestone: `P9-B004 Offline Queue Worker + Retry + Conflict Resolver`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation (P9-B001) เสร็จแล้ว
- P9-B002 Running Number เสร็จแล้ว
- P9-B003 Counter service กลางเสร็จแล้ว
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จแล้ว
- Offline Sync ใช้ Counter Service กลาง และยังรักษา Stable `saleId`
- Retry/Conflict ไม่ตัด Stock ซ้ำ เพราะตรวจ existing sale จาก `saleId` ก่อนเสมอ

## Current Milestone

`P9-B004 Offline Queue Worker + Retry + Conflict Resolver`

## แก้แล้วรอบนี้

- ปรับ `retail-offline-sale-sync.js` ให้ใช้ `reserveRunningNumber()` จาก `retail-pos-counter.js`
- ย้ายการจองเลขจริงของ Offline Sync ให้ใช้ Counter Service กลางจาก P9-B003
- คงกติกา Firestore Transaction: อ่าน sale / summary / product ก่อน แล้วจอง counter และ write หลังจากอ่านครบ
- เพิ่ม Worker state snapshot และ event `retail-offline-queue-worker`
- เพิ่ม state: `scheduled`, `syncing`, `failed`, `conflict`, `offline`, `retry_queued`, `conflict_retry_queued`, `conflict_discarded`
- เพิ่ม `getOfflineQueueWorkerSnapshot()` สำหรับหน้าจอ/โมดูลถัดไปนำไปแสดงสถานะได้
- ปรับ `retryFailedOfflineSales()` และ `resolveOfflineSaleConflict()` ให้ส่ง state metadata หลัง retry/discard
- `/pos/index.html` bump `retail-offline-sale-sync.js?v=20260702-004`
- Developer Panel เป็น Version `0.12.50` Build `2026.07.02.004`

## Regression Tests สำคัญ

1. เปิด POS แล้วขาย Online 1 บิล ต้องบันทึกและตัด Stock ได้ตามเดิม
2. ปิดเน็ตแล้วขาย Offline 1 บิล ต้องบันทึกในเครื่องและแสดงเลข PENDING
3. เปิดเน็ตแล้ว Offline Queue Worker ต้อง Sync อัตโนมัติ
4. บิล Offline หลัง Sync ต้องได้เลขจริงจาก Counter Service เช่น `POS-YYYYMMDD-xxxxx`
5. Retry บิลเดิมซ้ำ ต้องไม่สร้าง sale ซ้ำ และไม่ตัด Stock ซ้ำ
6. ถ้า Stock ไม่พอหลัง Offline ต้องขึ้น `syncStatus: conflict` และ `conflictType: insufficient_stock`
7. เรียก retry conflict ต้องกลับเป็น `pending`
8. เรียก discard conflict ต้องเป็น `discarded`
9. ตรวจ event `retail-offline-queue-worker` ต้องมี state ล่าสุด
10. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

1. P9-B005 Repository Layer
2. P9-B006 Firestore Composite Index
3. P9-B007 Audit Log
4. P9-B008 Shift Opening / Closing
5. P9-B009 Refund / Return / Void
6. P9-B010 Performance (Cache / Virtual List / Search)

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
