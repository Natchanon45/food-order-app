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

- Version: `0.12.42`
- Build: `2026.07.01.024`
- Branch: `feature/retail-pos`
- Milestone: `Table Move Customer Session Fix`

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
- Table Move Customer Session: หลัง Cashier เปลี่ยนโต๊ะ หน้าลูกค้ายังเห็นรายการเดิมด้วย stable `tableToken` และสั่งรอบถัดไปต่อเนื่อง

## Current Milestone

`Table Move Customer Session Fix`

## รายละเอียด Table Move Customer Session Fix

แก้ปัญหา Cashier เปลี่ยนโต๊ะแล้ว Kitchen/Cashier เห็นรายการถูกต้อง แต่หน้าลูกค้าไม่เห็นรายการเดิมและรอบการสั่งกลับเป็นรอบที่ 1

แก้แล้ว:

- `customer-secure.js` ใช้ stable `tableToken` เป็นตัวตาม session หลังย้ายโต๊ะ
- `customer-secure.js` fallback หาโต๊ะ active ใหม่จาก `orderToken` เดิม ถ้า URL ยังเป็นโต๊ะเดิม
- `customer-secure.js` patch `createTableOrder()` ให้ส่ง order ใหม่เข้าโต๊ะ active ล่าสุดของ token นั้น
- `customer-secure.js` subscribe order ด้วย `tableToken` เพื่อให้รายการเดิมยังแสดงหลังย้ายโต๊ะ
- `/order/index.html` bump `customer-secure.js?v=20260701-024`
- Developer Panel เป็น Version `0.12.42` Build `2026.07.01.024`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิดโต๊ะ A แล้วสั่งอาหารจาก QR
3. Kitchen/Cashier ต้องเห็นออเดอร์โต๊ะ A
4. Cashier เปลี่ยนโต๊ะ A ไปโต๊ะ B
5. หน้า Cashier/Kitchen ต้องยังเห็นรายการเดิมภายใต้โต๊ะใหม่
6. หน้าลูกค้าต้องยังเห็นรายการที่สั่งแล้วจาก session เดิม
7. รอบการสั่งถัดไปต้องต่อจากรอบเดิม ไม่กลับเป็นรอบที่ 1
8. กดสั่งเพิ่มหลังย้ายโต๊ะแล้วออเดอร์ใหม่ต้องเข้าโต๊ะที่ active ใหม่

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
