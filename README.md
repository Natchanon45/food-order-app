# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B003.1 POS Menu Open Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.12` / `2026.06.30.078`

## Retail POS Status

ทำแล้ว:

- POS รองรับ online/offline/sync/tenant
- ใช้ stable `saleId` เดียวกันทั้ง online/offline
- กัน duplicate ด้วย `sales/{saleId}`
- กันตัด stock ซ้ำด้วย deterministic stock movement id `${saleId}_${productId}`
- เพิ่ม Running Number `POS-YYYYMMDD-00001`
- เพิ่ม Counter metadata helper `buildCounterRow()`
- แก้ hamburger icon ซ้ำ
- แก้ปุ่มเมนู POS กดแล้วไม่เปิด โดยให้ CSS รองรับ class `open` และ `is-open`
- bump CSS cache ของ `/pos/index.html` เป็น `20260630-078`

## Current Milestone

`P9-B003.1 POS Menu Open Fix`

## Regression Tests

1. เปิด `/pos`
2. ปุ่มเมนูต้องมี hamburger icon แค่ 1 จุด
3. กดปุ่มเมนูแล้ว panel ต้องเปิด
4. กด backdrop หรือปุ่มปิดแล้ว panel ต้องปิด
5. ขาย online 2 บิลแล้ว counter ต้องเพิ่มต่อเนื่อง
6. offline sync ต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

## Next Tasks

1. P9-B004 Offline Queue Worker + Retry + Conflict Resolver
2. P9-B005 Repository Layer
3. P9-B006 Firestore Composite Index
4. P9-B007 Audit Log

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string เพื่อกัน browser cache
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
