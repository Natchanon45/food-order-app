# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string กัน browser cache
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.22`
- Build: `2026.07.01.003`
- Branch: `feature/retail-pos`
- Milestone: `P9-B008 Shift Opening / Closing`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation P9-B001 เสร็จ
- P9-B002 Running Number เสร็จ
- P9-B002.1 Firestore Rules for Running Number เสร็จ
- P9-B002.2 POS Auth Warning Cleanup เสร็จ
- P9-B003 Counter เสร็จ
- P9-B003.1 POS Menu Open Fix เสร็จ
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จ
- P9-B004.1 POS Menu Spacing เสร็จ
- P9-B005 Repository Layer เสร็จเบื้องต้น
- P9-B005.1 POS Receipt Print Fix เสร็จ
- P9-B005.2 POS Receipt Data Hydration & Print Cleanup เสร็จ
- P9-B005.3 POS Receipt Settings Restore & Loyalty Calculation Fix เสร็จ
- P9-B005.4 POS Receipt Loyalty Fix เสร็จ
- P9-B006 Firestore Composite Index เสร็จ
- P9-B007 Audit Log เสร็จ
- P9-B008 Shift Opening / Closing เสร็จ

## รายละเอียด P9-B008

ปรับระบบเปิดกะ/ปิดกะของ Retail POS ให้เสถียรขึ้นทั้ง Firestore และ local fallback โดยต่อจาก HEAD ล่าสุดของผู้ใช้

แก้แล้ว:

- ปรับ `retail-shifts.js` ให้ใช้ `saveRecord` แทนการเขียน Firestore ตรง เพื่อรองรับ local fallback
- เปิดกะโดยบันทึก tenantId, shopId, deviceId, schemaVersion, cashierName, terminalCode, openingCash, openedAt และ createdBy
- ปิดกะโดยสรุปยอดขาย, ยอดเงินสด, ยอดโอน, จำนวนบิล, เงินสดที่ควรมี, เงินสดนับจริง และผลต่างเงินสด
- ประวัติกะแสดงกะปิดล่าสุดจาก Firestore/local cache
- POS หน้า `/pos` ยังใช้ active shift ผ่าน `retail_pos_active_shift_v1` ตามเดิม จึงผูก `shiftId` ใน sale ได้ต่อเนื่อง
- `/pos/shifts/index.html` bump cache เป็น `retail-shifts.js?v=20260701-003`
- อัปเดต Developer Panel เป็น Version `0.12.22` Build `2026.07.01.003`

## Current Milestone

`P9-B008 Shift Opening / Closing`

## Regression Tests สำคัญ

1. เปิด `/pos/shifts`
2. เปิดกะด้วยชื่อพนักงาน, รหัสเครื่อง POS และเงินสดเริ่มต้น
3. ต้องเห็น active shift และบันทึกลง Firestore หรือ local fallback ได้
4. เปิด `/pos` แล้วขาย 1 บิล ต้องผูก shiftId กับ active shift ถ้ามีกะเปิดอยู่
5. กลับ `/pos/shifts` ต้องเห็นยอดขายรวม, ยอดเงินสด, ยอดโอน, จำนวนบิล และเงินสดที่ควรมี
6. ปิดกะด้วยเงินสดนับจริง ต้องบันทึก actualCash และ cashDifference
7. ประวัติกะต้องแสดงกะที่ปิดแล้ว
8. Offline/local fallback ต้องไม่ทำให้ POS sale flow เสีย

## งานถัดไป

1. P9-B009 Refund / Return / Void
2. P9-B010 Performance

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable `saleId` เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
