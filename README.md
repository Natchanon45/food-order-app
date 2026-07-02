# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `POS Hardening 002`
- Developer Panel version/build ปัจจุบัน: `0.12.64` / `2026.07.02.018`

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
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Sale ใช้ Stable `saleId` เดิมทั้ง Online และ Offline

## Dashboard Tenant-safe Link Correction

- บังคับ logout redirect ไป `/login` เท่านั้น
- Public Landing เหลือลิงก์พนักงานไป `/login` เท่านั้น ไม่แสดง `/order` หรือ `/delivery` แบบไม่มี tenant
- ตัด Staff Dashboard card `QR / Table Order` และ `Delivery Order` ออก เพราะลิงก์ที่ถูกต้องต้องเป็น tenant slug เช่น `/s/saas-test-shop/order` และ `/s/saas-test-shop/delivery`
- Staff Dashboard เหลือเมนูพนักงานตามสิทธิ์: ครัว, แคชเชียร์ร้านอาหาร, Retail POS, จัดการระบบ, จัดการพนักงาน
- เพิ่ม module guard เบื้องต้นให้ POS card ตรวจ `module`, `modules`, `allowedModules`, `tenantType`, `businessType` ถ้ามีข้อมูลใน profile
- `/` bump `home-dashboard.css?v=20260702-018`
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

1. กดออกจากระบบแล้ว URL ต้องเป็น `/login` เท่านั้น
2. เปิด `/` แบบยังไม่ login แล้ว quick link ต้องไป `/login` เท่านั้น
3. Login เป็น Staff แล้ว Staff Dashboard ต้องไม่แสดง `QR / Table Order` และ `Delivery Order` แบบ `/order`, `/delivery`
4. Login เป็น Staff แล้วเมนูต้องแสดงตามสิทธิ์และไม่ข้าม tenant
5. Login เป็น cashier ร้านอาหาร ตรวจว่าใช้เมนูแคชเชียร์ร้านอาหารได้
6. Login เป็น cashier ร้านค้า ตรวจว่าเห็น Retail POS เฉพาะเมื่อ profile module/tenant type อนุญาต
7. เปิด POS แล้วขาย Online ได้ตามเดิม
8. ปิดเน็ตขาย Offline ได้ตามเดิม
9. เปิดเน็ตแล้ว Manual Sync ได้ตามเดิม
10. ตรวจว่า record สำคัญยังมี `tenantId`

## Next Tasks

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- แยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`
- Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
