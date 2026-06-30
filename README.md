# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B004 Offline Queue Worker`
- Developer Panel version/build ปัจจุบัน: `0.12.13` / `2026.06.30.079`

## Retail POS Status

ทำแล้ว:

- POS รองรับ online/offline/sync/tenant
- ใช้ stable `saleId` เดียวกันทั้ง online/offline
- กัน duplicate ด้วย sale document id
- กันตัด stock ซ้ำด้วย deterministic stock movement id
- เพิ่ม Running Number `POS-YYYYMMDD-00001`
- เพิ่ม Counter metadata helper
- แก้เมนู POS เปิดได้แล้ว
- เพิ่ม OfflineQueueWorker สำหรับ retry อัตโนมัติ
- เพิ่ม retry delay ให้รายการ sync failed
- เพิ่ม conflict metadata และ helper สำหรับ retry/resolve

## Current Milestone

`P9-B004 Offline Queue Worker`

## Regression Tests

1. เปิด `/pos` แล้วเมนูต้องเปิดได้ตามปกติ
2. ขาย offline 1 บิล แล้ว local sale ต้องเป็น `pending`
3. ต่อเน็ตแล้ว worker ต้อง sync อัตโนมัติ
4. ถ้า sync fail ต้องเป็น `failed` พร้อม `nextRetryAt`
5. กดปุ่ม `Retry` ต้องนำ failed กลับไป sync ใหม่
6. ถ้า tenant mismatch หรือ stock ไม่พอ ต้องเป็น `conflict`
7. conflict ต้องไม่ retry เองจนกว่าจะ resolve/retry manual
8. sync ซ้ำต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

## Next Tasks

1. P9-B005 Repository Layer
2. P9-B006 Firestore Composite Index
3. P9-B007 Audit Log
4. P9-B008 Shift Opening / Closing

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string เพื่อกัน browser cache
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
