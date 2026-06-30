# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B005.4 POS Receipt Loyalty Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.19` / `2026.06.30.085`

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

## Current Milestone

`P9-B005.4 POS Receipt Loyalty Fix`

## Regression Tests

1. เปิด `/pos/settings`
2. เปลี่ยนชื่อร้าน แล้วบันทึก ต้องเห็นชื่อร้านใหม่บนใบเสร็จ POS
3. เลือกขนาดใบเสร็จ 58mm / 80mm / A4 แล้วใบเสร็จต้องใช้ขนาดที่เลือก
4. เลือก `ถามก่อนพิมพ์` หลังบันทึกขายต้องเปิดใบเสร็จแต่ยังไม่เรียก print dialog อัตโนมัติ
5. เลือก `พิมพ์ทันที` หลังบันทึกขายต้องเรียก print dialog อัตโนมัติ
6. ถ้าเลือกลูกค้า ต้องแสดงชื่อ/รหัสสมาชิก/เบอร์โทรบนใบเสร็จ
7. ถ้ามีระบบแต้ม ต้องแสดงแต้มก่อนซื้อ/ใช้แต้ม/แต้มที่ได้รับ/แต้มคงเหลือในบิลทันที
8. Toast หรือ alert ต้องไม่แสดงบนหน้า print
9. sync ซ้ำต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

## Next Tasks

1. P9-B006 Firestore Composite Index
2. P9-B007 Audit Log
3. P9-B008 Shift Opening / Closing
4. P9-B009 Refund / Return / Void

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string เพื่อกัน browser cache
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
