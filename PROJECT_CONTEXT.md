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

- Version: `0.12.48`
- Build: `2026.07.02.002`
- Branch: `feature/retail-pos`
- Milestone: `P9-B002 Running Number`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation (P9-B001) เสร็จแล้ว
- P9-B002 Running Number เสร็จแกนกลางแล้ว
- Running Number รองรับ SALE / RECEIPT / TAX / REFUND / VOID / SHIFT / PURCHASE / STOCK / TRANSFER
- Running Number แยกตาม `tenantId`, document type และ reset period
- POS Sale เดิมยังใช้ `saleId` เดิมเป็น Stable ID และใช้เลขเอกสารจาก counter กลาง

## Current Milestone

`P9-B002 Running Number`

## แก้แล้วรอบนี้

- `retail-pos-firestore-foundation.js` เพิ่ม `RUNNING_NUMBER_TYPES`
- เพิ่ม helper กลาง `runningNumberConfig`, `periodKeyFrom`, `counterIdForRunningNumber`, `buildDocumentNumber`
- ปรับ `buildCounterRow` ให้รองรับ document type / prefix / reset / periodKey / lastDocumentId / lastDocumentNumber
- คง backward compatibility ของ `buildRunningNumber`, `counterIdForDate`, และ `buildCounterRow` สำหรับ POS Sale เดิม
- เพิ่ม `POS_COLLECTIONS.runningNumbers` สำหรับ Milestone ถัดไปที่ต้องแยก counter/setting เพิ่มเติม
- Developer Panel เป็น Version `0.12.48` Build `2026.07.02.002`

## Regression Tests สำคัญ

1. เปิด POS แล้วขายสินค้าออนไลน์ 1 บิล ต้องได้เลขบิลรูปแบบ `POS-YYYYMMDD-00001`
2. ขายออนไลน์บิลถัดไปวันเดียวกัน ต้องได้เลขต่อเนื่อง ไม่ซ้ำ
3. ปิดเน็ตแล้วขาย Offline ต้องได้เลข `PENDING` เดิมและไม่กระทบ Stable `saleId`
4. เปิดเน็ตให้ Offline Sync ต้องจองเลขจริงผ่าน Firestore transaction และไม่ซ้ำกับบิลออนไลน์
5. ตรวจ Firestore counter ของ tenant ต้องมี `documentType: SALE`, `periodKey`, `lastDocumentNumber`
6. ตรวจว่าสินค้าถูกตัดสต็อกครั้งเดียวต่อ `saleId`
7. Retry sync บิลเดิมซ้ำ ต้องไม่สร้าง sale หรือ stock movement ซ้ำ
8. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

1. P9-B003 Counter
2. P9-B004 Offline Queue Worker + Retry + Conflict Resolver
3. P9-B005 Repository Layer
4. P9-B006 Firestore Composite Index
5. P9-B007 Audit Log
6. P9-B008 Shift Opening / Closing
7. P9-B009 Refund / Return / Void
8. P9-B010 Performance (Cache / Virtual List / Search)

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
