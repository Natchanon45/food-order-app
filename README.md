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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Public Landing Mobile Layout Polish

- ปรับหน้าแรก `/` บน Mobile ให้ card, heading, icon และ spacing เป็นสัดส่วนมากขึ้น
- ปรับ hero, feature cards, quick link และ about card ให้แคบ/กระชับเหมาะกับจอมือถือ
- ปรับลิงก์ Privacy / Terms เป็นปุ่มแยกบรรทัดบน Mobile ให้กดง่ายและมองเห็นชัด
- ลดขนาด footer version บนหน้าแรก Mobile
- แก้เฉพาะ inline CSS/HTML ของหน้าแรก ไม่แตะ logic ขาย, Online/Offline, Sync, Firestore, Tenant หรือ Stock Transaction

## Login Footer + Legal Pages Polish

- ลดขนาดตัวหนังสือ footer version หน้า `/login` ให้เล็กลงทั้ง Desktop และ Mobile
- ปรับหน้า `/privacy` ให้อ่านง่ายขึ้นด้วย section icon, spacing, badge วันที่ และลิงก์แบบปุ่ม/ขีดเส้นใต้ชัดเจน
- ปรับหน้า `/terms` ให้อ่านง่ายขึ้นด้วย section icon, spacing, badge วันที่ และลิงก์แบบปุ่ม/ขีดเส้นใต้ชัดเจน
- แก้เฉพาะ inline CSS/HTML ของหน้า Login, Privacy และ Terms
- ไม่แตะ logic ขาย, Online/Offline, Sync, Firestore, Tenant หรือ Stock Transaction

## Login Input Icon Color Polish

- ปรับ icon ช่องอีเมลและรหัสผ่านในหน้า `/login` ให้เป็นสีเขียวธีม `#159447` ตลอดเวลา
- ครอบคลุมสถานะปกติ, focus และ floating/is-filled ทั้ง PC และ Mobile
- คง animation การย่อ/เลื่อนของ floating icon เดิมไว้
- ไม่แก้ JS/CSS ที่ import ใน HTML จึงไม่ต้อง bump query string รอบนี้
- แก้เฉพาะ inline CSS ของหน้า Login ไม่แตะ logic ขาย, Online/Offline, Sync, Firestore หรือ Stock Transaction

## Login User Circle Icon Polish

- ปรับ icon หัวข้อหน้า `/login` จาก `bi-person-badge` เป็น `bi-person-circle`
- ใช้ icon ลักษณะ user-circle แทน icon แบบบัตร/การ์ด
- ไม่แก้ layout card, spacing, input, password toggle หรือ login redirect logic
- ไม่แก้ JS/CSS ที่ import ใน HTML จึงไม่ต้อง bump query string รอบนี้
- แก้เฉพาะ UI Login ไม่แตะ logic ขาย, Online/Offline, Sync, Firestore หรือ Stock Transaction

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