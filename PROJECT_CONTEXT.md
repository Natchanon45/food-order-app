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
- Milestone: `HOTFIX Take Away Kitchen Submit & Mobile UX`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- P9-B001 ถึง P9-B009 เสร็จแล้ว

## รายละเอียด HOTFIX Take Away Kitchen Submit & Mobile UX

แก้ต่อจากภาพทดสอบที่ Take Away ยังส่งเข้าครัวไม่ได้เพราะ Firestore Rules ยังปฏิเสธ public tenant order create และปรับ UX หน้า Take Away ให้เหมือนหน้า QR โต๊ะบนมือถือ

แก้แล้ว:

- อัปเดต `firestore.rules` ให้ public tenant Take Away create order ได้ผ่าน `validPublicTenantTakeaway(tenantId)`
- คง Take Away ให้สร้าง order ตรง ไม่ใช้ public counter transaction
- เลขคิว Take Away ใช้รูปแบบ `TA-HHMMSS-XXX` ชั่วคราวเพื่อตัดปัญหา submit ล้ม
- หน้า Take Away ใช้ `table-order-sticky-lite.css` เหมือนหน้า QR โต๊ะ
- หน้า Take Away โหลด `table-order-category-scrollspy.js` เพื่อให้ mobile scroll แล้ว active category เปลี่ยนตามตำแหน่งรายการ
- `app.css` บังคับ `.app-toast` และ `.toast` เป็น top layer ด้วย `z-index: 2147483647 !important`
- หน้า Take Away bump cache เป็น `takeaway-order.js?v=20260701-010`
- หน้า Take Away bump app css เป็น `app.css?v=20260701-010`

## Current Milestone

`HOTFIX Take Away Kitchen Submit & Mobile UX`

## Regression Tests สำคัญ

1. Deploy hosting และ firestore rules ใหม่
2. เปิด `/s/{tenantSlug}/takeaway/` ต้องเห็นหน้า `สั่งกลับบ้าน`
3. Console ต้องไม่ยิง `counters/takeaway_...` จากหน้า Take Away
4. ส่งออเดอร์ Take Away ต้องได้เลขคิว `TA-xxx`
5. ออเดอร์ Take Away ต้องเข้า Kitchen
6. หน้า Take Away mobile ต้องมี sticky หมวดหมู่เหมือนหน้า QR โต๊ะ
7. เลื่อนเมนูบน mobile แล้วหมวดหมู่ active ต้องเปลี่ยนตามรายการที่เลื่อนถึง
8. toast alert ต้องอยู่ layer บนสุด ไม่โดน cart bar บัง
9. หน้า Cashier ต้องเห็น QR Take Away และปุ่มสั่งกลับบ้าน
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
