# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B008 Shift Opening / Closing`
- Developer Panel version/build ปัจจุบัน: `0.12.55` / `2026.07.02.009`

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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Current Milestone

`P9-B008 Shift Opening / Closing`

## Shift Service

- เพิ่ม `public/assets/js/retail-pos-shift.js`
- รองรับ `openShift()` สำหรับเปิดกะ
- รองรับ `closeShift()` สำหรับปิดกะ
- รองรับ `getActiveShiftLocal()` สำหรับอ่านกะที่เปิดอยู่
- รองรับเลข Shift จาก Running Number กลาง
- เขียน Audit Log ตอนเปิดกะและปิดกะ

## Regression Tests

1. เปิด POS แล้วขาย Online ได้ตามเดิม
2. Offline Sync ต้องทำงานได้ตามเดิม
3. เรียก `openShift()` ต้องสร้างเอกสารใน `shifts` พร้อม `tenantId`, `status: open`, `openingCash`
4. เปิดกะแล้ว localStorage ต้องมี `retail_pos_active_shift_v1`
5. เรียก `closeShift()` ต้องอัปเดต `status: closed`, `closingCash`, `expectedCash`, `cashDifference`
6. ปิดกะแล้ว localStorage ต้องล้าง active shift
7. ตรวจ auditLogs ต้องมี `pos_shift_opened` และ `pos_shift_closed`
8. ตรวจว่าไม่กระทบ Food Order / Delivery
9. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

1. P9-B009 Refund / Return / Void
2. P9-B010 Performance (Cache / Virtual List / Search)

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
