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

- Version: `0.12.57`
- Build: `2026.07.02.011`
- Branch: `feature/retail-pos`
- Milestone: `P9-B010 Performance (Cache / Virtual List / Search)`

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

## Current Milestone

`P9-B010 Performance (Cache / Virtual List / Search)`

## แก้แล้วรอบนี้

- เพิ่ม `retail-pos-performance.js` เป็น Performance Layer ของ POS
- เพิ่ม debounce search input เพื่อลดการ render ซ้ำระหว่างพิมพ์ค้นหา
- จำกัดจำนวน product card ที่แสดงบน DOM ครั้งละ 96 รายการ เพื่อให้หน้า POS เร็วขึ้นเมื่อสินค้าจำนวนมาก
- เพิ่มข้อความแจ้งให้ค้นหาเมื่อผลลัพธ์เกินจำนวนที่แสดง
- เพิ่ม performance snapshot ลง `sessionStorage` สำหรับตรวจ cache diagnostics
- `/pos/index.html` โหลด `retail-pos-performance.js?v=20260702-011`
- Developer Panel เป็น Version `0.12.57` Build `2026.07.02.011`

## Regression Tests สำคัญ

1. เปิด POS แล้วโหลดสินค้าต้องเร็วขึ้นเมื่อมีสินค้าจำนวนมาก
2. ถ้ามีสินค้ามากกว่า 96 รายการ ต้องเห็นข้อความแนะนำให้ค้นหา
3. ค้นหาสินค้าด้วยชื่อ / รหัส / บาร์โค้ด ต้องเจอสินค้าเดิม
4. กดเพิ่มสินค้าเข้าตะกร้าได้ตามเดิม
5. สแกนบาร์โค้ดแล้วเพิ่มสินค้าได้ตามเดิม
6. ขาย Online ได้ตามเดิม
7. ขาย Offline และ Sync ได้ตามเดิม
8. ตรวจ `window.retailPosPerformance.version` ต้องเป็น `P9-B010`
9. ตรวจว่าไม่กระทบ Order / Delivery ที่คุณแก้ใน commit `5c96d34` และ `4c0984d`
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
