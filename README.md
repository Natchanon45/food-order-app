# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B006 Firestore Composite Index`
- Developer Panel version/build ปัจจุบัน: `0.12.20` / `2026.06.30.086`

## Retail POS Status

ทำแล้ว:

- POS รองรับ online/offline/sync/tenant
- ใช้ stable `saleId` เดียวกันทั้ง online/offline
- กัน duplicate ด้วย sale document id
- กันตัด stock ซ้ำด้วย deterministic stock movement id
- เพิ่ม Running Number `POS-YYYYMMDD-00001`
- เพิ่ม Repository Layer เบื้องต้น `retail-pos-repository.js`
- แก้เมนู POS เปิดได้และปรับระยะห่าง PC/Mobile แล้ว
- เพิ่ม OfflineQueueWorker สำหรับ retry อัตโนมัติ
- โหลด `retail-pos-receipt-modal.js` ในหน้า `/pos`
- เปิดใบเสร็จหลังบันทึกการขายสำเร็จ
- แก้ print CSS root ของ receipt modal เพื่อให้ fallback print ไม่ว่าง
- ดึงข้อมูลร้าน/ตั้งค่าใบเสร็จมาแสดงบนใบเสร็จ POS โดยใช้ local settings เป็นค่าหลัก
- แสดงข้อมูลลูกค้า/สมาชิกและแต้มสะสมบนใบเสร็จ POS
- ซ่อน toast/alert/notification ระหว่างพิมพ์ใบเสร็จ POS
- กู้ตัวเลือกขนาดใบเสร็จ 58mm / 80mm / A4
- กู้ตัวเลือกถามก่อนพิมพ์ / พิมพ์ทันที
- แก้ให้ใบเสร็จคำนวณแต้มจากลูกค้าที่เลือกได้ทันที แม้ sale customer patch จะยังไม่เสร็จ
- เพิ่ม Firestore composite indexes สำหรับ Retail POS collections

## Current Milestone

`P9-B006 Firestore Composite Index`

## Regression Tests

1. เปิด `/pos` แล้วโหลดรายการสินค้า/ขายได้ตามเดิม
2. เปิด `/pos/sales` แล้วโหลด sales ด้วย `createdAt desc` ได้ตามเดิม
3. Query รายงาน sales ด้วย `status/dateKey/monthKey/customerId/paymentMethod + createdAt` ต้องมี index รองรับ
4. Query saleItems ด้วย `saleId/productId/dateKey + createdAt` ต้องมี index รองรับ
5. Query stockMovements ด้วย `productId/dateKey/referenceId + createdAt` ต้องมี index รองรับ
6. Query syncQueue ด้วย `syncStatus + updatedAt` ต้องมี index รองรับ
7. Query loyaltyLedger ด้วย `customerId + createdAt` ต้องมี index รองรับ
8. Query shifts ด้วย `status/createdBy + updatedAt` ต้องมี index รองรับ
9. Deploy indexes ต้องไม่กระทบ hosting และ Firestore rules เดิม

## Next Tasks

1. P9-B007 Audit Log
2. P9-B008 Shift Opening / Closing
3. P9-B009 Refund / Return / Void
4. P9-B010 Performance

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
firebase deploy --only firestore:indexes

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string เพื่อกัน browser cache
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
