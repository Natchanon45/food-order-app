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

- Version: `0.12.28`
- Build: `2026.07.01.009`
- Branch: `feature/retail-pos`
- Milestone: `HOTFIX Delivery Order Take Away Recovery`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- P9-B001 ถึง P9-B009 เสร็จแล้ว

## รายละเอียด HOTFIX Delivery Order Take Away Recovery

แก้ด่วนต่อจาก HOTFIX รอบแรก เพราะยังพบว่า Delivery/Order/Take Away โหลด `data-service.js` เก่าหรือขาด `getStoreSettings()` ทำให้ Delivery โหลดเมนูไม่ได้ และ Take Away ยังเสี่ยงใช้ flow เก่า

แก้แล้ว:

- คืน `getStoreSettings()` ใน `data-service.js`
- คง Take Away ให้สร้าง order ตรง ไม่ใช้ public counter transaction
- เลขคิว Take Away ใช้รูปแบบ `TA-HHMMSS-XXX` ชั่วคราวเพื่อตัดปัญหา submit ล้ม
- บังคับ Delivery ใช้ `data-service.js?v=20260701-009`
- บังคับ Table Order ใช้ `customer-secure.js?v=20260701-009` และ `data-service.js?v=20260701-009`
- บังคับ Take Away ใช้ `takeaway-order.js?v=20260701-009` และ `data-service.js?v=20260701-009`
- หน้า Cashier ยังมี QR Take Away และปุ่ม `สั่งกลับบ้าน`

## Current Milestone

`HOTFIX Delivery Order Take Away Recovery`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด `/s/{tenantSlug}/delivery/` ต้องโหลดเมนู Delivery ได้
3. เปิด `/s/{tenantSlug}/order/` ต้องเห็นออเดอร์โต๊ะเดิมตาม table token
4. เปิด `/s/{tenantSlug}/takeaway/` ต้องเห็นหน้า `สั่งกลับบ้าน`
5. Console ต้องไม่ยิง `counters/takeaway_...` จากหน้า Take Away
6. ส่งออเดอร์ Take Away ต้องได้เลขคิว `TA-xxx`
7. หน้า Cashier ต้องเห็น QR Take Away และปุ่มสั่งกลับบ้าน
8. กด QR Take Away ต้องแสดง QR สำหรับลูกค้าสแกน
9. Cashier กดรับชำระเงิน เรียกรับของ และส่งมอบแล้วได้
10. QR Table Order และ Delivery ต้องยังทำงานตามเดิม

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
