# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Kitchen Serve Item & Cashier Table Icons`
- Developer Panel version/build ปัจจุบัน: `0.12.32` / `2026.07.01.014`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- เพิ่ม Take Away Order โดยไม่ต้องเปิดโต๊ะจริง
- ลูกค้าสั่ง Take Away ผ่าน `/takeaway/` หรือ `/s/{tenantSlug}/takeaway/`
- หน้า Admin มี QR สำหรับสั่ง Delivery และ QR สำหรับสั่งกลับบ้าน
- Take Away ส่งเข้าครัวด้วย `orderType = takeaway`
- หน้าครัวแสดง Take Away ด้วยเลขคิว ไม่ปนกับโต๊ะจริง
- ปุ่ม `เสิร์ฟรายการนี้` ใช้ icon `bi-send-check` และบน Mobile แสดงเฉพาะ icon
- ปุ่ม `เสิร์ฟแล้ว` ทั้งออเดอร์ยังแสดงข้อความทั้ง PC และ Mobile
- เมื่อ Take Away เป็นสถานะ `served` แล้ว รายการจะแก้ไขหรือยกเลิกไม่ได้ เหมือนออเดอร์นั่งทานที่ร้าน
- หน้า Cashier ปุ่มออกโต๊ะ/เปลี่ยนโต๊ะใช้ icon `bi-easel2`

## Current Milestone

`Kitchen Serve Item & Cashier Table Icons`

## Regression Tests

1. เปิด Kitchen บน mobile
2. ปุ่ม `เสิร์ฟรายการนี้` ต้องเห็นเฉพาะ icon `bi-send-check`
3. เปิด Kitchen บน desktop ปุ่ม `เสิร์ฟรายการนี้` ต้องเห็น icon + ข้อความ
4. ปุ่ม `เสิร์ฟแล้ว` ทั้งออเดอร์ต้องยังแสดงข้อความบน mobile และ desktop
5. เปิด Cashier แล้วปุ่มออกโต๊ะ/รับชำระโต๊ะต้องใช้ `bi-easel2`
6. ปุ่มเปลี่ยนโต๊ะต้องใช้ `bi-easel2`
7. Workflow ครัวและ Cashier ต้องยังทำงานเหมือนเดิม

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
