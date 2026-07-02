# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Hardening 002`
- Developer Panel version/build ปัจจุบัน: `0.12.63` / `2026.07.02.017`

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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Unified Order / Delivery / POS Menu

- ปรับหน้า `/` ให้เป็นศูนย์รวมลิงก์เข้าใช้งาน Order / Delivery / POS
- เพิ่มลิงก์ด่วนฝั่ง Public Landing: `/order`, `/delivery`, `/login`
- จัด Staff Dashboard เป็น 2 กลุ่มหลัก: `Order / Delivery` และ `Retail POS`
- เพิ่มลิงก์ Staff Dashboard ไปยัง `/order`, `/delivery`, `/kitchen`, `/cashier`, `/pos`, `/admin`, `/admin/users`
- `/` bump `home-dashboard.css?v=20260702-017`

## POS Hardening 002

- อัปเกรด `public/assets/js/retail-pos-hardening.js` เป็น `HARDENING-002`
- เพิ่ม `window.retailPosHardening.diagnostics()` สำหรับตรวจ long session ผ่าน Console
- เก็บ queue summary, localStorage usage, uptime, maintenance count และ event counters
- เก็บ multi-tab leader state และ browser visibility/online state
- เก็บ memory snapshot ถ้า browser รองรับ `performance.memory`
- `/pos/index.html` โหลด `retail-pos-hardening.js?v=20260702-016`

## Regression Tests

1. เปิด `/` แล้วเห็นลิงก์ด่วน Order / Delivery / Login
2. Login เป็น Staff แล้วเห็น Staff Dashboard แยกกลุ่ม Order / Delivery และ Retail POS
3. ลิงก์ `/order`, `/delivery`, `/kitchen`, `/cashier`, `/pos`, `/admin`, `/admin/users` ยังไปหน้าถูกต้องตามสิทธิ์
4. เปิด POS แล้วขาย Online ได้ตามเดิม
5. ปิดเน็ตขาย Offline ได้ตามเดิม
6. เปิดเน็ตแล้ว Manual Sync ได้ตามเดิม
7. Console: `window.retailPosHardening.version` ต้องเป็น `HARDENING-002`
8. Console: `window.retailPosHardening.diagnostics()` ต้องคืน object diagnostics
9. ตรวจว่าไม่กระทบ Order / Delivery
10. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
