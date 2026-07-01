# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Customer Old QR Table Move Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.44` / `2026.07.01.027`

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
- หน้าครัวมี visual cue สำหรับปุ่มสถานะและออเดอร์รอนาน
- หน้า `Admin > จัดการพนักงาน` แสดงเฉพาะพนักงาน role `admin/cashier/kitchen` และไม่แสดง Owner
- หลัง Cashier เปลี่ยนโต๊ะ ลูกค้าใช้ QR เดิมได้ต่อ และเห็นรายการเดิมด้วย stable `tableToken`

## Current Milestone

`Customer Old QR Table Move Fix`

## Regression Tests

1. เปิดโต๊ะ A แล้วสั่งอาหารจาก QR
2. Cashier เปลี่ยนโต๊ะ A ไปโต๊ะ B
3. ลูกค้าสแกน QR เดิมของโต๊ะ A ต้องยังเห็นรายการเดิม
4. ลูกค้าสั่งเพิ่มจาก QR เดิม ต้องเข้าโต๊ะ B ที่ active อยู่
5. รอบการสั่งถัดไปต้องต่อจากรอบเดิม ไม่กลับเป็นรอบที่ 1
6. Kitchen/Cashier ต้องยังเห็นรายการถูกต้อง

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
