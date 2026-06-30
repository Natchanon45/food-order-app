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

- Version: `0.12.17`
- Build: `2026.06.30.083`
- Branch: `feature/retail-pos`
- Milestone: `P9-B005.2 POS Receipt Data Hydration & Print Cleanup`

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

## รายละเอียด P9-B005.2

ตรวจจากไฟล์จริงพบว่าใบเสร็จ POS หลังบันทึกขายเปิดจาก `retail_pos_sales_v1` ใน localStorage และยังใช้ header/footer แบบ hardcode ทำให้ข้อมูลร้าน, ลูกค้า/สมาชิก, แต้ม และท้ายบิลไม่ตรงกับค่าที่บันทึกไว้

แก้แล้ว:

- ปรับ `retail-pos-receipt-modal.js` ให้ hydrate ข้อมูลร้านจาก settings `store` และ `receipt` ผ่าน `retail-db.js`
- รองรับ fallback จาก `retail_pos_store_settings_v1` และ `food_order_store_settings` สำหรับ offline/local mode
- แสดงชื่อร้าน, ที่อยู่, เบอร์โทร, เลขผู้เสียภาษี และโลโก้ร้านถ้ามี
- แสดงข้อมูลลูกค้า/สมาชิกจาก sale snapshot หรือ local customer cache
- แสดง loyalty summary บนใบเสร็จ ได้แก่ แต้มก่อนซื้อ, ใช้แต้ม, แต้มที่ได้รับ และแต้มคงเหลือ
- ดึง `receiptThanks` และ `receiptFooter` มาใช้ท้ายบิลแทนข้อความ hardcode
- ซ่อน toast, alert, notification และ snackbar ระหว่าง print
- เพิ่ม listener `pos:loyalty-updated` เพื่อ refresh ใบเสร็จที่เปิดอยู่หลัง loyalty module update sale
- `/pos/index.html` bump cache เป็น `retail-pos-receipt-modal.js?v=20260630-083`

## Current Milestone

`P9-B005.2 POS Receipt Data Hydration & Print Cleanup`

## Regression Tests สำคัญ

1. เปิด `/pos`
2. ขาย online 1 บิล หลังบันทึกสำเร็จต้องเปิดใบเสร็จและเรียก print dialog
3. หัวบิลต้องใช้ข้อมูลร้านจาก settings หรือ local fallback
4. ถ้าเลือกลูกค้า ต้องแสดงชื่อ/รหัสสมาชิก/เบอร์โทรบนใบเสร็จ
5. ถ้ามี loyalty ต้องแสดงแต้มก่อนซื้อ/ใช้แต้ม/แต้มที่ได้รับ/แต้มคงเหลือ
6. ท้ายบิลต้องใช้ `receiptThanks` และ `receiptFooter` ที่บันทึกไว้
7. Toast/alert/notification ต้องไม่ติดในใบเสร็จตอนพิมพ์
8. ขาย offline 1 บิล ต้องยังเปิดใบเสร็จและใช้ snapshot/fallback ได้
9. sync offline ภายหลังต้องไม่เปิดใบเสร็จซ้ำ
10. sync ซ้ำต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

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
