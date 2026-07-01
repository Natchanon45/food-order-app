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

- Version: `0.12.32`
- Build: `2026.07.01.014`
- Branch: `feature/retail-pos`
- Milestone: `Kitchen Serve Item & Cashier Table Icons`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen แสดง Take Away ด้วยเลขคิว ไม่ปนกับโต๊ะจริง
- Kitchen Take Away มีปุ่ม `เสิร์ฟแล้ว` หลังสถานะพร้อมเสิร์ฟ
- ปุ่ม `เสิร์ฟรายการนี้` ใช้ icon `bi-send-check` และบน Mobile แสดงเฉพาะ icon
- ปุ่ม `เสิร์ฟแล้ว` ทั้งออเดอร์ยังแสดงข้อความทั้ง PC และ Mobile
- Take Away ที่เป็นสถานะ `served` แล้วจะแก้ไขหรือยกเลิกไม่ได้ เหมือนออเดอร์นั่งทานที่ร้าน
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- หน้า Cashier ปุ่มออกโต๊ะ/รับชำระโต๊ะและปุ่มเปลี่ยนโต๊ะใช้ icon `bi-easel2`
- หน้า Admin มี QR สำหรับ Delivery และ QR สำหรับสั่งกลับบ้าน
- หน้า Admin ตอนพิมพ์ QR Delivery และ QR สั่งกลับบ้านใช้ `TH Sarabun PSK Local`
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- P9-B001 ถึง P9-B009 เสร็จแล้ว

## รายละเอียด Kitchen Serve Item & Cashier Table Icons

ปรับ UI ตามที่ทดสอบจริง: ปุ่มที่ต้องเป็น icon-only บน mobile คือปุ่ม `เสิร์ฟรายการนี้` ของแต่ละรายการอาหารเท่านั้น ส่วนปุ่ม `เสิร์ฟแล้ว` ทั้งออเดอร์ต้องยังแสดงข้อความเหมือนเดิม

แก้แล้ว:

- `kitchen-item-serve.js` เปลี่ยนปุ่ม `data-serve-item` เป็น icon `bi-send-check` พร้อมข้อความ `เสิร์ฟรายการนี้`
- `kitchen-item-editor.css` ซ่อนข้อความเฉพาะปุ่ม `data-serve-item` บน mobile
- ยกเลิกการซ่อนข้อความของปุ่ม `.kitchen-served-action` บน mobile
- `kitchen.js` bump import `kitchen-item-serve.js?v=20260701-014`
- `/kitchen/index.html` bump cache เป็น `kitchen.js?v=20260701-014` และ `kitchen-item-editor.css?v=20260701-014`
- `cashier-table-move.js` เปลี่ยนปุ่ม `เปลี่ยนโต๊ะ` เป็น icon `bi-easel2`
- `cashier.js` เปลี่ยนปุ่มออกโต๊ะ/รับชำระโต๊ะเป็น icon `bi-easel2` และ bump import `cashier-table-move.js?v=20260701-014`
- `/cashier/index.html` bump cache เป็น `cashier.js?v=20260701-014`
- Developer Panel เป็น Version `0.12.32` Build `2026.07.01.014`

## Current Milestone

`Kitchen Serve Item & Cashier Table Icons`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด Kitchen บน mobile
3. ปุ่ม `เสิร์ฟรายการนี้` ต้องเห็นเฉพาะ icon `bi-send-check`
4. เปิด Kitchen บน desktop ปุ่ม `เสิร์ฟรายการนี้` ต้องเห็น icon + ข้อความ
5. ปุ่ม `เสิร์ฟแล้ว` ทั้งออเดอร์ต้องยังแสดงข้อความบน mobile และ desktop
6. เปิด Cashier แล้วปุ่มออกโต๊ะ/รับชำระโต๊ะต้องใช้ `bi-easel2`
7. ปุ่มเปลี่ยนโต๊ะต้องใช้ `bi-easel2`
8. Workflow ครัวและ Cashier ต้องยังทำงานเหมือนเดิม

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
