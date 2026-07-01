# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Take Away + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string กัน browser cache
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.26`
- Build: `2026.07.01.007`
- Branch: `feature/retail-pos`
- Milestone: `O1-T001.2 Tenant Take Away Route Fix`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation P9-B001 เสร็จ
- P9-B002 Running Number เสร็จ
- P9-B003 Counter เสร็จ
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จ
- P9-B005 Repository Layer เสร็จเบื้องต้น
- P9-B006 Firestore Composite Index เสร็จ
- P9-B007 Audit Log เสร็จ
- P9-B008 Shift Opening / Closing เสร็จ
- P9-B009 Refund / Return / Void เสร็จ

## รายละเอียด O1-T001.2

แก้ปัญหา tenant URL `/s/{tenantSlug}/takeaway/` ถูก Firebase Hosting rewrite ไปหน้า Delivery เพราะ rule `/s/**` อยู่ก่อนและไม่มี rule เฉพาะ Take Away

แก้แล้ว:

- เพิ่ม rewrite `/s/*/takeaway` ไป `takeaway/index.html`
- เพิ่ม rewrite `/s/*/takeaway/**` ไป `takeaway/index.html`
- เพิ่ม rewrite `/takeaway` และ `/takeaway/**` ไป `takeaway/index.html`
- วาง rule Take Away ก่อน fallback `/s/**` เพื่อไม่ให้ตกไปหน้า Delivery
- คง route Delivery success, Delivery, QR Table Order และ Cashier เดิม
- อัปเดต Developer Panel เป็น Version `0.12.26` Build `2026.07.01.007`

## Current Milestone

`O1-T001.2 Tenant Take Away Route Fix`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด `/s/{tenantSlug}/takeaway/`
3. ต้องเห็นหน้า `สั่งกลับบ้าน` ไม่ใช่หน้า Delivery
4. เปิด `/takeaway/` ต้องยังเห็นหน้า Take Away
5. เปิด `/s/{tenantSlug}/delivery/` หรือ Delivery เดิมต้องยังทำงาน
6. เปิด `/s/{tenantSlug}/order/` ต้องยังเข้า QR Table Order ได้
7. หน้า Cashier ปุ่ม `เปิด QR Take Away` ต้องเปิด URL tenant Take Away ถูกหน้า
8. ส่งออเดอร์ Take Away ต้องได้เลขคิว `TA-xxx`
9. หน้า Cashier ต้องแสดงวันที่/เวลา ไม่ใช่ `Invalid Date`
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
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
