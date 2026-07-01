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

- Version: `0.12.31`
- Build: `2026.07.01.013`
- Branch: `feature/retail-pos`
- Milestone: `Mobile Kitchen Icon & QR Print Font`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen แสดง Take Away ด้วยเลขคิว ไม่ปนกับโต๊ะจริง
- Kitchen Take Away มีปุ่ม `เสิร์ฟแล้ว` หลังสถานะพร้อมเสิร์ฟ
- Mobile หน้าครัวปุ่ม `เสิร์ฟแล้ว` แสดงเฉพาะ icon
- Take Away ที่เป็นสถานะ `served` แล้วจะแก้ไขหรือยกเลิกไม่ได้ เหมือนออเดอร์นั่งทานที่ร้าน
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- หน้า Admin มี QR สำหรับ Delivery และ QR สำหรับสั่งกลับบ้าน
- หน้า Admin ตอนพิมพ์ QR Delivery และ QR สั่งกลับบ้านใช้ `TH Sarabun PSK Local`
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- P9-B001 ถึง P9-B009 เสร็จแล้ว

## รายละเอียด Mobile Kitchen Icon & QR Print Font

ปรับ UI ตามการทดสอบจริง: ปุ่ม `เสิร์ฟแล้ว` บน mobile ของหน้าครัวต้องเหลือเฉพาะ icon เพื่อไม่ให้ชนกับปุ่มอื่น และงานพิมพ์ QR ใน Admin ต้องใช้ฟอนต์พิมพ์เอกสารท้องถิ่น

แก้แล้ว:

- `kitchen.js` เพิ่ม icon ในปุ่มสถานะของครัว
- `kitchen-item-editor.css` ซ่อนข้อความของปุ่ม `เสิร์ฟแล้ว` เฉพาะ mobile
- Desktop ยังแสดงข้อความปุ่มตามเดิม
- `/kitchen/index.html` bump cache เป็น `kitchen.js?v=20260701-013` และ `kitchen-item-editor.css?v=20260701-013`
- `admin-delivery-qr.js` บังคับ print style ของ QR Delivery และ QR Take Away ให้ใช้ `TH Sarabun PSK Local`
- `/admin/index.html` bump cache เป็น `admin-delivery-qr.js?v=20260701-013`
- Developer Panel เป็น Version `0.12.31` Build `2026.07.01.013`

## Current Milestone

`Mobile Kitchen Icon & QR Print Font`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด Kitchen บน mobile
3. ออเดอร์ Take Away ที่พร้อมเสิร์ฟต้องเห็นปุ่ม `เสิร์ฟแล้ว` เป็น icon-only
4. Desktop ยังแสดงข้อความปุ่มได้ตามเดิม
5. เปิด `/admin`
6. กดพิมพ์ QR Delivery ต้องใช้ฟอนต์ `TH Sarabun PSK Local`
7. กดพิมพ์ QR สั่งกลับบ้านต้องใช้ฟอนต์ `TH Sarabun PSK Local`
8. QR โต๊ะนั่งทานที่ร้านต้องยังทำงานเหมือนเดิม

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
