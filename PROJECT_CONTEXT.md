# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Take Away + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.58`
- Build: `2026.07.02.012`
- Branch: `feature/retail-pos`
- Milestone: `P9-B010 Manual Sync Hotfix`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation (P9-B001) เสร็จแล้ว
- P9-B002 Running Number เสร็จแล้ว
- P9-B003 Counter service กลางเสร็จแล้ว
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จแล้ว
- P9-B005 Repository Layer เสร็จแล้ว
- P9-B006 Firestore Composite Index เสร็จแล้ว
- P9-B007 Audit Log เสร็จแล้ว
- P9-B008 Shift Opening / Closing เสร็จแกนกลางแล้ว
- P9-B009 Refund / Return / Void เสร็จแกนกลางแล้ว
- P9-B010 Performance เสร็จแล้ว
- Hotfix: Manual Sync ใช้ Offline Queue Worker และ Repository version ล่าสุดแล้ว

## Current Milestone

`P9-B010 Manual Sync Hotfix`

## แก้แล้วรอบนี้

- แก้ `retail-pos-sync-status.js` ให้ import `retail-offline-sale-sync.js?v=20260702-004`
- แก้ `retail-pos-sync-status.js` ให้ import `retail-pos-repository.js?v=20260702-005`
- เพิ่มการฟัง event `retail-offline-queue-worker`
- Manual Sync เรียก `retryFailedOfflineSales()` และ `syncOfflineSalesToFirebase({ forceRetry: true })` จาก Worker ล่าสุด
- ปรับสถานะปุ่มให้แยก `Offline`, `กำลัง Sync...`, `Retry`, `Sync`
- `/pos/index.html` bump `retail-pos-sync-status.js?v=20260702-012`
- Developer Panel เป็น Version `0.12.58` Build `2026.07.02.012`

## Regression Tests สำคัญ

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

## งานถัดไป

- POS Roadmap P9-B001 ถึง P9-B010 เสร็จครบแล้ว
- งานถัดไปควรเป็นรอบ Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
