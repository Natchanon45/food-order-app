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

- Version: `0.12.68`
- Build: `2026.07.02.022`
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

## Current Milestone

`POS Hardening 002`

## แก้แล้วรอบนี้

- แก้ `storage.rules` สำหรับ path `tenants/{tenantId}/product-images/{productId}/{fileName}`
- เพิ่ม function `userTenantProductAdmin(tenantId)` ให้ตรวจสิทธิ์จาก `users/{uid}`
- อนุญาต role `owner`, `admin`, `super_admin` ที่ `active == true` และ `tenantId` ตรงกัน อัปโหลด/ลบรูปสินค้าได้
- ยังจำกัดไฟล์เป็นรูปภาพ และขนาดไม่เกิน 5 MB เหมือนเดิม
- ต้อง deploy Storage Rules ด้วยคำสั่ง `firebase deploy --only storage`
- Developer Panel เป็น Version `0.12.68` Build `2026.07.02.022`

## Regression Tests สำคัญ

1. Deploy Storage Rules แล้วอัปโหลดรูปสินค้าใน `/pos/products/` ต้องไม่เจอ 403
2. รูปสินค้าต้องถูกอัปโหลดไป path `tenants/{tenantId}/product-images/{productId}/product.webp`
3. ผู้ใช้ role `owner`, `admin`, `super_admin` ที่ `active == true` และ `tenantId` ตรงกันต้องอัปโหลดรูปได้
4. ผู้ใช้ tenant อื่นต้องอัปโหลดรูปข้าม tenant ไม่ได้
5. ไฟล์ที่ไม่ใช่รูปภาพหรือใหญ่กว่า 5 MB ต้องถูกปฏิเสธ
6. เปิด `/pos/products/` แล้วเห็น panel `จัดลำดับหมวดหมู่และสินค้า`
7. เลือกหมวด `ขายดี` แล้วปุ่มขยับสินค้าต้อง disabled และไม่เปลี่ยน `sortOrder` ของสินค้าในหมวดนั้น
8. เปิด `/pos` แล้วสินค้าต้องเรียงตาม `categoryOrder` และ `sortOrder`
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
- ถ้าแก้ `storage.rules` ต้อง deploy ด้วย `firebase deploy --only storage`
