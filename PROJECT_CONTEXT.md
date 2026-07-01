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

- Version: `0.12.38`
- Build: `2026.07.01.020`
- Branch: `feature/retail-pos`
- Milestone: `Order Completion & Receipt Print Fix`

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

## Current Milestone

`Order Completion & Receipt Print Fix`

## รายละเอียด Order Completion & Receipt Print Fix

แก้ปัญหา Take Away/Order ที่เสิร์ฟครบและรับชำระแล้วแต่ยังค้างในหน้า Cashier/Kitchen และแก้ print preview ของใบเสร็จที่มี UI หรือข้อความระบบติดไปในงานพิมพ์

แก้แล้ว:

- เพิ่ม `order-completion-finalizer.js`
- ถ้า order มี `status = served` และ `paymentStatus = paid` จะอัปเดตเป็น `status = paid`
- สำหรับ Take Away จะตั้ง `pickupStatus = picked_up` และ `pickedUpAt`
- `/cashier/index.html` โหลด `order-completion-finalizer.js?v=20260701-020`
- `/kitchen/index.html` โหลด `order-completion-finalizer.js?v=20260701-020`
- `receipt-layout.css` เพิ่ม print isolation ให้พิมพ์เฉพาะ `#receipt`
- `/cashier/receipt/index.html` bump `receipt-layout.css?v=20260701-020`
- Developer Panel เป็น Version `0.12.38` Build `2026.07.01.020`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด Take Away แล้วส่งเข้าครัว
3. ครัวกดเสิร์ฟครบทุก/ทั้งออเดอร์
4. Cashier รับชำระเงิน
5. ออเดอร์ต้องหายจากหน้า Cashier
6. ออเดอร์ต้องหายจากหน้า Kitchen
7. เปิดพิมพ์ใบเสร็จแล้วใน print preview ต้องเห็นเฉพาะข้อมูลใบเสร็จ
8. Header/toolbar/version/footer ของระบบต้องไม่ติดไปในงานพิมพ์

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
