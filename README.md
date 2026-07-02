# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Hardening 001`
- Developer Panel version/build ปัจจุบัน: `0.12.61` / `2026.07.02.015`

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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## POS Hardening 001

- เพิ่ม `public/assets/js/retail-pos-hardening.js`
- เพิ่ม multi-tab leader heartbeat
- recover offline sale ที่ค้าง `syncStatus: syncing` เกิน 2 นาที
- cleanup local sale ที่ sync แล้วและเก่าเกิน 45 วัน หรือเกิน 500 รายการล่าสุด
- preserve queue สำคัญ: `pending`, `syncing`, `failed`, `conflict`
- รองรับ browser sleep/wake ผ่าน `visibilitychange`, `pageshow`, `focus`, `online`
- `/pos/index.html` โหลด `retail-pos-hardening.js?v=20260702-015`

## Regression Tests

1. เปิด POS แล้วขาย Online ได้ตามเดิม
2. ปิดเน็ตขาย Offline ได้ตามเดิม
3. เปิดเน็ตแล้ว Manual Sync ได้ตามเดิม
4. เปิด Console แล้ว `window.retailPosHardening.version` ต้องเป็น `HARDENING-001`
5. เปิด POS 2 แท็บ แล้วต้องไม่มี error จาก hardening layer
6. ปิดจอ/ปล่อย browser sleep แล้วกลับมา หน้า POS ต้องยังทำงานและ sync ต่อได้
7. pending/failed/conflict queue ต้องไม่ถูกลบจาก localStorage
8. synced sale เก่าใน localStorage ถูก cleanup เฉพาะรายการที่ปลอดภัย
9. ตรวจว่าไม่กระทบ Order / Delivery
10. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

- POS Hardening 002: ตรวจ listener/snapshot leak เพิ่มเติม และ diagnostics สำหรับ long session
- Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
