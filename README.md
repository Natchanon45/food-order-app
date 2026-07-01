# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B006 Firestore Composite Index`
- Developer Panel version/build ปัจจุบัน: `0.12.53` / `2026.07.02.007`

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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Current Milestone

`P9-B006 Firestore Composite Index`

## Composite Indexes

- เพิ่ม index สำหรับ sales reporting/filter
- เพิ่ม index สำหรับ stock movements ตาม product/date/reference
- เพิ่ม index สำหรับ syncQueue ตาม channel/status/updatedAt
- เพิ่ม index สำหรับ auditLogs ตาม entity/action/user
- เพิ่ม index สำหรับ returns ตาม sale/status/user
- รอบนี้ต้อง deploy Firestore indexes ด้วย

## Regression Tests

1. Deploy indexes แล้วรอ Firebase ทำงานจนเสร็จ
2. เปิด POS แล้วขาย Online ได้ตามเดิม
3. เปิดรายงานยอดขายรายวัน/รายเดือนต้องไม่ขึ้น error เรื่อง index
4. ค้นหาข้อมูล sales ตาม cashier/shift/date ต้องพร้อมรองรับ
5. ตรวจ stock movements ตาม product/date/reference ต้องพร้อมรองรับ
6. ตรวจ syncQueue ตาม status ต้องพร้อมรองรับ
7. ตรวจ auditLogs ตาม action/entity/createdBy ต้องพร้อมรองรับ
8. ตรวจ returns ตาม sale/status/user ต้องพร้อมรองรับ
9. ตรวจว่าไม่กระทบ Food Order / Delivery
10. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

1. P9-B007 Audit Log
2. P9-B008 Shift Opening / Closing
3. P9-B009 Refund / Return / Void
4. P9-B010 Performance (Cache / Virtual List / Search)

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only firestore:indexes,hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
