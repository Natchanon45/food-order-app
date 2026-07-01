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

- Version: `0.12.25`
- Build: `2026.07.01.006`
- Branch: `feature/retail-pos`
- Milestone: `O1-T001.1 Take Away Cashier Fix`

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

## รายละเอียด O1-T001.1

แก้ปัญหาหลังทดสอบ Take Away รอบแรก: ลูกค้า Walk-in ยังไม่มีจุดให้เปิดลิงก์/QR สั่งกลับบ้านจากหน้าร้าน และหน้า Cashier แสดง `Invalid Date` บนการ์ดออเดอร์

แก้แล้ว:

- เพิ่มเครื่องมือบนหน้า `/cashier/` สำหรับเปิดลิงก์ Take Away และคัดลอกลิงก์ให้ลูกค้า Walk-in
- ถ้ามี tenant slug จะเปิดเป็น `/s/{tenantSlug}/takeaway/` ถ้าไม่มีจะ fallback เป็น `/takeaway/`
- แก้ `formatTime()` ให้รองรับ Firestore Timestamp, object ที่มี seconds, ISO string และ fallback เป็นเวลาปัจจุบันเมื่อข้อมูลวันที่ไม่สมบูรณ์
- ปรับ cashier ให้ใช้ fallback `createdAt || createdAtText || updatedAt` ก่อน format เวลา
- `/cashier/index.html` bump cache เป็น `cashier.js?v=20260701-006`
- `cashier.js` import `ui.js?v=20260701-003`
- อัปเดต Developer Panel เป็น Version `0.12.25` Build `2026.07.01.006`

## Current Milestone

`O1-T001.1 Take Away Cashier Fix`

## Regression Tests สำคัญ

1. เปิด `/cashier/`
2. ต้องเห็นปุ่ม `เปิด QR Take Away` และ `คัดลอกลิงก์`
3. กดเปิด QR Take Away ต้องไปที่ `/s/{tenantSlug}/takeaway/` ถ้ามี tenant slug หรือ `/takeaway/` เป็น fallback
4. เปิด `/takeaway/`
5. กรอกชื่อหรือเบอร์โทรอย่างน้อย 1 อย่าง
6. เลือกเมนูและส่งออเดอร์ ต้องได้เลขคิว `TA-xxx`
7. หน้า Cashier ต้องแสดงวันที่/เวลา ไม่ใช่ `Invalid Date`
8. ออเดอร์ Take Away ต้องเข้า Kitchen ได้เหมือนออเดอร์ทั่วไป
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
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
