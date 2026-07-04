# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Hardening 002`
- Developer Panel version/build ปัจจุบัน: `0.12.70` / `2026.07.02.024`

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
- POS Display Order Hard Rollback
- Admin Icon Theme Color Fix
- Admin Action Button Desktop/Mobile Polish
- Main Login UI Polish
- Public Landing Icon Polish
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Public Landing Icon Polish

- คืน icon ให้หัวข้อและปุ่มในหน้า `/` ตอนยังไม่ login
- ย้ายปุ่ม `เข้าสู่ระบบสำหรับพนักงาน` ให้อยู่กึ่งกลาง
- เพิ่ม icon ให้ quick link, contact, privacy และ terms ใน Public Landing
- `/index.html` bump `home-dashboard.css` เป็น `v=20260704-020`
- แก้เฉพาะ UI Public Landing ไม่แตะ logic ขาย, Online/Offline, Sync, Firestore หรือ Stock Transaction

## Main Login UI Polish

- ปรับ `/login` ให้ใช้ Design แบบเดียวกับ `/pos/login`
- ใช้ logo `FOD` แทน `POS`
- เพิ่ม icon ให้หัวข้อ, label อีเมล/รหัสผ่าน และปุ่มเข้าสู่ระบบ
- เพิ่มปุ่มแสดง/ซ่อนรหัสผ่านให้ `/login`
- `/login/index.html` bump `login.js` เป็น `v=20260704-001`
- แก้เฉพาะ UI/Login UX ไม่แตะ logic ขาย, Online/Offline, Sync, Firestore หรือ Stock Transaction

## Admin Icon / Action Button Polish

- แก้ `public/assets/js/admin-icon-polish.js` ให้ไม่เติม icon ซ้ำกับปุ่มที่มี `.app-icon` อยู่แล้ว
- icon หัวข้อ Admin ใช้สีเขียวธีม `#159447`
- เพิ่ม icon ให้ปุ่ม action ตาราง Admin เช่น `แก้ไข` / `ลบ`
- Desktop แสดงปุ่ม action แบบ icon + ตัวหนังสือ
- Mobile แสดงปุ่ม action แบบ icon-only เพื่อประหยัดพื้นที่
- แก้เฉพาะ UI polish ไม่แตะ logic ขาย, Online/Offline, Sync, Firestore หรือ Stock Transaction

## POS Display Order Hard Rollback

- ลบไฟล์ `public/assets/js/retail-pos-display-order.js` ออกจาก repo แล้ว
- `/pos/index.html` ไม่โหลดสคริปต์จัดลำดับสินค้าอีก
- ตัวจัดลำดับหมวดหมู่/สินค้าใน `/pos/products/` ยังอยู่ แต่ยังไม่ apply การเรียงบนหน้าขาย `/pos`
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

## Regression Tests

1. เปิด `/` ตอนยังไม่ login แล้วหัวข้อหลักและ card ต่าง ๆ ต้องมี icon สีเขียวธีม
2. ปุ่ม `เข้าสู่ระบบสำหรับพนักงาน` ต้องอยู่กึ่งกลางและมี icon
3. Quick link `เข้าสู่ระบบพนักงาน / POS` ต้องมี icon และยังลิงก์ไป `/login`
4. ลิงก์ Privacy / Terms และอีเมล support ต้องยังใช้งานได้
5. เปิด `/login` แล้วต้องยังใช้ layout card/gradient/spacing แบบ `/pos/login` และ logo `FOD`
6. เปิด `/pos/login` แล้วต้องยังใช้ logo `POS` และทำงานเดิม
7. เปิด `/admin` แล้ว icon หัวข้อและปุ่ม action Desktop/Mobile ยังถูกต้อง
8. เปิด `/pos` แล้วต้องโหลดหน้าขายได้ ไม่ค้างหรือหน้าขาว
9. Network/Console ต้องไม่มี request ไป `retail-pos-display-order.js`
10. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- ทดสอบการ apply ลำดับสินค้าใน `/pos` แบบปลอดภัยก่อนเปิดใช้อีกครั้ง
- แยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
firebase deploy --only storage
```
