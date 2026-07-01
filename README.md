# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B009 Refund / Return / Void`
- Developer Panel version/build ปัจจุบัน: `0.12.23` / `2026.07.01.004`

## Retail POS Status

ทำแล้ว:

- POS รองรับ online/offline/sync/tenant
- ใช้ stable `saleId` เดียวกันทั้ง online/offline
- กัน duplicate ด้วย sale document id
- กันตัด stock ซ้ำด้วย deterministic stock movement id
- เพิ่ม Running Number `POS-YYYYMMDD-00001`
- เพิ่ม Repository Layer เบื้องต้น `retail-pos-repository.js`
- เพิ่ม OfflineQueueWorker สำหรับ retry อัตโนมัติ
- เปิดใบเสร็จหลังบันทึกการขายสำเร็จ
- ใบเสร็จ POS ดึงข้อมูลร้าน ลูกค้า แต้ม และท้ายบิลได้แล้ว
- เพิ่ม Firestore composite indexes สำหรับ Retail POS collections
- เพิ่ม audit log สำหรับการขาย POS ที่บันทึกสำเร็จบน Firestore
- ปรับระบบเปิดกะ/ปิดกะให้บันทึก tenantId, deviceId, user, เงินตั้งต้น, เงินนับจริง และผลต่างเงินสด
- ปรับคืนสินค้า/คืนเงิน/VOID ให้รองรับ tenant, audit log, deterministic stock movement id และปรับแต้มสมาชิก

## Current Milestone

`P9-B009 Refund / Return / Void`

## Regression Tests

1. เปิด `/pos/returns`
2. ค้นหาบิลขายที่ยังมีสินค้าคืนได้
3. คืนสินค้าบางรายการ ต้องเพิ่ม stock กลับและบันทึก return record
4. กด `คืนทั้งบิล / VOID` ต้องใส่จำนวนคืนเต็มที่เหลือ และบันทึก sale status เป็น `voided`
5. Return/VOID ต้องสร้าง stock movement id แบบ stable ต่อ returnId + productId
6. Firestore ต้องมี audit log สำหรับ return หรือ void
7. ถ้าบิลมีสมาชิกและแต้ม ต้องหัก/คืนแต้มตามยอดคืน
8. จำนวนคืนต้องไม่เกินจำนวนที่ขายลบจำนวนที่คืนแล้ว
9. Local fallback ต้องยังบันทึก return, movement, product cache และ loyalty cache ได้
10. Cache ของ returns page ต้องเป็น `retail-returns.js?v=20260701-004`

## Next Tasks

1. P9-B010 Performance

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
