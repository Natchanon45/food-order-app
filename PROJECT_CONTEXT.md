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

- Version: `0.12.36`
- Build: `2026.07.01.018`
- Branch: `feature/retail-pos`
- Milestone: `P9-B010 POS Performance`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen แสดง Take Away ด้วยเลขคิว ไม่ปนกับโต๊ะจริง
- Cashier ย้ายโต๊ะเสร็จ
- Delivery Lock เสร็จ
- หน้า Delivery PC เลื่อนหมวดหมู่ซ้าย-ขวาหลังคลิกหมวดได้ต่อเนื่อง
- Admin จัดลำดับหมวดหมู่หลังเปลี่ยนชื่อหมวดแล้วบันทึกได้
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- P9-B010 เริ่มแล้ว: POS catalog ใช้ virtual batch rendering, debounce search, cache search data และ lazy image

## Current Milestone

`P9-B010 POS Performance`

## รายละเอียด P9-B010 POS Performance phase 1

โฟกัสที่หน้า `/pos` เพื่อลดอาการหน่วงเมื่อมีสินค้าจำนวนมาก โดยไม่เปลี่ยน workflow การขายและไม่แตะ Firestore transaction

แก้แล้ว:

- `retail-pos-catalog.js` เปลี่ยนเป็น catalog controller แบบ virtual batch rendering
- แสดงสินค้าเป็นชุดแรก 96 รายการ และใช้ปุ่ม `แสดงเพิ่ม` แทนการ render ทั้งหมดทีเดียว
- search สินค้า debounce 80ms และใช้ search text cache จาก localStorage
- cache product/sales stamp เพื่อลดการ parse และจัด ranking ซ้ำโดยไม่จำเป็น
- lazy load รูปเฉพาะสินค้าที่แสดงจริงชุดแรก
- `retail-pos-catalog.css` เพิ่ม style สำหรับ result count และปุ่มแสดงเพิ่ม
- `retail-pos-hold.js` bump import `retail-pos-catalog.js?v=20260701-018`
- `/pos/index.html` bump `retail-pos-hold.js?v=20260701-018`
- Developer Panel เป็น Version `0.12.36` Build `2026.07.01.018`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด `/pos`
3. สินค้าใน POS ต้องโหลดเร็วขึ้นและไม่ render ทั้งหมดในครั้งเดียว
4. ถ้าสินค้ามีจำนวนมาก ต้องเห็นปุ่ม `แสดงเพิ่ม`
5. ค้นหาสินค้าด้วยชื่อ/รหัส/บาร์โค้ดต้องยังทำงาน
6. คลิกสินค้าเพื่อเพิ่มลงบิลต้องยังทำงาน
7. สแกนบาร์โค้ดแล้วยังเพิ่มสินค้าได้
8. ขายสินค้าและตัดสต็อกต้องยังทำงานทั้ง Online/Offline
9. รูปสินค้าต้อง lazy load เฉพาะรายการที่แสดง

## งานถัดไป

1. O1-T002 Pickup Screen / Counter Display
2. O1-T003 Kitchen Take Away Visual Badge
3. P9-B010 Performance phase 2: product data watch/cache cleanup และ search index สำหรับ barcode lookup

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string หรือกำหนด no-cache เฉพาะไฟล์
