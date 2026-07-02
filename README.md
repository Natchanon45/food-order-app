# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Hardening 002`
- Developer Panel version/build ปัจจุบัน: `0.12.69` / `2026.07.02.023`

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
- POS Display Order Hotfix
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## POS Display Order Hotfix

- ถอด `retail-pos-display-order.js` ออกจาก `/pos/index.html` ชั่วคราว เพื่อให้หน้าขาย POS กลับมาใช้งานได้ก่อน
- ตัวจัดลำดับหมวดหมู่/สินค้าใน `/pos/products/` ยังอยู่ แต่ยังไม่ apply การเรียงบนหน้าขาย `/pos` จนกว่าจะทดสอบแยกปลอดภัย
- ไม่มีการแตะ logic ขาย, Online/Offline, Sync, Stable `saleId` หรือ Stock Transaction

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
- `/pos/products/index.html` bump `retail-products-sort-manager.css?v=20260702-021` และ `retail-products-sort-manager.js?v=20260702-021`

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

## Regression Tests

1. เปิด `/pos` แล้วต้องโหลดหน้าขายได้ ไม่ค้างหรือหน้าขาว
2. หน้า `/pos` ต้องไม่โหลด `retail-pos-display-order.js`
3. เปิด POS แล้วขาย Online ได้ตามเดิม
4. ปิดเน็ตขาย Offline ได้ตามเดิม
5. เปิดเน็ตแล้ว Manual Sync ได้ตามเดิม
6. กด Enter ใน modal รับเงินแล้วยืนยันการขายได้ตามเดิม
7. หน้า `/pos` ต้องไม่เห็นปุ่ม `โหลดตัวอย่าง`
8. Deploy Storage Rules แล้วอัปโหลดรูปสินค้าใน `/pos/products/` ต้องไม่เจอ 403
9. เปิด `/pos/products/` แล้วเห็น panel `จัดลำดับหมวดหมู่และสินค้า`
10. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- ทดสอบการ apply ลำดับสินค้าใน `/pos` แบบปลอดภัยก่อนเปิดใช้อีกครั้ง
- แยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
firebase deploy --only storage
