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

- Version: `0.12.21`
- Build: `2026.06.30.087`
- Branch: `feature/retail-pos`
- Milestone: `P9-B007 Audit Log`

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

## รายละเอียด P9-B007

เพิ่ม audit log สำหรับการขาย POS ที่บันทึกสำเร็จใน Firestore transaction เพื่อให้ตรวจสอบย้อนหลังได้ว่าใครขายบิลไหน ยอดเท่าไร อุปกรณ์ใด และสถานะ sync เป็นอะไร

แก้แล้ว:

- เพิ่ม helper ใน `retail-pos.js` สำหรับสร้าง deterministic audit log id
- เขียน audit log ลง `tenants/{tenantId}/auditLogs/{pos_sale_completed_saleId}` ภายใน transaction เดียวกับ sale
- Audit log มี tenantId, shopId, deviceId, schemaVersion, createdBy, action, entityType, entityId, entityNumber
- Audit summary มี saleNumber, totalAmount, totalQty, paymentMethod, customerId, shiftId และ syncStatus
- ใช้ deterministic audit id เพื่อกัน audit ซ้ำเมื่อ saleId เดิมถูก retry
- `/pos/index.html` bump cache เป็น `retail-pos.js?v=20260630-087`

## Current Milestone

`P9-B007 Audit Log`

## Regression Tests สำคัญ

1. เปิด `/pos`
2. ขาย online 1 บิล
3. Firestore ต้องมี sale document ตาม stable `saleId`
4. Firestore ต้องมี audit log ใน `tenants/{tenantId}/auditLogs/{pos_sale_completed_saleId}`
5. Audit log ต้องมี tenantId และ action `pos_sale_completed`
6. Audit log summary ต้องมี saleNumber, totalAmount, totalQty, paymentMethod, customerId, shiftId, syncStatus
7. ขายซ้ำด้วย saleId เดิมต้องไม่สร้าง audit log ซ้ำ
8. Offline fallback ต้องยังทำงานได้
9. Transaction ยัง read เอกสารทั้งหมดก่อน write

## งานถัดไป

1. P9-B008 Shift Opening / Closing
2. P9-B009 Refund / Return / Void
3. P9-B010 Performance

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable `saleId` เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
