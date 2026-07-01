# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Old QR Moved Orders & Admin Status Icons`
- Developer Panel version/build ปัจจุบัน: `0.12.46` / `2026.07.01.029`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Take Away ส่งเข้าครัวและ Cashier แล้ว
- หลัง Cashier เปลี่ยนโต๊ะ ลูกค้าใช้ QR เดิมได้ต่อ และเห็นรายการเดิมจาก `tableToken` หรือ `movedFromTableCode`
- ลูกค้าสั่งเพิ่มจาก QR เดิมแล้วออเดอร์ใหม่เข้าโต๊ะ active ล่าสุด
- หน้า Admin รายการสินค้า/อาหารและโต๊ะมี icon สถานะใช้งานแล้ว

## Current Milestone

`Old QR Moved Orders & Admin Status Icons`

## Regression Tests

1. เปิดโต๊ะ A แล้วสั่งอาหารจาก QR
2. Cashier เปลี่ยนโต๊ะ A ไปโต๊ะ B
3. ลูกค้าสแกน QR เดิมของโต๊ะ A ต้องยังเห็นรายการเดิม
4. ลูกค้าสั่งเพิ่มจาก QR เดิม ต้องเข้าโต๊ะ B ที่ active อยู่
5. รอบการสั่งถัดไปต้องต่อจากรอบเดิม
6. หน้า Admin สถานะใช้งานต้องเป็น icon `bi-check-square` สีเขียว
7. หน้า Admin สถานะไม่ได้ใช้งานต้องเป็น icon `bi-square` สีเทา

## Next Tasks

1. O1-T002 Pickup Screen / Counter Display
2. P9-B010 Performance phase 2

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
