# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B005 Repository Layer`
- Developer Panel version/build ปัจจุบัน: `0.12.51` / `2026.07.02.005`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Take Away ส่งเข้าครัวและ Cashier แล้ว
- Food Order ปิดครบแล้ว

## Retail POS Status

ทำแล้ว:

- P9-B001 POS Firestore Foundation
- P9-B002 Running Number
- P9-B003 Counter
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver
- P9-B005 Repository Layer
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Current Milestone

`P9-B005 Repository Layer`

## Repository Layer

- `retail-pos-repository.js` เป็นชั้นกลางสำหรับ Local/Firebase access ของ POS
- รองรับ `createTenantRepository()` สำหรับสร้าง repository ตาม collection
- รองรับ `withTenantMeta()` เพื่อเติม tenant metadata อัตโนมัติ
- รองรับ `assertTenantRow()` เพื่อกันข้อมูลข้าม tenant
- มี repository กลาง: products, sales, stockMovements, shifts, returns, syncQueue, auditLogs, counters
- มี `POS_REPOSITORIES` สำหรับโมดูลถัดไปเรียกใช้จากจุดเดียว
- Local sale APIs เดิมยัง backward compatible

## Regression Tests

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

## Next Tasks

1. P9-B006 Firestore Composite Index
2. P9-B007 Audit Log
3. P9-B008 Shift Opening / Closing
4. P9-B009 Refund / Return / Void
5. P9-B010 Performance (Cache / Virtual List / Search)

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
