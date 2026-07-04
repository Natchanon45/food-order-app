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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Badge Row Responsive Polish

- ปรับ badge ลิงก์ในหน้า `/`, `/privacy`, `/terms` ให้แสดงแถวเดียวกันในโหมด PC
- ปรับ Mobile ให้ badge แยกเป็น 3 แถวเต็มความกว้าง
- รวม badge ติดต่อฝ่ายสนับสนุนเข้ากับแถวลิงก์ของ Privacy และ Terms
- คงการซ่อนอีเมลไว้ แต่ยังคลิกส่งอีเมลผ่าน `mailto:` ได้
- แก้เฉพาะ HTML/inline CSS ของหน้า public/legal ไม่แตะ logic ขาย, Online/Offline, Sync, Firestore, Tenant หรือ Stock Transaction

## Legal Support Email Badge Polish

- ปรับหน้า `/privacy` และ `/terms` ให้ลิงก์อีเมลเป็น badge แบบเดียวกับหน้าแรก
- แสดงเฉพาะ icon + ข้อความ `ติดต่อฝ่ายสนับสนุน`
- ซ่อนอีเมลไม่ให้แสดงบนหน้าเว็บ แต่ยังคลิกเพื่อส่งอีเมลผ่าน `mailto:` ได้
- คงลิงก์กลับหน้าแรก, Privacy และ Terms เดิมไว้
- แก้เฉพาะ HTML/inline CSS ของหน้า Privacy และ Terms ไม่แตะ logic ขาย, Online/Offline, Sync, Firestore, Tenant หรือ Stock Transaction

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