# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B004 Offline Queue Worker + Retry + Conflict Resolver`
- Developer Panel version/build ปัจจุบัน: `0.12.50` / `2026.07.02.004`

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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline
- Offline Sync ใช้ Counter Service กลางจาก P9-B003

## Current Milestone

`P9-B004 Offline Queue Worker + Retry + Conflict Resolver`

## Offline Queue Worker

- `retail-offline-sale-sync.js` ใช้ `reserveRunningNumber()` จาก `retail-pos-counter.js`
- Offline Sale ยังใช้เลข PENDING ตอนไม่มีอินเทอร์เน็ต
- เมื่อกลับมา Online จะ Sync อัตโนมัติและจองเลขจริงจาก Counter Service
- Retry ใช้ backoff ตามจำนวนครั้งที่ล้มเหลว
- Conflict แยกประเภท เช่น tenant mismatch, stock ไม่พอ, product not found, invalid qty
- มี event `retail-offline-queue-worker` สำหรับอ่าน state ล่าสุด
- มี helper `getOfflineQueueWorkerSnapshot()` สำหรับโมดูลถัดไปใช้แสดงสถานะ

## Regression Tests

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

## Next Tasks

1. P9-B005 Repository Layer
2. P9-B006 Firestore Composite Index
3. P9-B007 Audit Log
4. P9-B008 Shift Opening / Closing
5. P9-B009 Refund / Return / Void
6. P9-B010 Performance (Cache / Virtual List / Search)

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
