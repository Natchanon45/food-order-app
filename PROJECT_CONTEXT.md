# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Take Away + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.52`
- Build: `2026.07.02.006`
- Branch: `feature/retail-pos`
- Milestone: `P9-B005 Repository Layer Hotfix`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation (P9-B001) เสร็จแล้ว
- P9-B002 Running Number เสร็จแล้ว
- P9-B003 Counter service กลางเสร็จแล้ว
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จแล้ว
- P9-B005 Repository Layer เสร็จแล้ว
- Hotfix: แก้ POS sale transaction permission denied ตอนอ่าน stable saleId ก่อน create

## Current Milestone

`P9-B005 Repository Layer Hotfix`

## แก้แล้วรอบนี้

- แก้ `firestore.rules` เฉพาะ `tenants/{tenantId}/sales/{saleId}`
- อนุญาตให้ POS Transaction อ่าน sale document ที่ยังไม่ถูกสร้าง เพื่อทำ Duplicate Protection ด้วย stable `saleId`
- ถ้า sale document มีอยู่แล้ว ยังจำกัดการอ่านไว้ที่ tenant member หรือ cashier เจ้าของบิล
- ไม่เปลี่ยน POS UI flow
- Developer Panel เป็น Version `0.12.52` Build `2026.07.02.006`

## Regression Tests สำคัญ

1. Deploy rules แล้วเปิด POS
2. ขาย Online 1 บิล ต้องบันทึกสำเร็จ ไม่มี permission denied ที่ `sales/sale-*`
3. เลขบิลต้องออกตามเดิม
4. Stock ต้องถูกตัดครั้งเดียว
5. ปิดเน็ตขาย Offline ได้ตามเดิม
6. เปิดเน็ตแล้ว Sync ได้ตามเดิม
7. ตรวจว่าไม่กระทบ Food Order / Delivery
8. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

1. P9-B006 Firestore Composite Index
2. P9-B007 Audit Log
3. P9-B008 Shift Opening / Closing
4. P9-B009 Refund / Return / Void
5. P9-B010 Performance (Cache / Virtual List / Search)

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
