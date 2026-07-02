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

- Version: `0.12.67`
- Build: `2026.07.02.021`
- Branch: `feature/retail-pos`
- Milestone: `POS Hardening 002`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Roadmap P9-B001 ถึง P9-B010 เสร็จครบแล้ว
- Manual Sync Hotfix เสร็จแล้ว
- commit ฐานล่าสุดจากผู้ใช้: `927047f`
- POS Hardening 001 เสร็จแล้ว
- POS Hardening 002 เสร็จแล้ว
- Unified Order / Delivery / POS Menu เสร็จแล้ว
- Dashboard Tenant-safe Link Correction เสร็จแล้ว
- Dashboard Final Grouping เสร็จแล้ว
- POS Payment UX Update เสร็จแล้ว
- Retail Category/Product Sort Manager เสร็จแล้ว

## Current Milestone

`POS Hardening 002`

## แก้แล้วรอบนี้

- เพิ่ม panel `จัดลำดับหมวดหมู่และสินค้า` ใน `/pos/products/`
- เพิ่มไฟล์ `public/assets/js/retail-products-sort-manager.js`
- เพิ่มไฟล์ `public/assets/css/retail-products-sort-manager.css`
- บันทึกลำดับหมวดด้วย field `categoryOrder`
- บันทึกลำดับสินค้าในหมวดด้วย field `sortOrder`
- ล็อกไม่ให้ขยับลำดับสินค้าในหมวด `ขายดี`, `สินค้าขายดี`, `bestseller`, `popular`
- เพิ่มไฟล์ `public/assets/js/retail-pos-display-order.js` เพื่อให้หน้าขาย `/pos` แสดงสินค้าตาม `categoryOrder` และ `sortOrder`
- `/pos/products/index.html` bump `retail-products-sort-manager.css?v=20260702-021` และ `retail-products-sort-manager.js?v=20260702-021`
- `/pos/index.html` bump `retail-pos-display-order.js?v=20260702-021`
- Developer Panel เป็น Version `0.12.67` Build `2026.07.02.021`

## Regression Tests สำคัญ

1. เปิด `/pos/products/` แล้วเห็น panel `จัดลำดับหมวดหมู่และสินค้า`
2. ขยับหมวดสินค้าแล้วกดบันทึก ต้องบันทึก `categoryOrder` กลับ Firestore/local cache
3. เลือกหมวดทั่วไปแล้วขยับสินค้า ต้องบันทึก `sortOrder` กลับ Firestore/local cache
4. เลือกหมวด `ขายดี` แล้วปุ่มขยับสินค้าต้อง disabled และไม่เปลี่ยน `sortOrder` ของสินค้าในหมวดนั้น
5. เปิด `/pos` แล้วสินค้าต้องเรียงตาม `categoryOrder` และ `sortOrder`
6. สินค้าในหมวดขายดีต้องไม่ถูก reorder จากเครื่องมือใหม่นี้
7. หน้า `/pos` ต้องไม่เห็นปุ่ม `โหลดตัวอย่าง`
8. กด Enter ใน modal รับเงินแล้วยืนยันการขายได้ตามเดิม
9. เปิด POS แล้วขาย Online/Offline ได้ตามเดิม
10. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- พิจารณาแยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`
- Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
