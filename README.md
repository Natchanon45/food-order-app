# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Hardening 002`
- Developer Panel version/build ปัจจุบัน: `0.12.68` / `2026.07.02.022`

## Retail POS Status

ทำแล้ว:

- P9-B001 POS Firestore Foundation
- P9-B002 Running Number
- P9-B003 Counter
- P9-B004 Offline Queue Worker + Retry + Conflict Resolver
- P9-B005 Repository Layer
- P9-B006 Firestore Composite Index
- P9-B007 Audit Log
- P9-B008 Shift Opening / Closing
- P9-B009 Refund / Return / Void
- P9-B010 Performance
- Hotfix Manual Sync
- POS Hardening 001
- POS Hardening 002
- Unified Order / Delivery / POS Menu
- Dashboard Tenant-safe Link Correction
- Dashboard Final Grouping
- POS Payment UX Update
- Retail Category/Product Sort Manager
- Product Image Storage Rules Fix
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Product Image Storage Rules Fix

- แก้ `storage.rules` สำหรับ path `tenants/{tenantId}/product-images/{productId}/{fileName}`
- เพิ่ม function `userTenantProductAdmin(tenantId)` ให้ตรวจสิทธิ์จาก `users/{uid}`
- อนุญาต role `owner`, `admin`, `super_admin` ที่ `active == true` และ `tenantId` ตรงกัน อัปโหลด/ลบรูปสินค้าได้
- ยังจำกัดไฟล์เป็นรูปภาพ และขนาดไม่เกิน 5 MB เหมือนเดิม
- ต้อง deploy Storage Rules ด้วยคำสั่ง `firebase deploy --only storage`

## Retail Category/Product Sort Manager

- เพิ่ม panel `จัดลำดับหมวดหมู่และสินค้า` ใน `/pos/products/`
- เพิ่มไฟล์ `public/assets/js/retail-products-sort-manager.js`
- เพิ่มไฟล์ `public/assets/css/retail-products-sort-manager.css`
- บันทึกลำดับหมวดด้วย field `categoryOrder`
- บันทึกลำดับสินค้าในหมวดด้วย field `sortOrder`
- ล็อกไม่ให้ขยับลำดับสินค้าในหมวด `ขายดี`, `สินค้าขายดี`, `bestseller`, `popular`
- เพิ่มไฟล์ `public/assets/js/retail-pos-display-order.js` เพื่อให้หน้าขาย `/pos` แสดงสินค้าตาม `categoryOrder` และ `sortOrder`
- `/pos/products/index.html` bump `retail-products-sort-manager.css?v=20260702-021` และ `retail-products-sort-manager.js?v=20260702-021`
- `/pos/index.html` bump `retail-pos-display-order.js?v=20260702-021`

## POS Payment UX Update

- ซ่อนปุ่ม `โหลดตัวอย่าง` ออกจากหน้าขาย POS
- เพิ่มไฟล์ `public/assets/js/retail-pos-payment-enter.js`
- เมื่ออยู่ใน Modal รับชำระเงิน และ cursor อยู่ในช่อง `รับเงินมา` สามารถกด Enter เพื่อยืนยันการขายได้
- Enter-to-confirm ใช้วิธี click ปุ่ม `ยืนยันการขาย` เดิม จึงยังใช้ validation และ logic การบันทึกเดิมทั้งหมด
- `/pos/index.html` โหลด `retail-pos-payment-enter.js?v=20260702-020`

## Dashboard Final Grouping

- กลุ่ม `Order / Delivery` มี 4 การ์ด: หน้าครัว, แคชเชียร์ร้านอาหาร, จัดการระบบ, จัดการพนักงาน
- กลุ่ม `Retail POS` แยกเดี่ยวออกจาก Order / Delivery เพราะ POS มีระบบจัดการพนักงานและสิทธิ์ในตัว
- เพิ่มลิงก์ `/pos/catalog` เป็นการ์ด `POS Catalog`
- จำกัดสิทธิ์ `POS Catalog` ให้เห็นเฉพาะ `owner` และ `super_admin`
- `/` bump `home-dashboard.css?v=20260702-019`

## Dashboard Tenant-safe Link Correction

- บังคับ logout redirect ไป `/login` เท่านั้น
- Public Landing เหลือลิงก์พนักงานไป `/login` เท่านั้น ไม่แสดง `/order` หรือ `/delivery` แบบไม่มี tenant
- ตัด Staff Dashboard card `QR / Table Order` และ `Delivery Order` ออก เพราะลิงก์ที่ถูกต้องต้องเป็น tenant slug เช่น `/s/saas-test-shop/order` และ `/s/saas-test-shop/delivery`
- เพิ่ม module guard เบื้องต้นให้ POS card ตรวจ `module`, `modules`, `allowedModules`, `tenantType`, `businessType` ถ้ามีข้อมูลใน profile
- `/` bump `home-session-fa.js?v=20260702-018`

## Unified Order / Delivery / POS Menu

- ปรับหน้า `/` ให้เป็นศูนย์รวมลิงก์เข้าใช้งาน Order / Delivery / POS
- จัด Staff Dashboard เป็น 2 กลุ่มหลัก: `Order / Delivery` และ `Retail POS`

## POS Hardening 002

- อัปเกรด `public/assets/js/retail-pos-hardening.js` เป็น `HARDENING-002`
- เพิ่ม `window.retailPosHardening.diagnostics()` สำหรับตรวจ long session ผ่าน Console
- เก็บ queue summary, localStorage usage, uptime, maintenance count และ event counters
- เก็บ multi-tab leader state และ browser visibility/online state
- เก็บ memory snapshot ถ้า browser รองรับ `performance.memory`
- `/pos/index.html` โหลด `retail-pos-hardening.js?v=20260702-016`

## Regression Tests

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

## Next Tasks

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- แยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`
- Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only storage
firebase deploy --only hosting
