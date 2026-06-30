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

- Version: `0.12.14`
- Build: `2026.06.30.080`
- Branch: `feature/retail-pos`
- Milestone: `P9-B004.1 POS Menu Spacing`

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
- P9-B003.1 POS Menu Open Fix เสร็จ
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จ
- P9-B004.1 POS Menu Spacing เสร็จ

## รายละเอียด P9-B004.1

แก้จากไฟล์จริง `retail-pos-navigation.css`

ทำแล้ว:

- เพิ่ม padding ของ drawer ทั้ง PC และ Mobile
- เพิ่มระยะห่างระหว่างกล่องข้อมูลผู้ใช้กับเมนูแรก
- เพิ่มระยะห่างระหว่างกลุ่มเมนู POS
- เพิ่มความสูงขั้นต่ำของ accordion header และ link ให้กดง่ายขึ้น
- เพิ่มระยะห่างก่อนปุ่มออกจากระบบ
- `/pos/index.html` bump cache เป็น `retail-pos-navigation.css?v=20260630-080`

## Current Milestone

`P9-B004.1 POS Menu Spacing`

## Regression Tests สำคัญ

1. เปิด `/pos`
2. กดปุ่มเมนูแล้ว panel ต้องเปิดได้
3. ระยะห่างกลุ่มเมนูต้องโปร่งขึ้นทั้ง PC และ Mobile
4. ปุ่มเมนูย่อยต้องกดง่ายขึ้น
5. ปุ่มออกจากระบบต้องไม่ชิดรายการเมนูสุดท้าย
6. offline sync ยังต้องทำงานตาม P9-B004

## งานถัดไป

1. P9-B005 Repository Layer
2. P9-B006 Firestore Composite Index
3. P9-B007 Audit Log
4. P9-B008 Shift Opening / Closing
5. P9-B009 Refund / Return / Void

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable `saleId` เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
