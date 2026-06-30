# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B002.1 Firestore Rules for Running Number`
- Developer Panel version/build ปัจจุบัน: `0.12.9` / `2026.06.30.075`

## Main Modules

- `/order` ลูกค้าสั่งอาหารผ่าน QR โต๊ะ
- `/kitchen` ครัวรับออเดอร์แบบ realtime
- `/cashier` แคชเชียร์ดูยอดรวมตามโต๊ะ รับชำระเงิน และปิดบิล
- `/delivery` ระบบสั่ง Delivery
- `/pos` Retail POS สำหรับขายหน้าร้าน
- `/admin` จัดการเมนู/สินค้า/โต๊ะ/ตั้งค่า

## Retail POS Status

ระบบ POS มีหน้า `/pos` แล้ว และรองรับการขายแบบ online/offline

### ทำแล้ว

- ขายสินค้าในหน้า POS
- บันทึกยอดขาย
- ตัด stock ด้วย Firestore transaction ตอน online
- ขาย offline ได้เมื่อเน็ตล่ม
- sync offline sale กลับ Firestore หลังต่อเน็ต
- ใช้ tenant path: `tenants/{tenantId}/...`
- กัน sync ข้าม tenant
- ใช้ stable `saleId` เดียวกันทั้ง online/offline
- ใช้ sale document id: `tenants/{tenantId}/sales/{saleId}`
- ใช้ stock movement id แบบ deterministic: `${saleId}_${productId}`
- เช็ก sale เดิมก่อน sync เพื่อกันบิลซ้ำและกันตัด stock ซ้ำ
- แสดงสถานะบิล offline ที่ `pending`, `failed`, `syncing`, `conflict` บน header ของ POS
- มีปุ่ม manual `Sync` สำหรับ retry บิล offline ที่ยัง sync ได้
- เพิ่ม counter-based running number รูปแบบ `POS-YYYYMMDD-00001`
- เพิ่ม Firestore Rules สำหรับ POS foundation collections ที่ Running Number transaction ใช้งาน

### POS Firestore Foundation

เพิ่มใน P9-B001:

- เพิ่มไฟล์ `public/assets/js/retail-pos-firestore-foundation.js`
- กำหนด collection มาตรฐานสำหรับ POS:
  - `sales`
  - `saleItems`
  - `stockMovements`
  - `shifts`
  - `counters`
  - `dailySummary`
  - `syncQueue`
  - `auditLogs`
- sale online มี metadata เพิ่ม: `schemaVersion`, `deviceId`, `dateKey`, `monthKey`, `deleted`, `createdBy`, `updatedBy`
- online transaction เขียน `sales`, `saleItems`, `stockMovements`, `dailySummary`, `syncQueue` ใน transaction เดียว
- แก้ลำดับ transaction ให้อ่านเอกสารทั้งหมดก่อน write ตามข้อกำหนด Firestore

### Running Number

เพิ่มใน P9-B002:

- Online POS transaction อ่าน/อัปเดต `tenants/{tenantId}/counters/POS_{YYYYMMDD}`
- เลขบิลจริงใช้รูปแบบ `POS-YYYYMMDD-00001`
- ใช้ counter เพิ่มทีละ 1 ภายใน Firestore transaction เดียวกับ sale/stock/summary
- Offline sale ยังใช้ stable `saleId` เดิมและเลขชั่วคราวแบบ `PENDING`
- เมื่อ offline sync สำเร็จ จะออกเลขบิลจริงจาก counter ของวันที่ขาย
- ยังคงกัน duplicate ด้วย `sales/{saleId}` และ deterministic stock movement id `${saleId}_${productId}`

### Firestore Rules Fix

เพิ่มใน P9-B002.1:

- อนุญาต POS transaction อ่าน/เขียน `tenants/{tenantId}/counters/{counterId}` สำหรับ Running Number
- เพิ่ม rules สำหรับ `saleItems`, `dailySummary`, `syncQueue`
- เตรียม rules สำหรับ `auditLogs` ตาม milestone ถัดไป
- ทุก write ยังต้องมี `tenantId` หรือ `shopId` ตรงกับ tenant path

### ยังต้องทำต่อ

- Deploy Firestore Rules และ Hosting
- ทดสอบ online sale ว่า running number เพิ่มต่อเนื่องต่อวัน
- ทดสอบ offline sale > online sync ว่าได้เลขบิลจริงและไม่ซ้ำ
- ทดสอบ refresh/sync ซ้ำ ว่าไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ
- ทดสอบ tenant mismatch ว่าเข้า conflict จริง
- เพิ่ม Offline Queue Worker + Retry + Conflict Resolver
- เพิ่ม Repository Layer
- เพิ่ม Firestore Composite Index
- เพิ่ม Audit Log สำหรับ sale/refund/void
- เพิ่ม shift opening/closing
- พิจารณาเพิ่ม `CHANGELOG.md`

## Firestore POS Structure

```text
tenants/{tenantId}
  products/{productId}
  sales/{saleId}
  saleItems/{saleId_productId}
  stockMovements/{saleId_productId}
  dailySummary/{YYYYMMDD}
  syncQueue/{saleId}
  shifts/{shiftId}
  counters/POS_{YYYYMMDD}
  auditLogs/{auditId}
```

## Kitchen / Delivery Status

- ครัวเปลี่ยนสถานะออเดอร์ได้ตาม flow
- ออเดอร์โต๊ะในร้านเสิร์ฟรายตัวได้
- เมื่อเสิร์ฟครบ จะเปลี่ยนสถานะเป็น `served`
- Delivery เมื่อกด `ส่งให้ไรเดอร์แล้ว` จะล็อกเหมือนออเดอร์ที่เสิร์ฟแล้ว
- หลังล็อก ครัวจะแก้ไขรายการ/ยกเลิกรายการ/ยกเลิกทั้งออเดอร์ไม่ได้

## Table Order / Cashier Status

- เปิดโต๊ะด้วย QR
- สั่งหลายรอบจากโต๊ะเดียว
- แคชเชียร์คิดเงินรวมตามโต๊ะ
- เปลี่ยนโต๊ะได้ โดยย้ายออเดอร์ที่ยังไม่ชำระไปโต๊ะใหม่
- ห้ามปิดโต๊ะถ้ายังมีออเดอร์ค้างหรือยังไม่ชำระ

## Important Regression Tests

### POS Online Sale + Running Number

1. เปิด POS online ให้โหลดสินค้า
2. ขายสินค้า 2 บิลในวันเดียวกัน
3. ต้องสร้าง `sales/{saleId}` อย่างละ 1 เอกสาร
4. บิลแรกต้องได้ `POS-YYYYMMDD-00001`
5. บิลที่สองต้องได้ `POS-YYYYMMDD-00002`
6. ต้องอัปเดต `counters/POS_{YYYYMMDD}.current`
7. ต้องสร้าง `saleItems/{saleId_productId}` ตามรายการสินค้า
8. ต้องสร้าง `stockMovements/{saleId_productId}` และลด stock 1 ครั้ง
9. ต้อง update `dailySummary/{YYYYMMDD}`
10. ต้องสร้าง/อัปเดต `syncQueue/{saleId}` เป็น `synced`

### POS Offline Sync

1. เปิด POS online ให้โหลดสินค้า
2. ตัดเน็ต
3. ขายสินค้า 1 บิล
4. local sale ต้องเป็น `syncStatus: pending`
5. header ต้องแสดง `รอ Sync 1`
6. ต่อเน็ต
7. กด `Sync` หรือรอ auto sync
8. sync ต้องสร้าง sale ใน Firestore 1 ใบเท่านั้น
9. sale ที่ sync แล้วต้องได้เลขจริง `POS-YYYYMMDD-xxxxx`
10. stock ต้องลด 1 ครั้งเท่านั้น
11. refresh แล้ว sync ซ้ำ ต้องไม่สร้างบิลซ้ำ/ไม่ลด stock ซ้ำ

### Firestore Rules Smoke Test

1. หลัง deploy rules แล้ว เปิด `/pos`
2. ขายสินค้า online 1 บิล
3. Console ต้องไม่ขึ้น `permission-denied` ที่ `counters/POS_{YYYYMMDD}`
4. Firestore ต้องมี `sales`, `saleItems`, `stockMovements`, `dailySummary`, `syncQueue`, `counters`

### POS Tenant Safety

1. สร้าง local sale ของ tenant A
2. เปลี่ยน context เป็น tenant B
3. sync ต้องไม่ข้ามร้าน
4. local sale ต้องเป็น `syncStatus: conflict`
5. header ต้องแสดง `Conflict 1`

### Delivery Kitchen Lock

1. สั่ง Delivery
2. ครัวรับ > เริ่มทำ > พร้อมจัดส่ง
3. กด `ส่งให้ไรเดอร์แล้ว`
4. ต้องแก้ไขรายการไม่ได้
5. ต้องยกเลิกรายการไม่ได้
6. ต้องยกเลิกทั้งออเดอร์ไม่ได้

### Table Move

1. เปิดโต๊ะ 4
2. สั่งอาหาร 1 รอบ
3. ย้ายไปโต๊ะ 2
4. ออเดอร์ต้องย้ายไปโต๊ะ 2
5. โต๊ะ 4 ต้องว่าง
6. โต๊ะ 2 ต้อง occupied
7. ยังไม่ชำระ ต้องปิดโต๊ะ 2 ไม่ได้
8. ชำระแล้ว จึงปิดโต๊ะ 2 ได้

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```

## Local Test

```bash
python3 -m http.server 8080 --directory public
```

หรือใช้ Firebase emulator/serve ตาม environment ที่ตั้งค่าไว้

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string เพื่อกัน browser cache
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
