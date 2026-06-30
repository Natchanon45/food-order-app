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

- Version: `0.12.19`
- Build: `2026.06.30.085`
- Branch: `feature/retail-pos`
- Milestone: `P9-B005.4 POS Receipt Loyalty Fix`

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

## รายละเอียด P9-B005.4

ตรวจหลัง P9-B005.3 พบว่าใบเสร็จแสดงร้านและลูกค้าแล้ว แต่แต้มยังไม่ขึ้นครบ เพราะใบเสร็จเปิดจาก local sale ก่อนที่ customer-link/loyalty module จะ patch sale เสร็จ

แก้แล้ว:

- ปรับ receipt modal ให้ใช้ `paymentDialog.dataset.customerId` เป็น fallback เมื่อ sale ยังไม่มี `customerId`
- คำนวณ loyalty จากลูกค้าที่เลือก + customer cache + loyalty settings + ยอดสุทธิของบิล
- แสดงแต้มก่อนซื้อ, ใช้แต้ม, แต้มที่ได้รับ และแต้มคงเหลือทันทีบนใบเสร็จ
- ยังรองรับ sale ที่มี `sale.loyalty` อยู่แล้ว โดยใช้ข้อมูลจริงจาก sale ก่อน fallback
- `/pos/index.html` bump cache เป็น `retail-pos-receipt-modal.js?v=20260630-085`

## Current Milestone

`P9-B005.4 POS Receipt Loyalty Fix`

## Regression Tests สำคัญ

1. เปิด `/pos`
2. เลือกลูกค้าที่มีรหัสสมาชิก
3. ขายสินค้า 1 บิล
4. ใบเสร็จต้องแสดงชื่อ/รหัส/เบอร์ลูกค้า
5. ใบเสร็จต้องแสดงแต้มก่อนซื้อ, ใช้แต้ม, แต้มที่ได้รับ และแต้มคงเหลือ
6. ถ้าไม่ใช้แต้ม ต้องแสดงใช้แต้มเป็น 0 และยังคำนวณแต้มที่ได้รับ
7. ถ้า sale มี `sale.loyalty` แล้ว ต้องใช้ค่าจาก sale เป็นหลัก
8. Toast/alert/notification ต้องไม่ติดในใบเสร็จตอนพิมพ์
9. sync ซ้ำต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

## งานถัดไป

1. P9-B006 Firestore Composite Index
2. P9-B007 Audit Log
3. P9-B008 Shift Opening / Closing
4. P9-B009 Refund / Return / Void
5. P9-B010 Performance

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable `saleId` เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
