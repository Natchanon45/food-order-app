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

- Version: `0.12.29`
- Build: `2026.07.01.010`
- Branch: `feature/retail-pos`
- Milestone: `Admin Take Away QR Poster`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen แสดง Take Away ด้วยเลขคิว ไม่ปนกับโต๊ะจริง
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- หน้า Admin มี QR สำหรับ Delivery และ QR สำหรับสั่งกลับบ้าน
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- P9-B001 ถึง P9-B009 เสร็จแล้ว

## รายละเอียด Admin Take Away QR Poster

เพิ่ม QR สำหรับสั่งกลับบ้านในหน้า Admin เพื่อให้เจ้าของร้านพิมพ์ไปแปะหน้า Counter Cashier สำหรับลูกค้า Walk-in

แก้แล้ว:

- ปรับ `admin-delivery-qr.js` ให้สร้าง QR ได้ 2 ชุด: Delivery และ Take Away
- Take Away QR ใช้ลิงก์ `/s/{tenantSlug}/takeaway`
- เพิ่มปุ่มคัดลอกลิงก์ / ดาวน์โหลด QR / พิมพ์ สำหรับ QR สั่งกลับบ้าน
- ข้อความบนป้าย QR คือ `สแกนเพื่อสั่งกลับบ้าน`
- รองรับกรณี browser ยัง cache module QR Delivery เก่า โดย module ใหม่จะเติมเฉพาะบล็อก Take Away เพิ่มได้
- `/admin/index.html` bump cache เป็น `admin.js?v=20260701-012` และโหลด `admin-delivery-qr.js?v=20260701-012`

## Current Milestone

`Admin Take Away QR Poster`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด `/admin`
3. ต้องเห็น `QR สำหรับสั่ง Delivery`
4. ต้องเห็น `QR สำหรับสั่งกลับบ้าน`
5. QR สั่งกลับบ้านต้องชี้ไป `/s/{tenantSlug}/takeaway`
6. ปุ่มคัดลอกลิงก์ / ดาวน์โหลด QR / พิมพ์ ของสั่งกลับบ้านต้องทำงาน
7. เปิด QR สั่งกลับบ้านแล้วต้องเข้า Take Away ไม่ใช่ Delivery
8. ส่ง Take Away แล้วต้องเข้า Kitchen เป็น `Take Away: TA-xxx`
9. QR Delivery เดิมต้องยังทำงาน

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
