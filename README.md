# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Owner Staff List Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.41` / `2026.07.01.023`

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

## Current Milestone

`Owner Staff List Fix`

## Regression Tests

1. Login ด้วย Owner
2. เปิด `/admin/users`
3. รายการพนักงานต้องแสดงพนักงานของ tenant ปัจจุบัน ไม่ใช่ `0 คน` หากมี membership อยู่แล้ว
4. สร้างพนักงานใหม่แล้ว refresh รายการต้องแสดงทันที
5. รายการต้องไม่ข้าม tenant
6. หน้า Kitchen/Cashier/POS ต้องไม่เปลี่ยน behavior

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
