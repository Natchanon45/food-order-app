# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B007 Audit Log`
- Developer Panel version/build ปัจจุบัน: `0.12.21` / `2026.06.30.087`

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
- เพิ่ม audit log สำหรับการขาย POS ที่บันทึกสำเร็จบน Firestore

## Current Milestone

`P9-B007 Audit Log`

## Regression Tests

1. เปิด `/pos` แล้วขาย online 1 บิล
2. Firestore ต้องมี sale document ตาม stable `saleId`
3. Firestore ต้องมี audit log ใน `tenants/{tenantId}/auditLogs/{pos_sale_completed_saleId}`
4. Audit log ต้องมี `tenantId`, `shopId`, `deviceId`, `createdBy`, `action`, `entityType`, `entityId`, `entityNumber`
5. Audit log summary ต้องมี saleNumber, totalAmount, totalQty, paymentMethod, customerId, shiftId, syncStatus
6. ขายซ้ำด้วย saleId เดิมต้องไม่สร้าง audit log ซ้ำ เพราะใช้ deterministic audit id
7. Offline sale ต้องยัง fallback ได้และไม่ทำให้ sync/duplicate protection เสีย
8. Firestore transaction ยัง read เอกสารทั้งหมดก่อน write
9. ถ้าแก้ JS ที่ import ใน HTML ต้อง bump cache แล้ว

## Next Tasks

1. P9-B008 Shift Opening / Closing
2. P9-B009 Refund / Return / Void
3. P9-B010 Performance

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
