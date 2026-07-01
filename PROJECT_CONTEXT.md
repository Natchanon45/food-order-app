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

- Version: `0.12.30`
- Build: `2026.07.01.012`
- Branch: `feature/retail-pos`
- Milestone: `Take Away Kitchen Served Flow`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
- Kitchen แสดง Take Away ด้วยเลขคิว ไม่ปนกับโต๊ะจริง
- Kitchen Take Away มีปุ่ม `เสิร์ฟแล้ว` หลังสถานะพร้อมเสิร์ฟ
- Take Away ที่เป็นสถานะ `served` แล้วจะแก้ไขหรือยกเลิกไม่ได้ เหมือนออเดอร์นั่งทานที่ร้าน
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- หน้า Admin มี QR สำหรับ Delivery และ QR สำหรับสั่งกลับบ้าน
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- P9-B001 ถึง P9-B009 เสร็จแล้ว

## รายละเอียด Take Away Kitchen Served Flow

ปรับหน้าครัวให้ Take Away ใช้ workflow เหมือนการสั่งผ่าน QR โต๊ะ เมื่อครัวทำอาหารเสร็จและกดเสิร์ฟแล้ว รายการจะไม่สามารถแก้ไขหรือลบได้อีก

แก้แล้ว:

- `kitchen.js` เพิ่ม action `ready -> served` สำหรับ Take Away
- ปุ่มหลังทำเสร็จแสดง `เสิร์ฟแล้ว`
- เมื่อกด `เสิร์ฟแล้ว` จะอัปเดต `status = served` และ `servedAt`
- สำหรับ Take Away จะตั้ง `pickupStatus = served`
- เมื่อ `status = served` แล้ว `isKitchenLocked()` จะซ่อนปุ่มแก้ไขและยกเลิกทั้งหมด
- `/kitchen/index.html` bump cache เป็น `kitchen.js?v=20260701-012`
- Developer Panel เป็น Version `0.12.30` Build `2026.07.01.012`

## Current Milestone

`Take Away Kitchen Served Flow`

## Regression Tests สำคัญ

1. Deploy hosting ใหม่
2. เปิด `/s/{tenantSlug}/takeaway`
3. ส่ง Take Away ให้เข้า Kitchen
4. หน้า Kitchen ต้องแสดง `Take Away: TA-xxx`
5. กดรับออเดอร์ > เริ่มทำ > พร้อมเสิร์ฟ
6. หลังพร้อมเสิร์ฟต้องเห็นปุ่ม `เสิร์ฟแล้ว`
7. กด `เสิร์ฟแล้ว` แล้วรายการต้องเป็นสถานะ `served`
8. หลัง served ต้องไม่มีปุ่มแก้ไขรายการ
9. หลัง served ต้องไม่มีปุ่มยกเลิกรายการหรือยกเลิกทั้งออเดอร์
10. QR โต๊ะนั่งทานที่ร้านต้องยังทำงานเหมือนเดิม

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
