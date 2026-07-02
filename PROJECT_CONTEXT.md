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

- Version: `0.12.70`
- Build: `2026.07.02.024`
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
- Product Image Storage Rules Fix เสร็จแล้ว
- POS Display Order Hard Rollback เสร็จแล้ว

## Current Milestone

`POS Hardening 002`

## แก้แล้วรอบนี้

- ลบไฟล์ `public/assets/js/retail-pos-display-order.js` ออกจาก repo แล้ว
- `/pos/index.html` ไม่โหลดสคริปต์จัดลำดับสินค้าอีก
- ตัวจัดลำดับหมวดหมู่/สินค้าใน `/pos/products/` ยังอยู่ แต่ยังไม่ apply การเรียงบนหน้าขาย `/pos`
- ไม่มีการแตะ logic ขาย, Online/Offline, Sync, Stable `saleId` หรือ Stock Transaction
- Developer Panel เป็น Version `0.12.70` Build `2026.07.02.024`

## Regression Tests สำคัญ

1. เปิด `/pos` แล้วต้องโหลดหน้าขายได้ ไม่ค้างหรือหน้าขาว
2. Network/Console ต้องไม่มี request ไป `retail-pos-display-order.js`
3. เปิด POS แล้วขาย Online ได้ตามเดิม
4. ปิดเน็ตขาย Offline ได้ตามเดิม
5. เปิดเน็ตแล้ว Manual Sync ได้ตามเดิม
6. กด Enter ใน modal รับเงินแล้วยืนยันการขายได้ตามเดิม
7. หน้า `/pos` ต้องไม่เห็นปุ่ม `โหลดตัวอย่าง`
8. Deploy Storage Rules แล้วอัปโหลดรูปสินค้าใน `/pos/products/` ต้องไม่เจอ 403
9. เปิด `/pos/products/` แล้วเห็น panel `จัดลำดับหมวดหมู่และสินค้า`
10. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- ทดสอบการ apply ลำดับสินค้าใน `/pos` แบบปลอดภัยก่อนเปิดใช้อีกครั้ง
- พิจารณาแยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- ถ้าแก้ `storage.rules` ต้อง deploy ด้วย `firebase deploy --only storage`
