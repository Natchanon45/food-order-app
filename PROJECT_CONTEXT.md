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

- Version: `0.12.51`
- Build: `2026.07.02.005`
- Branch: `feature/retail-pos`
- Milestone: `P9-B005 Repository Layer`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation (P9-B001) เสร็จแล้ว
- P9-B002 Running Number เสร็จแล้ว
- P9-B003 Counter service กลางเสร็จแล้ว
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จแล้ว
- P9-B005 Repository Layer เสร็จแล้ว
- Repository Layer แยก Local/Firebase access ให้เรียกผ่าน repository กลาง

## Current Milestone

`P9-B005 Repository Layer`

## แก้แล้วรอบนี้

- ขยาย `retail-pos-repository.js` ให้เป็น Repository Layer กลางของ POS
- เพิ่ม `createTenantRepository()` สำหรับสร้าง repository ของ collection ภายใต้ tenant
- เพิ่ม `withTenantMeta()` เพื่อเติม `tenantId`, `shopId`, `schemaVersion`, `updatedAt`
- เพิ่ม `assertTenantRow()` เพื่อป้องกันบันทึกข้อมูลข้าม tenant
- เพิ่ม `normalizeRepositoryId()` สำหรับหา stable id ของ row
- เพิ่ม local repository สำหรับ `syncQueue`
- เพิ่ม repository กลาง: products, sales, stockMovements, shifts, returns, syncQueue, auditLogs, counters
- เพิ่ม `POS_REPOSITORIES` สำหรับโมดูลถัดไปนำไปใช้จากจุดเดียว
- เพิ่ม `upsertLocalSale()` และ `listPendingLocalSales()` สำหรับ Offline Queue Worker รุ่นถัดไป
- Developer Panel เป็น Version `0.12.51` Build `2026.07.02.005`

## Regression Tests สำคัญ

1. เปิด POS แล้วขาย Online ได้ตามเดิม
2. ปิดเน็ตแล้วขาย Offline ได้ตามเดิม
3. เปิดเน็ตแล้ว Sync ได้ตามเดิม
4. Local sale APIs เดิม `listLocalSales`, `saveLocalSales`, `updateLocalSale`, `localSaleId` ยังใช้ได้
5. `posSalesRepository.tenantId()` ต้องคืน tenant ปัจจุบัน
6. Repository save ต้องเติม `tenantId` และ `shopId`
7. ถ้าส่ง row ที่มี `tenantId` ไม่ตรง tenant ต้องแจ้ง error `POS_REPOSITORY_TENANT_MISMATCH`
8. `POS_REPOSITORIES` ต้องมี products, sales, stockMovements, shifts, returns, syncQueue, auditLogs, counters
9. ตรวจว่าไม่กระทบ Food Order / Delivery
10. ตรวจว่า record สำคัญยังมี `tenantId`

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
