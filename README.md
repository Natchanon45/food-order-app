# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B001 POS Firestore Foundation`
- Developer Panel version/build ปัจจุบัน: `0.12.7` / `2026.06.30.073`

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

### ยังต้องทำต่อ

- ทดสอบ online sale หลังเพิ่ม `saleItems`, `dailySummary`, `syncQueue`
- ทดสอบ offline sale > online sync > refresh/sync ซ้ำ ว่าไม่เกิดบิลซ้ำและไม่ตัด stock ซ้ำ
- ทดสอบ tenant mismatch ว่าเข้า conflict จริง
- เพิ่ม counter-based running number: `POS-YYYYMMDD-00001`
- เพิ่ม shift opening/closing
- เพิ่ม audit log สำหรับ sale/refund/void
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
  counters/{counterId}
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

### POS Online Sale + Firestore Foundation

1. เปิด POS online ให้โหลดสินค้า
2. ขายสินค้า 1 บิล
3. ต้องสร้าง `sales/{saleId}` 1 เอกสาร
4. ต้องสร้าง `saleItems/{saleId_productId}` ตามรายการสินค้า
5. ต้องสร้าง `stockMovements/{saleId_productId}` และลด stock 1 ครั้ง
6. ต้อง update `dailySummary/{YYYYMMDD}`
7. ต้องสร้าง/อัปเดต `syncQueue/{saleId}` เป็น `synced`
8. refresh แล้วขายบิลใหม่ได้ตามปกติ

### POS Offline Sync

1. เปิด POS online ให้โหลดสินค้า
2. ตัดเน็ต
3. ขายสินค้า 1 บิล
4. local sale ต้องเป็น `syncStatus: pending`
5. header ต้องแสดง `รอ Sync 1`
6. ต่อเน็ต
7. กด `Sync` หรือรอ auto sync
8. sync ต้องสร้าง sale ใน Firestore 1 ใบเท่านั้น
9. stock ต้องลด 1 ครั้งเท่านั้น
10. refresh แล้ว sync ซ้ำ ต้องไม่สร้างบิลซ้ำ/ไม่ลด stock ซ้ำ

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
