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

- Version: `0.12.16`
- Build: `2026.06.30.082`
- Branch: `feature/retail-pos`
- Milestone: `P9-B005.1 POS Receipt Print Fix`

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

## รายละเอียด P9-B005.1

ตรวจจากไฟล์จริงพบว่า `/pos/index.html` ยังไม่ได้โหลด `retail-pos-receipt-modal.js` ทำให้ตัวดัก localStorage sale ใหม่ไม่ทำงานหลังบันทึกขาย

แก้แล้ว:

- เพิ่ม script `retail-pos-receipt-modal.js?v=20260630-082` ใน `/pos/index.html`
- โหลด receipt modal ก่อน `retail-pos.js` เพื่อให้ patch `localStorage.setItem` ทันก่อนมีการบันทึก sale
- ปรับ receipt modal ให้เปิดใบเสร็จและเรียก same-window print หลัง sale save
- เพิ่ม `.receipt-print-root` ให้ modal เพื่อให้ fallback print ไม่พิมพ์หน้าว่าง
- Sync event ภายหลังจะไม่เปิดบิลเก่าซ้ำ

## Current Milestone

`P9-B005.1 POS Receipt Print Fix`

## Regression Tests สำคัญ

1. เปิด `/pos`
2. ขาย online 1 บิล หลังบันทึกสำเร็จต้องเปิดใบเสร็จและเรียก print dialog
3. ขาย offline 1 บิล หลังบันทึกสำเร็จต้องเปิดใบเสร็จและเรียก print dialog
4. print fallback ต้องไม่เป็นหน้าว่าง
5. sync offline ภายหลังต้องไม่เปิดใบเสร็จซ้ำ
6. sync ซ้ำต้องไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ

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
