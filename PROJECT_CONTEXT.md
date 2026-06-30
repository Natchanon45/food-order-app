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

- Version: `0.12.18`
- Build: `2026.06.30.084`
- Branch: `feature/retail-pos`
- Milestone: `P9-B005.3 POS Receipt Settings Restore & Loyalty Calculation Fix`

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

## รายละเอียด P9-B005.3

ตรวจหลัง P9-B005.2 พบว่ายังมี 3 จุดไม่ครบตาม workflow เดิม: ตัวเลือกขนาดใบเสร็จ 58/80/A4 หาย, ตัวเลือกถามก่อนพิมพ์/พิมพ์ทันทีหาย, ชื่อร้านยังไม่ยึดค่าที่บันทึกในหน้าตั้งค่า และแต้มยังไม่คำนวณทันในบิลที่เปิดหลังขาย

แก้แล้ว:

- เพิ่มตัวเลือก `receiptPaperSize` ใน `/pos/settings`: 58mm, 80mm, A4
- เพิ่มตัวเลือก `receiptPrintMode` ใน `/pos/settings`: ถามก่อนพิมพ์, พิมพ์ทันที
- บันทึก receipt settings ลง localStorage และ Firestore settings `store`/`receipt`
- ปรับ receipt modal ให้ใช้ local saved settings เป็นหลัก เพื่อให้ชื่อร้านตรงกับค่าที่บันทึกบนเครื่อง
- ปรับ receipt modal ให้กำหนดกระดาษตาม setting 58/80/A4
- ปรับ receipt modal ให้พิมพ์ทันทีเฉพาะเมื่อ `receiptPrintMode = auto`; ถ้า `ask` ให้เปิดใบเสร็จแล้วรอกดพิมพ์
- เพิ่มการคำนวณ loyalty fallback ทันทีบนใบเสร็จจาก customer cache + loyalty settings + points used ใน payment dialog
- `/pos/index.html` bump cache เป็น `retail-pos-receipt-modal.js?v=20260630-084`
- `/pos/settings/index.html` bump cache เป็น `retail-pos-settings.js?v=20260630-084`

## Current Milestone

`P9-B005.3 POS Receipt Settings Restore & Loyalty Calculation Fix`

## Regression Tests สำคัญ

1. เปิด `/pos/settings`
2. เปลี่ยนชื่อร้าน แล้วบันทึก ต้องเห็นชื่อร้านใหม่บนใบเสร็จ POS
3. เลือกขนาดใบเสร็จ 58mm แล้วขาย 1 บิล ใบเสร็จต้องพิมพ์ขนาด 58mm
4. เลือกขนาดใบเสร็จ 80mm แล้วขาย 1 บิล ใบเสร็จต้องพิมพ์ขนาด 80mm
5. เลือกขนาดใบเสร็จ A4 แล้วขาย 1 บิล ใบเสร็จต้องพิมพ์ขนาด A4
6. เลือก `ถามก่อนพิมพ์` หลังบันทึกขายต้องเปิดใบเสร็จแต่ยังไม่เรียก print dialog อัตโนมัติ
7. เลือก `พิมพ์ทันที` หลังบันทึกขายต้องเรียก print dialog อัตโนมัติ
8. ถ้าเลือกลูกค้า ต้องแสดงชื่อ/รหัสสมาชิก/เบอร์โทรบนใบเสร็จ
9. ถ้ามีระบบแต้ม ต้องคำนวณแต้มก่อนซื้อ/ใช้แต้ม/แต้มที่ได้รับ/แต้มคงเหลือในบิล
10. Toast/alert/notification ต้องไม่ติดในใบเสร็จตอนพิมพ์
11. sync ซ้ำต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

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
