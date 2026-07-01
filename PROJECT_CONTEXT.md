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

- Version: `0.12.26`
- Build: `2026.07.01.007`
- Branch: `feature/retail-pos`
- Milestone: `O1-T001.3 Take Away Hotfix`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- P9-B001 ถึง P9-B009 เสร็จแล้ว

## รายละเอียด O1-T001.3

แก้ hotfix หลัง Take Away public order ติด permission denied และหน้า Cashier ยังต้องมี QR ให้ลูกค้าสแกน

แก้แล้ว:

- เพิ่ม Firestore Rules สำหรับ public Take Away order
- เพิ่ม Firestore Rules สำหรับ public Take Away counter
- คง route Delivery, QR Table Order และ Cashier เดิม
- เพิ่ม modal QR Take Away บนหน้า Cashier ผ่าน `cashier-original-order.js`
- เพิ่มปุ่ม `สั่งกลับบ้าน` สำหรับกรณี Cashier สั่งแทนลูกค้า
- เพิ่ม no-cache ให้ `cashier-original-order.js`

## Current Milestone

`O1-T001.3 Take Away Hotfix`

## Regression Tests สำคัญ

1. Deploy hosting และ firestore rules ใหม่
2. เปิด `/s/{tenantSlug}/delivery/` ต้องโหลดเมนู Delivery ได้
3. เปิด `/s/{tenantSlug}/order/` ต้องเห็นออเดอร์โต๊ะเดิมตาม table token
4. เปิด `/s/{tenantSlug}/takeaway/` ต้องเห็นหน้า `สั่งกลับบ้าน`
5. ส่งออเดอร์ Take Away ต้องได้เลขคิว `TA-xxx` และไม่ติด permission denied
6. หน้า Cashier ต้องเห็น QR Take Away, คัดลอกลิงก์ และปุ่มสั่งกลับบ้าน
7. กด QR Take Away ต้องเปิด modal QR สำหรับลูกค้าสแกน
8. Cashier กดรับชำระเงิน เรียกรับของ และส่งมอบแล้วได้
9. QR Table Order และ Delivery ต้องยังทำงานตามเดิม

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
