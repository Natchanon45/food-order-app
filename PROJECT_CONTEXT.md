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

- Version: `0.12.23`
- Build: `2026.07.01.004`
- Branch: `feature/retail-pos`
- Milestone: `P9-B009 Refund / Return / Void`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Firestore Foundation P9-B001 เสร็จ
- P9-B002 Running Number เสร็จ
- P9-B003 Counter เสร็จ
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver เสร็จ
- P9-B005 Repository Layer เสร็จเบื้องต้น
- P9-B006 Firestore Composite Index เสร็จ
- P9-B007 Audit Log เสร็จ
- P9-B008 Shift Opening / Closing เสร็จ
- P9-B009 Refund / Return / Void เสร็จ

## รายละเอียด P9-B009

ต่อจาก HEAD ล่าสุดของผู้ใช้ `fix: invalidate stale admin UI modules` โดยไม่แก้ไฟล์ hotfix/admin/delivery ที่ผู้ใช้เพิ่งแก้ และปรับระบบคืนสินค้า/คืนเงิน/VOID ของ Retail POS

แก้แล้ว:

- เพิ่มปุ่ม `คืนทั้งบิล / VOID` ใน `/pos/returns`
- VOID จะใส่จำนวนคืนเต็มตามสินค้าที่ยังคืนได้ และตั้งเหตุผลเป็น `ยกเลิกบิล / VOID`
- Return/VOID บันทึก tenantId, shopId, deviceId, schemaVersion, dateKey และ monthKey
- ใช้ stock movement id แบบ deterministic จาก returnId + productId เพื่อลดปัญหา movement ซ้ำ
- Firestore transaction อ่าน sale, return และ product ก่อน write ตามข้อกำหนด Firestore
- อัปเดต sale ด้วย refundTotal, refundStatus และ status `voided` เมื่อคืนทั้งบิล
- บันทึก audit log สำหรับ return และ void
- ยังคง logic ปรับแต้มสมาชิกจากยอดคืนและ cache local fallback
- `/pos/returns/index.html` bump cache เป็น `retail-returns.js?v=20260701-004`

## Current Milestone

`P9-B009 Refund / Return / Void`

## Regression Tests สำคัญ

1. เปิด `/pos/returns`
2. ค้นหาบิลขายที่ยังมีสินค้าคืนได้
3. คืนสินค้าบางรายการ ต้องเพิ่ม stock กลับและบันทึก return record
4. กด `คืนทั้งบิล / VOID` ต้องกรอกจำนวนคืนเต็มที่เหลือ
5. VOID ต้องบันทึก sale status เป็น `voided`
6. Return/VOID ต้องสร้าง stock movement id แบบ stable ต่อ returnId + productId
7. Firestore ต้องมี audit log สำหรับ return หรือ void
8. ถ้ามีสมาชิกและแต้ม ต้องปรับแต้มตามยอดคืน
9. จำนวนคืนต้องไม่เกินจำนวนที่ขายลบจำนวนที่คืนแล้ว
10. Local fallback ต้องยังบันทึก return, movement, product cache และ loyalty cache ได้

## งานถัดไป

1. P9-B010 Performance

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable `saleId` เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
