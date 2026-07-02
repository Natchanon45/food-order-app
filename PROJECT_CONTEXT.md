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

- Version: `0.12.56`
- Build: `2026.07.02.010`
- Branch: `feature/retail-pos`
- Milestone: `P9-B009 Refund / Return / Void`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation (P9-B001) เสร็จแล้ว
- P9-B002 Running Number เสร็จแล้ว
- P9-B003 Counter service กลางเสร็จแล้ว
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จแล้ว
- P9-B005 Repository Layer เสร็จแล้ว
- P9-B006 Firestore Composite Index เสร็จแล้ว
- P9-B007 Audit Log เสร็จแล้ว
- P9-B008 Shift Opening / Closing เสร็จแกนกลางแล้ว
- P9-B009 Refund / Return / Void เสร็จแกนกลางแล้ว

## Current Milestone

`P9-B009 Refund / Return / Void`

## แก้แล้วรอบนี้

- เพิ่ม `retail-pos-return.js` เป็น Service กลางสำหรับ Return / Refund / Void
- เพิ่ม `createReturn()`, `createRefund()`, `createVoid()`
- อ่าน Sale และ Product ก่อน แล้วค่อยจองเลขเอกสารและ Write ตามกติกา Firestore Transaction
- คืน Stock ด้วย stock movement แบบ `type: return`, `direction: in`
- อัปเดต Sale ด้วย `returns` และ `refundTotal` เพื่อกันคืนซ้ำ
- ใช้ Running Number กลางสำหรับ REFUND และ VOID
- เขียน Audit Log สำหรับ return / void
- ผูก active shift จาก `retail-pos-shift.js` ถ้ามีกะเปิดอยู่
- Developer Panel เป็น Version `0.12.56` Build `2026.07.02.010`

## Regression Tests สำคัญ

1. เปิด POS แล้วขาย Online ได้ตามเดิม
2. เรียก `createReturn({ saleId, items })` ต้องสร้างเอกสารใน `returns`
3. Stock ของสินค้าที่คืนต้องเพิ่มกลับตามจำนวนคืน
4. Sale ต้นทางต้องมี `returns` และ `refundTotal`
5. คืนสินค้าซ้ำเกินจำนวนขายต้องแจ้ง error `RETURN_QTY_EXCEEDS_REMAINING`
6. ตรวจ stockMovements ต้องมีรายการ `direction: in`
7. ตรวจ auditLogs ต้องมีรายการ return หรือ void
8. Offline Sync ต้องทำงานได้ตามเดิม
9. ตรวจว่าไม่กระทบ Food Order / Delivery
10. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

1. P9-B010 Performance (Cache / Virtual List / Search)

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
