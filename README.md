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
- Login User Circle Icon Polish
- Login Input Icon Color Polish
- Login Footer + Legal Pages Polish
- Public Landing Mobile Layout Polish
- Public Landing Pricing CTA Design
- Public Pricing Final Polish
- Login Copy + Version Size Polish
- Pricing Card Header Alignment Polish
- Support Email Badge Polish
- Legal Support Email Badge Polish
- Badge Row Responsive Polish
- Sales Report Icon Polish
- Sales Report Icon Hotfix
- Sales Report Back Label Polish
- Sales Report Back Icon Duplication Fix
- Login Home Link
- POS User Visibility Fixes
- Admin Staff Callable Hotfix
- Restaurant Staff Role Function Fix
- Business Unit Staff Filter Fix
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Business Unit Staff Filter Fix

- แก้ `functions/staff-admin.js` ให้ใช้ `businessUnit` เป็นตัวกรองหลักของ user management
- ถ้า record มี `businessUnit: retail_pos` จะไม่ถูกส่งกลับมาแสดงที่ `/admin/users` ฝั่ง Order/Delivery
- staff ที่สร้างจาก `/admin/users` จะถูกบันทึกเป็น `businessUnit: order_delivery`
- `updateTenantStaff` จะไม่อนุญาตให้แก้ user ที่เป็น `businessUnit: retail_pos` ผ่านหน้า Order/Delivery
- แก้เพื่อรองรับข้อมูลจริงใน Firebase ที่อาจมี `staffScope/source` ถูกเขียนเป็น Order/Delivery แต่ยังมี `businessUnit: retail_pos`
- ต้อง deploy functions เพื่อให้ filter นี้มีผล

## Restaurant Staff Role Function Fix

- แก้ `functions/staff-admin.js` ให้รองรับ role ร้านอาหารหลักเฉพาะ `admin`, `cashier`, `kitchen`
- แก้ `createTenantStaff` / `updateTenantStaff` ให้ยอมรับ `kitchen` เพื่อแก้ `FirebaseError: Invalid staff role`
- จำกัดผู้จัดการพนักงานฝั่ง functions ให้เป็น `owner` หรือ `super_admin`
- บันทึกพนักงานร้านอาหารที่สร้างใหม่ด้วย marker `staffScope: restaurant` และ `source: order_delivery`
- ปรับ filter หน้า `/admin/users` ให้ซ่อน POS legacy user เช่น `cashier01` โดยไม่ตัด restaurant cashier ปกติชื่อ `Cashier`
- รอบนี้ต้อง deploy functions และ hosting เพื่อให้ callable function และ static cache ใช้งานตรงกัน

## Admin Staff Callable Hotfix

- แก้ `/admin/users` ให้เรียก Callable Functions ที่มีอยู่จริง: `listTenantStaff`, `createTenantStaff`, `updateTenantStaff`
- แก้ปัญหา CORS/failed request จากการเรียกชื่อเดิม `updateStaffUser`
- เพิ่มตัวกรอง POS user เก่าที่ไม่มี marker แต่มีลักษณะ local POS user เช่น `username`, `passwordHash`, `passwordSalt`, id ขึ้นต้น `user-`, หรือ `roleId` แบบ POS
- bump `/admin/users` script เป็น `admin-users.js?v=20260704-002` และ `admin-staff-service.js?v=20260704-002`
- แก้เฉพาะ service/user-management UI ไม่แตะ logic การขาย, Sync, Firestore transaction, stable `saleId` หรือ Stock Transaction

## POS User Visibility Fixes

- `/admin/users` กรอง user ที่มี marker เป็น POS/retail staff ไม่ให้ปะปนในหน้าจัดการพนักงานร้านหลัก
- `/pos/users` ไม่แสดงบัญชีเจ้าของร้าน/current owner ในรายการบัญชีผู้ใช้งาน POS
- `/pos/users` บันทึกพนักงาน POS พร้อม marker `staffScope: pos`, `source: pos`, `userType: retail_pos_staff`
- ฟอร์มแก้ไขพนักงานใน `/pos/users` เปลี่ยน label เป็น `อีเมลสำหรับเข้าสู่ระบบ`
- เมื่อแก้ไขพนักงานใน `/pos/users` ช่องอีเมลถูกตั้งเป็น read only และไม่ถูกเปลี่ยนตอนบันทึก
- แก้เฉพาะ UI/data separation ของ user management ไม่แตะ logic การขาย, Sync, Firestore transaction, stable `saleId` หรือ Stock Transaction

## Login Home Link

- เพิ่มปุ่ม `หน้าหลัก` บนหน้า `/login` เพื่อกลับไป `/`
- ใช้ icon บ้านพร้อม class `.app-icon` และวางเหนือกล่อง Login ให้เห็นได้ทั้ง Desktop/Mobile
- แก้เฉพาะ UI หน้า Login ไม่แตะ logic Auth, Tenant, Firestore, POS, Sync หรือ Stock Transaction

## Sales Report Back Icon Duplication Fix

- แก้ปุ่ม `ย้อนกลับ` หน้า `/admin/sales-report` ไม่ให้แสดงลูกศรซ้ำ 2 อัน
- เพิ่ม class `.app-icon` ให้ icon ลูกศรเดิม เพื่อให้ `ui.js` ตรวจพบว่าเป็น icon ที่ decorate แล้วและไม่เติมซ้ำ
- ปรับ `sales-report.js` query string เป็น `v=20260704-004` เพื่อกัน browser cache หลังแก้ HTML ที่อ้างอิง JS
- แก้เฉพาะ UI ปุ่มย้อนกลับ ไม่แตะ logic รายงาน, การคำนวณ, Tenant, Firestore หรือ Stock Transaction

## Sales Report Back Label Polish

- ปรับปุ่มกลับหน้า `/admin/sales-report` จาก `กลับ` เป็น `ย้อนกลับ`
- เพิ่ม icon ลูกศรซ้ายให้ปุ่ม `ย้อนกลับ` โดยไม่ใช้ class `.bi` เพื่อไม่ชนกับ hotfix ที่กัน icon ซ้ำ
- แก้เฉพาะ UI ปุ่มย้อนกลับ ไม่แตะ logic รายงาน, การคำนวณ, Tenant, Firestore หรือ Stock Transaction

## Sales Report Icon Hotfix

- แก้ปุ่ม `กลับ` หน้า `/admin/sales-report` ไม่ให้แสดง icon ซ้ำ
- แก้หัวข้อกราฟให้มี icon ตลอด แม้ `sales-report.js` จะเปลี่ยนข้อความตามช่วงรายงาน
- ปรับ `sales-report.js` query string เป็น `v=20260704-002` เพื่อกัน browser cache หลังแก้ JS
- แก้เฉพาะ UI icon ของรายงานยอดขาย ไม่แตะ logic รายงาน, การคำนวณ, Tenant, Firestore หรือ Stock Transaction

## Next Tasks

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- ทดสอบการ apply ลำดับสินค้าใน `/pos` แบบปลอดภัยก่อนเปิดใช้อีกครั้ง
- แยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only functions,hosting
```