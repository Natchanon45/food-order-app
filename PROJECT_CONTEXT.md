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

- Version: `0.12.40`
- Build: `2026.07.01.022`
- Branch: `feature/retail-pos`
- Milestone: `Kitchen Visual Cues`

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

## Current Milestone

`Kitchen Visual Cues`

## รายละเอียด Kitchen Visual Cues

แก้เฉพาะ UI ของหน้าครัว เพื่อให้พนักงานมองสถานะและ action สำคัญได้เร็วขึ้น โดยไม่เปลี่ยน workflow สถานะออเดอร์หรือ Firestore logic

แก้แล้ว:

- `kitchen.js` เพิ่ม class `kitchen-accept-action`, `kitchen-start-action`, `kitchen-ready-action`
- `kitchen.js` เพิ่มการตรวจออเดอร์รอนานเกิน 15 นาทีสำหรับสถานะ `pending`, `accepted`, `cooking`
- `kitchen-item-editor.css` เพิ่ม pulse animation ให้ปุ่ม `รับออเดอร์`
- `kitchen-item-editor.css` คง hourglass animation ของปุ่ม `เริ่มทำ`
- `kitchen-item-editor.css` เพิ่ม check pop animation ให้ปุ่ม `พร้อมเสิร์ฟ/พร้อมจัดส่ง`
- `kitchen-item-editor.css` เพิ่ม highlight สีส้มอ่อนและ badge `รอนาน xx นาที` สำหรับออเดอร์รอนาน
- รองรับ `prefers-reduced-motion` โดยปิด animation ถ้าผู้ใช้ตั้งค่าลด motion
- `/kitchen/index.html` bump `kitchen.js?v=20260701-022`
- `/kitchen/index.html` bump `kitchen-item-editor.css?v=20260701-022`
- Developer Panel เป็น Version `0.12.40` Build `2026.07.01.022`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด Kitchen
3. ออเดอร์สถานะ `pending` ต้องแสดงปุ่ม `รับออเดอร์` พร้อม pulse เบา ๆ
4. ออเดอร์สถานะ `accepted` ต้องแสดงปุ่ม `เริ่มทำ` พร้อม hourglass animation
5. ออเดอร์สถานะ `cooking` ต้องแสดงปุ่ม `พร้อมเสิร์ฟ/พร้อมจัดส่ง` พร้อม check animation
6. ออเดอร์ที่รอนานเกิน 15 นาทีต้องมี badge `รอนาน xx นาที` และ highlight สีส้มอ่อน
7. กดปุ่มสถานะทั้งหมดแล้ว workflow ต้องยังทำงานเหมือนเดิม

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
