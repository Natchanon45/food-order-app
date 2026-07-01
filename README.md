# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Delivery Category Scroll & Admin Sort Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.35` / `2026.07.01.017`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- หน้า Delivery PC เลื่อนหมวดหมู่ซ้าย-ขวาหลังคลิกหมวดได้ต่อเนื่อง
- Admin จัดลำดับหมวดหมู่หลังเปลี่ยนชื่อหมวดแล้วบันทึกได้

## Current Milestone

`Delivery Category Scroll & Admin Sort Fix`

## Regression Tests

1. เปิด Delivery บน PC
2. คลิกหมวดลำดับ 2 หรือ 3 แล้วต้องยังเลื่อนหมวดหมู่ซ้าย-ขวาได้
3. เปิด Admin แล้วเปลี่ยนชื่อหมวดหมู่เมนู
4. จัดลำดับหมวดหมู่ใหม่แล้วต้องบันทึกสำเร็จ
5. เมนูหน้า Delivery/Take Away ต้องเรียงตามลำดับหมวดใหม่

## Next Tasks

1. O1-T002 Pickup Screen / Counter Display
2. P9-B010 Performance

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
