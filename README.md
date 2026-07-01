# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B005 Repository Layer Hotfix`
- Developer Panel version/build ปัจจุบัน: `0.12.52` / `2026.07.02.006`

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
- Hotfix POS sale transaction permission
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Current Milestone

`P9-B005 Repository Layer Hotfix`

## Hotfix

- แก้ `firestore.rules` สำหรับ POS sale transaction
- Transaction สามารถอ่าน sale document ที่ยังไม่ถูกสร้าง เพื่อทำ Duplicate Protection ด้วย stable `saleId`
- ถ้า sale document มีอยู่แล้ว ยังจำกัดการอ่านไว้ที่ tenant member หรือ cashier เจ้าของบิล
- ต้อง deploy Firestore rules ด้วย

## Regression Tests

1. Deploy rules แล้วเปิด POS
2. ขาย Online 1 บิล ต้องบันทึกสำเร็จ ไม่มี permission denied ที่ `sales/sale-*`
3. เลขบิลต้องออกตามเดิม
4. Stock ต้องถูกตัดครั้งเดียว
5. ปิดเน็ตขาย Offline ได้ตามเดิม
6. เปิดเน็ตแล้ว Sync ได้ตามเดิม
7. ตรวจว่าไม่กระทบ Food Order / Delivery
8. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

1. P9-B006 Firestore Composite Index
2. P9-B007 Audit Log
3. P9-B008 Shift Opening / Closing
4. P9-B009 Refund / Return / Void
5. P9-B010 Performance (Cache / Virtual List / Search)

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only firestore:rules,hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
