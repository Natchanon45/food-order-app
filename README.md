# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B003 Counter`
- Developer Panel version/build ปัจจุบัน: `0.12.49` / `2026.07.02.003`

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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline
- Counter แยกตาม tenant, document type และ reset period

## Current Milestone

`P9-B003 Counter`

## Counter Service

- เพิ่ม `public/assets/js/retail-pos-counter.js`
- รองรับ `counterScope()` สำหรับหา scope ของเลขเอกสาร
- รองรับ `counterRef()` สำหรับอ้างอิง Firestore counter
- รองรับ `nextCounterSnapshot()` สำหรับคำนวณเลขถัดไปหลังอ่าน counter แล้ว
- รองรับ `buildCounterCommit()` สำหรับสร้าง payload update counter
- รองรับ `reserveRunningNumber()` สำหรับใช้ใน Firestore Transaction
- รองรับ `pendingDocumentNumber()` สำหรับ Offline/PENDING

## Regression Tests

1. เปิด POS แล้วขายสินค้าออนไลน์ 1 บิล ต้องบันทึกบิลได้ตามเดิม
2. เลขบิลออนไลน์ยังต้องเป็น `POS-YYYYMMDD-xxxxx`
3. ขายหลายบิลวันเดียวกัน เลขต้องต่อเนื่อง ไม่ซ้ำ
4. ปิดเน็ตแล้วขาย Offline ต้องได้เลข PENDING และยังคง Stable `saleId`
5. เปิดเน็ตให้ Sync ต้องจองเลขจริงผ่าน counter เดิม ไม่ซ้ำกับ Online Sale
6. ตรวจ counter document ต้องมี `documentType`, `periodKey`, `lastDocumentId`, `lastDocumentNumber`
7. Retry sync บิลเดิมซ้ำ ต้องไม่ตัด Stock ซ้ำ
8. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

1. P9-B004 Offline Queue Worker + Retry + Conflict Resolver
2. P9-B005 Repository Layer
3. P9-B006 Firestore Composite Index
4. P9-B007 Audit Log
5. P9-B008 Shift Opening / Closing
6. P9-B009 Refund / Return / Void
7. P9-B010 Performance (Cache / Virtual List / Search)

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
