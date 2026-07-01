# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B010 POS Performance`
- Developer Panel version/build ปัจจุบัน: `0.12.36` / `2026.07.01.018`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- หน้า Delivery PC เลื่อนหมวดหมู่ซ้าย-ขวาหลังคลิกหมวดได้ต่อเนื่อง
- Admin จัดลำดับหมวดหมู่หลังเปลี่ยนชื่อหมวดแล้วบันทึกได้
- P9-B010 เริ่มแล้ว: Retail POS ใช้ virtual batch rendering, debounce search, cache search data และ lazy image สำหรับสินค้า

## Current Milestone

`P9-B010 POS Performance`

## Regression Tests

1. เปิด `/pos`
2. สินค้าใน POS ต้องโหลดเร็วขึ้นและไม่ render ทั้งหมดในครั้งเดียว
3. ถ้าสินค้ามีจำนวนมาก ต้องเห็นปุ่ม `แสดงเพิ่ม`
4. ค้นหาสินค้าด้วยชื่อ/รหัส/บาร์โค้ดต้องยังทำงาน
5. คลิกสินค้าเพื่อเพิ่มลงบิลต้องยังทำงาน
6. สแกนบาร์โค้ดแล้วยังเพิ่มสินค้าได้
7. ขายสินค้าและตัดสต็อกต้องยังทำงานทั้ง Online/Offline
8. รูปสินค้าต้อง lazy load เฉพาะรายการที่แสดง

## Next Tasks

1. O1-T002 Pickup Screen / Counter Display
2. P9-B010 Performance phase 2: product data watch/cache cleanup และ search index สำหรับ barcode lookup

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
