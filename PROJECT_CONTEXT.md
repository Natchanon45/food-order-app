# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Take Away + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string หรือกำหนด no-cache เฉพาะไฟล์
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.33`
- Build: `2026.07.01.015`
- Branch: `feature/retail-pos`
- Milestone: `Cashier Icons`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen แสดง Take Away ด้วยเลขคิว ไม่ปนกับโต๊ะจริง
- ปุ่ม `เสิร์ฟรายการนี้` ใช้ icon `bi-send-check` และบน Mobile แสดงเฉพาะ icon
- ปุ่ม `เสิร์ฟแล้ว` ทั้งออเดอร์ยังแสดงข้อความทั้ง PC และ Mobile
- Cashier ย้ายโต๊ะเสร็จ
- หน้า Cashier ปุ่ม `ตรวจแล้ว/ชำระแล้ว` ใช้ icon `check-circle`
- เมนู User ด้านขวาบน รายการ `ออกโต๊ะ` ใช้ icon `bi-easel2`
- ปุ่ม `เปลี่ยนโต๊ะ` ใช้ icon `bi-easel2`
- หน้า Admin มี QR สำหรับ Delivery และ QR สำหรับสั่งกลับบ้าน
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว

## รายละเอียด Cashier Icons

แก้จุดที่สับสนจากรอบก่อน: ปุ่มรับชำระของ Cashier ต้องคง icon check-circle ส่วน icon easel2 ใช้กับเมนูออกโต๊ะด้านขวาบนและปุ่มเปลี่ยนโต๊ะเท่านั้น

แก้แล้ว:

- เพิ่ม `cashier-icon-hotfix.js` เพื่อบังคับปุ่ม `data-table-payment` เป็น `check-circle`
- `auth-service.js` เปลี่ยนเมนู User รายการ `ออกโต๊ะ` เป็น icon `bi-easel2`
- `page-guard.js` bump import `auth-service.js?v=20260701-015`
- `/cashier/index.html` bump `page-guard.js?v=20260701-015`
- `/cashier/index.html` โหลด `cashier-icon-hotfix.js?v=20260701-015`
- Developer Panel เป็น Version `0.12.33` Build `2026.07.01.015`

## Current Milestone

`Cashier Icons`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด Cashier
3. ปุ่ม `ตรวจแล้ว/ชำระแล้ว` ต้องใช้ `check-circle`
4. เมนู User ด้านขวาบน รายการ `ออกโต๊ะ` ต้องใช้ `bi-easel2`
5. ปุ่ม `เปลี่ยนโต๊ะ` ต้องใช้ `bi-easel2`
6. Workflow Cashier ต้องยังทำงานเหมือนเดิม

## งานถัดไป

1. O1-T002 Pickup Screen / Counter Display
2. O1-T003 Kitchen Take Away Visual Badge
3. P9-B010 Performance

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string หรือกำหนด no-cache เฉพาะไฟล์
