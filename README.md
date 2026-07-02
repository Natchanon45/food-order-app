# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B010 Performance (Cache / Virtual List / Search)`
- Developer Panel version/build ปัจจุบัน: `0.12.57` / `2026.07.02.011`

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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Current Milestone

`P9-B010 Performance (Cache / Virtual List / Search)`

## Performance Layer

- เพิ่ม `public/assets/js/retail-pos-performance.js`
- Debounce การค้นหาสินค้า
- จำกัด product card ที่แสดงบน DOM ครั้งละ 96 รายการ
- แสดงข้อความแนะนำให้ค้นหาเมื่อผลลัพธ์มากเกินไป
- เพิ่ม performance snapshot ใน `sessionStorage`
- `/pos/index.html` โหลด `retail-pos-performance.js?v=20260702-011`

## Regression Tests

1. เปิด POS แล้วโหลดสินค้าต้องเร็วขึ้นเมื่อมีสินค้าจำนวนมาก
2. ถ้ามีสินค้ามากกว่า 96 รายการ ต้องเห็นข้อความแนะนำให้ค้นหา
3. ค้นหาสินค้าด้วยชื่อ / รหัส / บาร์โค้ด ต้องเจอสินค้าเดิม
4. กดเพิ่มสินค้าเข้าตะกร้าได้ตามเดิม
5. สแกนบาร์โค้ดแล้วเพิ่มสินค้าได้ตามเดิม
6. ขาย Online ได้ตามเดิม
7. ขาย Offline และ Sync ได้ตามเดิม
8. ตรวจ `window.retailPosPerformance.version` ต้องเป็น `P9-B010`
9. ตรวจว่าไม่กระทบ Order / Delivery commit `5c96d34` และ `4c0984d`
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
