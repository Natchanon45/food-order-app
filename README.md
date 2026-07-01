# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B002 Running Number`
- Developer Panel version/build ปัจจุบัน: `0.12.48` / `2026.07.02.002`

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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline
- Running Number แยกตาม tenant และ document type

## Current Milestone

`P9-B002 Running Number`

## Running Number Foundation

- Counter แยกตาม `tenantId`
- Counter แยกตาม document type
- รองรับชนิดเอกสาร: `SALE`, `RECEIPT`, `TAX`, `REFUND`, `VOID`, `SHIFT`, `PURCHASE`, `STOCK`, `TRANSFER`
- รองรับ reset period: daily / monthly / yearly / none
- POS Sale เดิมยังใช้ `saleId` เป็น Stable ID
- Online Sale จองเลขผ่าน Firestore Transaction
- Offline Sale ใช้เลข PENDING ก่อน และรับเลขจริงตอน Sync

## Regression Tests

1. เปิด POS แล้วขายสินค้าออนไลน์ 1 บิล ต้องได้เลขบิลรูปแบบ `POS-YYYYMMDD-00001`
2. ขายออนไลน์บิลถัดไปวันเดียวกัน ต้องได้เลขต่อเนื่อง ไม่ซ้ำ
3. ปิดเน็ตแล้วขาย Offline ต้องได้เลข `PENDING` เดิมและไม่กระทบ Stable `saleId`
4. เปิดเน็ตให้ Offline Sync ต้องจองเลขจริงผ่าน Firestore transaction และไม่ซ้ำกับบิลออนไลน์
5. ตรวจ Firestore counter ของ tenant ต้องมี `documentType: SALE`, `periodKey`, `lastDocumentNumber`
6. ตรวจว่าสินค้าถูกตัดสต็อกครั้งเดียวต่อ `saleId`
7. Retry sync บิลเดิมซ้ำ ต้องไม่สร้าง sale หรือ stock movement ซ้ำ
8. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

1. P9-B003 Counter
2. P9-B004 Offline Queue Worker + Retry + Conflict Resolver
3. P9-B005 Repository Layer
4. P9-B006 Firestore Composite Index
5. P9-B007 Audit Log
6. P9-B008 Shift Opening / Closing
7. P9-B009 Refund / Return / Void
8. P9-B010 Performance (Cache / Virtual List / Search)

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
