# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Payment Focus UX`
- Developer Panel version/build ปัจจุบัน: `0.12.37` / `2026.07.01.019`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- หน้า Delivery PC เลื่อนหมวดหมู่ซ้าย-ขวาหลังคลิกหมวดได้ต่อเนื่อง
- Admin จัดลำดับหมวดหมู่หลังเปลี่ยนชื่อหมวดแล้วบันทึกได้
- P9-B010 เริ่มแล้ว: Retail POS ใช้ virtual batch rendering, debounce search, cache search data และ lazy image สำหรับสินค้า
- POS Payment UX: ช่อง `รับเงินมา` select ตัวเลขทั้งหมดเมื่อเปิด modal หรือคลิกกลับเข้าช่อง เพื่อพิมพ์ทับได้ทันที

## Current Milestone

`POS Payment Focus UX`

## Regression Tests

1. เปิด `/pos`
2. เพิ่มสินค้าลงบิล
3. กดรับชำระเงินแล้วช่อง `รับเงินมา` ต้องถูกคลุมตัวเลขทั้งหมด
4. เลือก/ค้นหาสมาชิกหรือคลิกจุดอื่นใน modal แล้วคลิกกลับมาที่ช่อง `รับเงินมา` ต้อง select ตัวเลขทั้งหมดอีกครั้ง
5. พิมพ์ตัวเลขใหม่ต้องแทนค่าของเดิมทันที
6. ยืนยันการขายต้องยังทำงานและตัดสต็อกเหมือนเดิม

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
