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

- Version: `0.12.37`
- Build: `2026.07.01.019`
- Branch: `feature/retail-pos`
- Milestone: `POS Payment Focus UX`

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
- POS Payment UX: ช่อง `รับเงินมา` select ตัวเลขทั้งหมดเมื่อเปิด modal หรือคลิกกลับเข้าช่อง เพื่อพิมพ์ทับได้ทันที

## Current Milestone

`POS Payment Focus UX`

## รายละเอียด POS Payment Focus UX

แก้เฉพาะ UX ในหน้า `/pos` เพื่อให้ cashier พิมพ์ยอดรับเงินใหม่ได้เร็วขึ้น หลังจากเลือกสมาชิกหรือคลิกจุดอื่นใน modal รับชำระเงิน

แก้แล้ว:

- เพิ่ม `retail-pos-payment-focus.js`
- เมื่อเปิด payment modal จะ focus และ select ช่อง `รับเงินมา`
- เมื่อคลิกกลับเข้าช่อง `รับเงินมา` จะ select ตัวเลขทั้งหมดอีกครั้ง
- `/pos/index.html` เพิ่ม `retail-pos-payment-focus.js?v=20260701-019`
- ไม่แตะ logic การขาย, stock, Offline, Sync หรือ Firestore transaction
- Developer Panel เป็น Version `0.12.37` Build `2026.07.01.019`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด `/pos`
3. เพิ่มสินค้าลงบิล
4. กดรับชำระเงินแล้วช่อง `รับเงินมา` ต้องถูกคลุมตัวเลขทั้งหมด
5. เลือก/ค้นหาสมาชิกหรือคลิกจุดอื่นใน modal แล้วคลิกกลับมาที่ช่อง `รับเงินมา` ต้อง select ตัวเลขทั้งหมดอีกครั้ง
6. พิมพ์ตัวเลขใหม่ต้องแทนค่าของเดิมทันที
7. ยืนยันการขายต้องยังทำงานและตัดสต็อกเหมือนเดิม

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
