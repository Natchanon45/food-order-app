# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B005 Repository Layer`
- Developer Panel version/build ปัจจุบัน: `0.12.15` / `2026.06.30.081`

## Retail POS Status

ทำแล้ว:

- POS รองรับ online/offline/sync/tenant
- ใช้ stable `saleId` เดียวกันทั้ง online/offline
- กัน duplicate ด้วย sale document id
- กันตัด stock ซ้ำด้วย deterministic stock movement id
- เพิ่ม Running Number `POS-YYYYMMDD-00001`
- เพิ่ม Counter metadata helper
- แก้เมนู POS เปิดได้และปรับระยะห่าง PC/Mobile แล้ว
- เพิ่ม OfflineQueueWorker สำหรับ retry อัตโนมัติ
- เพิ่ม Repository Layer เบื้องต้น `retail-pos-repository.js`
- route offline sale sync และ sync status ผ่าน repository helper

## Current Milestone

`P9-B005 Repository Layer`

## Regression Tests

1. เปิด `/pos` แล้วเมนูต้องเปิดได้ตามปกติ
2. ขาย offline 1 บิล แล้ว local sale ต้องเป็น `pending`
3. header sync status ต้องเห็นรายการ pending ผ่าน repository helper
4. ต่อเน็ตแล้ว worker ต้อง sync อัตโนมัติ
5. กด Retry แล้ว failed queue ต้องกลับไป sync ได้
6. sync สำเร็จแล้วต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ
7. product/sale local storage เดิมต้องยังอ่านได้ตามปกติ

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
