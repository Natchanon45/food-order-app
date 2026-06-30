# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string กัน browser cache
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.8`
- Build: `2026.06.30.074`
- Branch: `feature/retail-pos`
- Milestone: `P9-B002 Running Number`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

### Table Order / QR Order

- ลูกค้าสั่งอาหารจาก QR ของโต๊ะ
- รองรับการสั่งหลายรอบจากโต๊ะเดียว
- แสดงรายการที่โต๊ะเคยสั่งแล้ว
- ปรับ mobile spacing ระหว่างรายการอาหารกับตะกร้าแล้ว

### Kitchen

- ครัวรับออเดอร์ realtime
- เปลี่ยนสถานะออเดอร์ได้ตาม flow
- เสิร์ฟรายตัวเฉพาะออเดอร์โต๊ะในร้านได้
- Delivery เมื่อกด `ส่งให้ไรเดอร์แล้ว` จะล็อกเหมือนออเดอร์ที่เสิร์ฟแล้ว

### Cashier / Table Move

- แสดงยอดรวมตามโต๊ะ
- รับชำระเงินและปิดบิลได้
- เปลี่ยนโต๊ะได้โดยย้ายออเดอร์ที่ยังไม่ชำระไปโต๊ะใหม่
- ห้ามปิดโต๊ะถ้ายังมีออเดอร์ค้างหรือยังไม่ชำระ

### POS Retail

ไฟล์หลัก:

- `public/assets/js/retail-pos.js`
- `public/assets/js/retail-pos-firestore-foundation.js`
- `public/assets/js/retail-offline-sale-sync.js`
- `public/assets/js/retail-pos-sync-status.js`
- `public/assets/js/retail-pos-hold.js`
- `public/assets/js/retail-pos-customer-link.js`
- `public/assets/js/retail-pos-loyalty.js`

ทำแล้วใน P8-B001:

- Offline sale sync ใช้ tenant ปัจจุบันเท่านั้น
- ถ้า `sale.tenantId` ไม่ตรงกับ `getTenantId()` จะไม่ sync ข้ามร้าน และ mark เป็น `conflict`
- POS online/offline ใช้ stable `saleId` เดียวกันตั้งแต่กดยืนยันขาย
- Online sale ใช้ path `tenants/{tenantId}/sales/{saleId}`
- Offline sale ใช้ `syncStatus: "pending"`
- Online sale ใช้ `syncStatus: "synced"`
- Stock movement ใช้ deterministic id `${saleId}_${productId}`
- Online transaction เช็ก sale เดิมก่อน เพื่อกันบิลซ้ำและกันตัด stock ซ้ำ
- POS records มี `tenantId`, `shopId`, `channel: "retail-pos"`, `orderType: "pos"`
- UI header แสดงบิล `pending`, `failed`, `conflict`, `syncing`
- มีปุ่ม manual `Sync`

ทำแล้วใน P9-B001:

- เพิ่ม `retail-pos-firestore-foundation.js` เป็น helper กลางของ POS Firestore
- กำหนด collection มาตรฐาน: `sales`, `saleItems`, `stockMovements`, `shifts`, `counters`, `dailySummary`, `syncQueue`, `auditLogs`
- เพิ่ม schema metadata: `schemaVersion`, `deviceId`, `dateKey`, `monthKey`, `deleted`, `createdBy`, `updatedBy`
- Online POS transaction เขียนเพิ่ม `saleItems` แยกรายการสินค้า
- Online POS transaction update `dailySummary/{dateKey}` ใน transaction เดียวกับ sale/stock movement
- Online POS transaction เขียน `syncQueue/{saleId}` เป็น `synced`
- แก้ transaction ให้ read เอกสารทั้งหมดก่อน write ตามข้อกำหนด Firestore

ทำแล้วใน P9-B002:

- เพิ่ม counter helper `counterIdForDate(dateKey)` และใช้เลขบิลรูปแบบ `POS-YYYYMMDD-00001`
- Online sale อ่าน/อัปเดต `counters/POS_{YYYYMMDD}` ใน Firestore transaction เดียวกับ sale/stock/summary
- Offline sale ยังใช้ stable `saleId` เดิม และใช้เลขชั่วคราวแบบ `POS-YYYYMMDD-PENDING-xxxxxx`
- Offline sync ออกเลขบิลจริงจาก counter เมื่อต่ออินเทอร์เน็ตและ sync สำเร็จ
- Offline sync ยังเช็ก `sales/{saleId}` ก่อน write เพื่อกันบิลซ้ำและกันตัด stock ซ้ำ
- `saleItems`, `stockMovements`, `dailySummary`, `syncQueue` ใช้ saleNumber จริงหลัง sync

## เรื่องที่ยังควรทำต่อ / ยังไม่เสร็จสมบูรณ์

### Priority 1 — P9 POS Firestore Foundation

- ทดสอบ online sale ว่า running number เพิ่มต่อเนื่องต่อวัน
- ทดสอบ offline sale > online sync > refresh/sync ซ้ำ ว่าไม่เกิดบิลซ้ำและไม่ตัด stock ซ้ำ
- ทดสอบ tenant mismatch ว่าเข้า conflict จริง
- เพิ่ม Offline Queue Worker + Retry + Conflict Resolver
- เพิ่ม Repository Layer
- เพิ่ม Firestore indexes สำหรับ report/query POS
- เพิ่ม audit log สำหรับ POS sale/refund/void

### Priority 2 — Shift / Closing

- Open Shift
- Close Shift
- Cash Count
- Cash Diff
- Print shift summary

### Priority 3 — Return / Void / Refund

- Return ทั้งบิล
- Return รายการย่อย
- Void ก่อนปิดรอบ
- Refund permission

### Priority 4 — Inventory

- Stock Adjustment
- Stock Count
- Purchase Receive
- Supplier
- Lot / Expire ในอนาคต

## Regression Tests สำคัญ

### POS Online Sale + Running Number

1. เปิด `/pos` online
2. ขายสินค้า 2 บิลในวันเดียวกัน
3. ต้องสร้าง `tenants/{tenantId}/sales/{saleId}` อย่างละ 1 เอกสาร
4. ต้องได้เลขบิลเรียง `POS-YYYYMMDD-00001`, `POS-YYYYMMDD-00002`
5. ต้องอัปเดต `tenants/{tenantId}/counters/POS_{YYYYMMDD}.current`
6. ต้องสร้าง `saleItems` ตามจำนวนรายการสินค้า
7. ต้องสร้าง `stockMovements` deterministic id `${saleId}_${productId}`
8. ต้อง update `dailySummary/{dateKey}` billCount/totalAmount/payment method
9. ต้องเขียน `syncQueue/{saleId}` เป็น `synced`
10. refresh แล้วขายใหม่ได้ตามปกติ

### POS Offline Sync

1. เปิด POS online ให้โหลดสินค้า
2. ตัดเน็ต
3. ขายสินค้า 1 บิล
4. local sale ต้องเป็น `syncStatus: pending`
5. header ต้องแสดง `รอ Sync 1`
6. local sale ต้องมี stable `saleId` เดิม
7. ต่อเน็ต
8. กด `Sync` หรือรอ auto sync
9. sync ต้องสร้าง sale ใน Firestore 1 ใบเท่านั้น
10. sale ที่ sync แล้วต้องได้เลขบิลจริง `POS-YYYYMMDD-xxxxx`
11. stock ต้องลด 1 ครั้งเท่านั้น
12. refresh แล้ว sync ซ้ำ ต้องไม่สร้างบิลซ้ำ/ไม่ลด stock ซ้ำ

### POS Tenant Safety

1. สร้าง local sale ของ tenant A
2. เปลี่ยน context เป็น tenant B
3. sync ต้องไม่ข้ามร้าน
4. local sale ต้องเป็น `syncStatus: conflict`
5. header ต้องแสดง `Conflict 1`

### Table Move

1. เปิดโต๊ะ 4
2. สั่งอาหาร 1 รอบ
3. ย้ายไปโต๊ะ 2
4. ออเดอร์ต้องย้ายไปโต๊ะ 2
5. โต๊ะ 4 ต้องว่าง
6. โต๊ะ 2 ต้อง occupied
7. ยังไม่ชำระ ต้องปิดโต๊ะ 2 ไม่ได้
8. ชำระแล้ว จึงปิดโต๊ะ 2 ได้

## ข้อควรระวัง

- อย่าแก้ไฟล์ใหญ่ถ้าไม่จำเป็น ให้เพิ่ม helper เฉพาะจุดก่อน
- ระวัง browser cache ต้อง bump query string ทุกครั้งที่แก้ JS/CSS ที่ import ใน HTML
- ฟีเจอร์ที่เกี่ยวกับโต๊ะต้องเช็กทั้ง `tableCode` และ `tableToken`
- ฟีเจอร์ที่เกี่ยวกับการชำระเงินต้องแยก `status` กับ `paymentStatus` ให้ชัด
- POS ต้องใช้ `tenantId` และห้าม sync ข้าม tenant
- POS ควรใช้ `channel: "retail-pos"` และ `orderType: "pos"` เพื่อไม่ปนกับ `delivery` และ table order
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write

## Current Milestone

`P9-B002 Running Number`

Scope:

1. Counter-based POS running number
2. Online sale number `POS-YYYYMMDD-00001`
3. Offline pending number before sync
4. Assign official running number during offline sync
5. Preserve stable saleId and duplicate protection
