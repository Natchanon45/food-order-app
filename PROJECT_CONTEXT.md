# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string กัน browser cache
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.12`
- Build: `2026.06.30.078`
- Branch: `feature/retail-pos`
- Milestone: `P9-B003.1 POS Menu Open Fix`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation P9-B001 เสร็จ
- P9-B002 Running Number เสร็จ
- P9-B002.1 Firestore Rules for Running Number เสร็จ
- P9-B002.2 POS Auth Warning Cleanup เสร็จ
- P9-B003 Counter เสร็จ
- P9-B003.1 แก้ POS menu ไม่เปิดเสร็จ

## รายละเอียด P9-B003.1

จากไฟล์จริงพบว่า `retail-pos-navigation.js` เพิ่ม class `open` ตอนกดปุ่มเมนู แต่ `retail-pos-navigation.css` แสดงผลเฉพาะ `.is-open` ทำให้กดปุ่มแล้ว panel ไม่เปิด

แก้แล้ว:

- `retail-pos-navigation.css` รองรับทั้ง `.pos-menu-popover.is-open` และ `.pos-menu-popover.open`
- `/pos/index.html` bump CSS cache เป็น `retail-pos-navigation.css?v=20260630-078`
- app info bump เป็น `0.12.12 / 2026.06.30.078`

## Current Milestone

`P9-B003.1 POS Menu Open Fix`

## Regression Tests สำคัญ

1. เปิด `/pos`
2. ปุ่มเมนูต้องมี hamburger icon แค่ตัวเดียว
3. กดปุ่มเมนูแล้ว panel ต้องเปิด
4. กด backdrop หรือปุ่ม X แล้ว panel ต้องปิด
5. ขาย online 2 บิลในวันเดียวกัน counter ต้องเพิ่มต่อเนื่อง
6. offline sync ต้องได้เลขจริงและไม่ตัด stock ซ้ำ

## งานถัดไป

1. P9-B004 Offline Queue Worker + Retry + Conflict Resolver
2. P9-B005 Repository Layer
3. P9-B006 Firestore Composite Index
4. P9-B007 Audit Log
5. P9-B008 Shift Opening / Closing

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable `saleId` เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
