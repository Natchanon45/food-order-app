# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B005.2 POS Receipt Data Hydration & Print Cleanup`
- Developer Panel version/build ปัจจุบัน: `0.12.17` / `2026.06.30.083`

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
- เปิดและสั่งพิมพ์ใบเสร็จหลังบันทึกการขายสำเร็จ
- แก้ print CSS root ของ receipt modal เพื่อให้ fallback print ไม่ว่าง
- ดึงข้อมูลร้าน/ตั้งค่าใบเสร็จมาแสดงบนใบเสร็จ POS
- แสดงข้อมูลลูกค้า/สมาชิกและแต้มสะสมบนใบเสร็จ POS
- ซ่อน toast/alert/notification ระหว่างพิมพ์ใบเสร็จ POS

## Current Milestone

`P9-B005.2 POS Receipt Data Hydration & Print Cleanup`

## Regression Tests

1. เปิด `/pos`
2. ขายสินค้า online 1 บิล
3. หลังบันทึกสำเร็จ ต้องเปิดใบเสร็จและเรียก print dialog
4. หัวบิลต้องใช้ข้อมูลร้านจาก settings `store`/`receipt` หรือ fallback จาก localStorage
5. ถ้าเลือกลูกค้า ต้องแสดงชื่อ/รหัสสมาชิก/เบอร์โทรบนใบเสร็จ
6. ถ้ามี loyalty ต้องแสดงแต้มก่อนซื้อ/ใช้แต้ม/แต้มที่ได้รับ/แต้มคงเหลือ
7. ท้ายบิลต้องใช้ข้อความขอบคุณและ footer จาก receipt settings
8. Toast หรือ alert ต้องไม่แสดงบนหน้า print
9. ขาย offline 1 บิล ต้องยังเปิดใบเสร็จและใช้ข้อมูล snapshot/fallback ได้
10. sync ซ้ำต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

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
