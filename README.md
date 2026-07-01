# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Order Completion & Receipt Print Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.38` / `2026.07.01.020`

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

## Current Milestone

`Order Completion & Receipt Print Fix`

## Regression Tests

1. เปิด Take Away แล้วส่งเข้าครัว
2. ครัวกดเสิร์ฟครบทุก/ทั้งออเดอร์
3. Cashier รับชำระเงิน
4. ออเดอร์ต้องหายจากหน้า Cashier
5. ออเดอร์ต้องหายจากหน้า Kitchen
6. เปิดพิมพ์ใบเสร็จแล้วใน print preview ต้องเห็นเฉพาะข้อมูลใบเสร็จ
7. Header/toolbar/version/footer ของระบบต้องไม่ติดไปในงานพิมพ์

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
