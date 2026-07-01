# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Table Move Customer Session Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.42` / `2026.07.01.024`

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
- หน้า `Admin > จัดการพนักงาน` Owner เห็นรายการพนักงานของร้านตัวเองจาก tenant memberships แล้ว
- หลัง Cashier เปลี่ยนโต๊ะ หน้าลูกค้ายังเห็นรายการเดิมด้วย stable `tableToken` และรอบถัดไปไม่เริ่มใหม่ผิด

## Current Milestone

`Table Move Customer Session Fix`

## Regression Tests

1. เปิดโต๊ะ A แล้วสั่งอาหารจาก QR
2. Kitchen/Cashier ต้องเห็นออเดอร์โต๊ะ A
3. Cashier เปลี่ยนโต๊ะ A ไปโต๊ะ B
4. หน้า Cashier/Kitchen ต้องยังเห็นรายการเดิมภายใต้โต๊ะใหม่
5. หน้าลูกค้าต้องยังเห็นรายการที่สั่งแล้วจาก session เดิม
6. รอบการสั่งถัดไปต้องต่อจากรอบเดิม ไม่กลับเป็นรอบที่ 1
7. กดสั่งเพิ่มหลังย้ายโต๊ะแล้วออเดอร์ใหม่ต้องเข้าโต๊ะที่ active ใหม่

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
