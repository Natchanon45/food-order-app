# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Kitchen Start Action Icon Animation`
- Developer Panel version/build ปัจจุบัน: `0.12.39` / `2026.07.01.021`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Take Away ส่งเข้าครัวและ Cashier แล้ว
- เมื่อออเดอร์เป็น `served` และ `paymentStatus = paid` ระบบจะปิดเป็น `paid` อัตโนมัติ
- ออเดอร์ที่เสิร์ฟครบและชำระแล้วจะไม่ค้างในหน้า Cashier/Kitchen
- หน้า Print Receipt พิมพ์เฉพาะข้อมูลใบเสร็จ ไม่ดึง UI/ข้อความระบบ/เวอร์ชันด้านล่างติดไปด้วย
- หน้าครัวปุ่ม `เริ่มทำ` ใช้ icon `bi-hourglass-split` พร้อม animation เบา ๆ

## Current Milestone

`Kitchen Start Action Icon Animation`

## Regression Tests

1. เปิด Kitchen
2. ออเดอร์สถานะ `รับออเดอร์แล้ว/accepted` ต้องแสดงปุ่ม `เริ่มทำ`
3. ปุ่ม `เริ่มทำ` ต้องใช้ icon `bi-hourglass-split`
4. icon ต้องมี animation หมุนแบบ hourglass เบา ๆ
5. กด `เริ่มทำ` แล้วสถานะต้องเปลี่ยนเป็น `cooking` เหมือนเดิม
6. ปุ่มสถานะอื่นใน Kitchen ต้องไม่เปลี่ยน behavior

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
