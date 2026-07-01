# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Cashier Load Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.34` / `2026.07.01.016`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Take Away ส่งเข้าครัวด้วย `orderType = takeaway`
- ปุ่ม `เสิร์ฟรายการนี้` ใช้ icon `bi-send-check` และบน Mobile แสดงเฉพาะ icon
- ปุ่ม `เสิร์ฟแล้ว` ทั้งออเดอร์ยังแสดงข้อความทั้ง PC และ Mobile
- หน้า Cashier ปุ่ม `ตรวจแล้ว/ชำระแล้ว` ใช้ icon `check-circle`
- เมนู User ด้านขวาบน รายการ `ออกโต๊ะ` ใช้ icon `bi-easel2`
- ปุ่ม `เปลี่ยนโต๊ะ` ใช้ icon `bi-easel2`
- Hotfix: แก้หน้า Cashier ค้างจาก observer loop ของ icon hotfix

## Current Milestone

`Cashier Load Fix`

## Regression Tests

1. เปิด Cashier ต้องไม่ค้าง
2. ปุ่ม `ตรวจแล้ว/ชำระแล้ว` ต้องใช้ `check-circle`
3. เมนู User ด้านขวาบน รายการ `ออกโต๊ะ` ต้องใช้ `bi-easel2`
4. ปุ่ม `เปลี่ยนโต๊ะ` ต้องใช้ `bi-easel2`
5. Workflow Cashier ต้องยังทำงานเหมือนเดิม

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
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string หรือกำหนด no-cache เฉพาะไฟล์
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
