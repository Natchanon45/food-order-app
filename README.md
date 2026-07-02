# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B010 Manual Sync Hotfix`
- Developer Panel version/build ปัจจุบัน: `0.12.58` / `2026.07.02.012`

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
- P9-B010 Performance
- Hotfix Manual Sync
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Current Milestone

`P9-B010 Manual Sync Hotfix`

## Manual Sync Hotfix

- แก้ `retail-pos-sync-status.js` ให้ใช้ Offline Queue Worker version ล่าสุด
- แก้ `retail-pos-sync-status.js` ให้ใช้ Repository Layer version ล่าสุด
- เพิ่มการฟัง event `retail-offline-queue-worker`
- ปุ่ม Manual Sync เรียก Worker ล่าสุดโดยตรง
- `/pos/index.html` โหลด `retail-pos-sync-status.js?v=20260702-012`

## Regression Tests

1. เปิด POS แล้วต้องเห็น Badge `รอ Sync 1` ถ้ามี pending sale
2. ขณะ Online ปุ่ม `Sync` ต้องกดได้
3. กด `Sync` แล้วปุ่มต้องเปลี่ยนเป็น `กำลัง Sync...`
4. Sync สำเร็จแล้ว Badge ต้องหายหรือจำนวน pending ลดลง
5. ขณะ Offline ปุ่มต้องขึ้น `Offline` และกดไม่ได้
6. Failed sale ต้องขึ้นปุ่ม `Retry`
7. ขาย Online ได้ตามเดิม
8. ขาย Offline และกลับมา Sync ได้ตามเดิม
9. ตรวจว่าไม่กระทบ Order / Delivery commit `167dd48`
10. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

- POS Roadmap P9-B001 ถึง P9-B010 เสร็จครบแล้ว
- งานถัดไปควรเป็นรอบ Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
