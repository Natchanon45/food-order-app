# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B009 Refund / Return / Void`
- Developer Panel version/build ปัจจุบัน: `0.12.56` / `2026.07.02.010`

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
- P9-B006 Firestore Composite Index
- P9-B007 Audit Log
- P9-B008 Shift Opening / Closing
- P9-B009 Refund / Return / Void
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Current Milestone

`P9-B009 Refund / Return / Void`

## Return Service

- เพิ่ม `public/assets/js/retail-pos-return.js`
- รองรับ `createReturn()`
- รองรับ `createRefund()`
- รองรับ `createVoid()`
- คืน Stock ด้วย stock movement แบบ `direction: in`
- อัปเดต Sale ต้นทางด้วย `returns` และ `refundTotal`
- เขียน Audit Log สำหรับ return / void

## Regression Tests

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

## Next Tasks

1. P9-B010 Performance (Cache / Virtual List / Search)

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
