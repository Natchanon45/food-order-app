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

- Version: `0.12.55`
- Build: `2026.07.02.009`
- Branch: `feature/retail-pos`
- Milestone: `P9-B008 Shift Opening / Closing`

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

## Current Milestone

`P9-B008 Shift Opening / Closing`

## แก้แล้วรอบนี้

- เพิ่ม `retail-pos-shift.js` เป็น Shift Service กลางของ POS
- เพิ่ม `openShift()` สำหรับเปิดกะผ่าน Firestore Transaction
- เพิ่ม `closeShift()` สำหรับปิดกะผ่าน Firestore Transaction
- เพิ่ม `getActiveShiftLocal()` เพื่ออ่านกะที่เปิดอยู่จาก localStorage
- เพิ่ม `buildOpenShiftRow()` และ `buildClosedShiftRow()`
- ใช้ `reserveRunningNumber()` สร้างเลข Shift แบบ Stable
- เขียน Audit Log ด้วย `POS_AUDIT_ACTIONS.SHIFT_OPENED` และ `SHIFT_CLOSED`
- เตรียมฐานให้ P9-B009 Refund / Return / Void ใช้ active shift ต่อ
- Developer Panel เป็น Version `0.12.55` Build `2026.07.02.009`

## Regression Tests สำคัญ

1. เปิด POS แล้วขาย Online ได้ตามเดิม
2. Offline Sync ต้องทำงานได้ตามเดิม
3. เรียก `openShift()` ต้องสร้างเอกสารใน `shifts` พร้อม `tenantId`, `status: open`, `openingCash`
4. เปิดกะแล้ว localStorage ต้องมี `retail_pos_active_shift_v1`
5. เรียก `closeShift()` ต้องอัปเดต `status: closed`, `closingCash`, `expectedCash`, `cashDifference`
6. ปิดกะแล้ว localStorage ต้องล้าง active shift
7. ตรวจ auditLogs ต้องมี `pos_shift_opened` และ `pos_shift_closed`
8. ตรวจว่าไม่กระทบ Food Order / Delivery
9. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

1. P9-B009 Refund / Return / Void
2. P9-B010 Performance (Cache / Virtual List / Search)

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
