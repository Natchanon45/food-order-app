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

- Version: `0.12.41`
- Build: `2026.07.01.023`
- Branch: `feature/retail-pos`
- Milestone: `Owner Staff List Fix`

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
- Order Completion: ออเดอร์ที่ `served` และ `paymentStatus = paid` จะปิดเป็น `paid` อัตโนมัติและไม่ค้างใน Cashier/Kitchen
- Receipt Print: พิมพ์เฉพาะข้อมูลใบเสร็จ ไม่ติด UI/toolbar/footer/version ของระบบ
- Kitchen Visual Cues: ปุ่มรับออเดอร์/เริ่มทำ/พร้อมเสิร์ฟมี animation เบา ๆ และออเดอร์รอนานเกิน 15 นาทีมี highlight
- Admin Users: Owner เห็นรายการพนักงานของร้านตัวเองจาก tenant memberships แล้ว

## Current Milestone

`Owner Staff List Fix`

## รายละเอียด Owner Staff List Fix

แก้ปัญหา Owner เปิดหน้า `/admin/users` แล้วรายการพนักงานเป็น `0 คน` ทั้งที่มีพนักงานในร้าน เพราะหน้าเดิมอิง staff helper เก่าและไม่ได้ fallback ไปอ่าน `tenants/{tenantId}/memberships`

แก้แล้ว:

- เพิ่ม `admin-staff-service.js`
- `listStaffUsers()` เรียก callable `listStaffUsers` ก่อน และ fallback ไปอ่าน tenant memberships ของ tenant ปัจจุบัน
- `createStaffUser()` และ `updateStaffUser()` ส่ง `tenantId`/`tenantSlug` ไป callable เพื่อคง scope tenant
- `admin-users.js` เปลี่ยนไปใช้ `admin-staff-service.js?v=20260701-023`
- `/admin/users/index.html` bump `admin-users.js?v=20260701-023`
- `/admin/users/index.html` bump `page-guard.js?v=20260701-015`
- Developer Panel เป็น Version `0.12.41` Build `2026.07.01.023`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. Login ด้วย Owner
3. เปิด `/admin/users`
4. รายการพนักงานต้องแสดงพนักงานของ tenant ปัจจุบัน ไม่ใช่ `0 คน` หากมี membership อยู่แล้ว
5. สร้างพนักงานใหม่แล้ว refresh รายการต้องแสดงทันที
6. รายการต้องไม่ข้าม tenant
7. หน้า Kitchen/Cashier/POS ต้องไม่เปลี่ยน behavior

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
