# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Take Away + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string กัน browser cache
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.24`
- Build: `2026.07.01.005`
- Branch: `feature/retail-pos`
- Milestone: `O1-T001 Take Away Order / Pickup Queue`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away Order / Pickup Queue เสร็จขั้นแรก
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

## รายละเอียด O1-T001

พัก POS roadmap ชั่วคราวเพื่อเพิ่มระบบ Take Away สำหรับลูกค้าที่มาสั่งหน้าร้านแต่ไม่นั่งโต๊ะ โดยไม่ต้องเปิดโต๊ะจริง และใช้ flow ครัว/แคชเชียร์เดิมให้มากที่สุด

แก้แล้ว:

- เพิ่มหน้า `/takeaway/` สำหรับลูกค้าสั่งกลับบ้าน
- ลูกค้าต้องกรอกชื่อหรือเบอร์โทรอย่างน้อย 1 อย่าง
- เพิ่ม `dataService.createTakeawayOrder()` เพื่อสร้าง orderType `takeaway`
- สร้างเลขคิวรายวันรูปแบบ `TA-001`, `TA-002`, ... ผ่าน Firestore transaction counter
- Take Away order มี `queueNo`, `customerName`, `customerPhone`, `pickupStatus`, `dateKey`
- หน้า Cashier แยกการ์ด Take Away ออกจาก Table และ Delivery
- Cashier สามารถรับชำระเงิน, เรียกรับของ และกดส่งมอบแล้ว
- เมื่อส่งมอบแล้วจะตั้ง `pickupStatus = picked_up` และปิด order เป็น paid
- `/takeaway/index.html` โหลด `takeaway-order.js?v=20260701-005`
- `/cashier/index.html` bump cache เป็น `cashier.js?v=20260701-005`

## Current Milestone

`O1-T001 Take Away Order / Pickup Queue`

## Regression Tests สำคัญ

1. เปิด `/takeaway/`
2. กรอกชื่อหรือเบอร์โทรอย่างน้อย 1 อย่าง
3. เลือกเมนูและส่งออเดอร์ ต้องได้เลขคิว `TA-xxx`
4. Firestore order ต้องมี `orderType = takeaway`, `queueNo`, `customerName`, `customerPhone`, `pickupStatus`
5. ออเดอร์ Take Away ต้องเข้า Kitchen ได้เหมือนออเดอร์ทั่วไป
6. หน้า Cashier ต้องแสดงการ์ด Take Away แยกจากโต๊ะและ Delivery
7. Cashier กดรับชำระเงินได้
8. เมื่อ Kitchen ทำเสร็จเป็น `ready` แล้ว Cashier ต้องกดเรียกรับของได้
9. Cashier กดส่งมอบแล้ว ต้องอัปเดต `pickupStatus = picked_up` และปิดออเดอร์เป็น paid
10. QR Table Order และ Delivery ต้องยังทำงานตามเดิม

## งานถัดไป

1. O1-T002 Pickup Screen / Counter Display
2. O1-T003 Kitchen Take Away Visual Badge
3. P9-B010 Performance

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
