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

- Version: `0.12.49`
- Build: `2026.07.02.003`
- Branch: `feature/retail-pos`
- Milestone: `P9-B003 Counter`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation (P9-B001) เสร็จแล้ว
- P9-B002 Running Number เสร็จแล้ว
- P9-B003 Counter service กลางเสร็จแล้ว
- Counter รองรับ Firestore Transaction และยังรักษา Stable `saleId`
- Counter แยกตาม `tenantId`, document type และ reset period

## Current Milestone

`P9-B003 Counter`

## แก้แล้วรอบนี้

- เพิ่ม `retail-pos-counter.js` เป็น Counter Service กลางของ POS
- เพิ่ม `counterScope()` เพื่อคำนวณ tenant / document type / dateKey / periodKey / counterId
- เพิ่ม `counterRef()` สำหรับอ้างอิง Firestore counter ของ tenant ปัจจุบัน
- เพิ่ม `nextCounterSnapshot()` เพื่อคำนวณเลขถัดไปจาก snapshot ที่อ่านแล้ว
- เพิ่ม `buildCounterCommit()` เพื่อสร้าง payload สำหรับ commit counter
- เพิ่ม `reserveRunningNumber()` สำหรับใช้ภายใน Firestore Transaction โดยบังคับ Read ก่อน Write
- เพิ่ม `pendingDocumentNumber()` สำหรับเลข Offline/PENDING ที่ผูกกับ Stable ID
- Developer Panel เป็น Version `0.12.49` Build `2026.07.02.003`

## Regression Tests สำคัญ

1. เปิด POS แล้วขายสินค้าออนไลน์ 1 บิล ต้องบันทึกบิลได้ตามเดิม
2. เลขบิลออนไลน์ยังต้องเป็น `POS-YYYYMMDD-xxxxx`
3. ขายหลายบิลวันเดียวกัน เลขต้องต่อเนื่อง ไม่ซ้ำ
4. ปิดเน็ตแล้วขาย Offline ต้องได้เลข PENDING และยังคง Stable `saleId`
5. เปิดเน็ตให้ Sync ต้องจองเลขจริงผ่าน counter เดิม ไม่ซ้ำกับ Online Sale
6. ตรวจ counter document ต้องมี `documentType`, `periodKey`, `lastDocumentId`, `lastDocumentNumber`
7. Retry sync บิลเดิมซ้ำ ต้องไม่ตัด Stock ซ้ำ
8. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

1. P9-B004 Offline Queue Worker + Retry + Conflict Resolver
2. P9-B005 Repository Layer
3. P9-B006 Firestore Composite Index
4. P9-B007 Audit Log
5. P9-B008 Shift Opening / Closing
6. P9-B009 Refund / Return / Void
7. P9-B010 Performance (Cache / Virtual List / Search)

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
