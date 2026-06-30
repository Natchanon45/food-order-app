# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `P9-B003 Counter`
- Developer Panel version/build ปัจจุบัน: `0.12.11` / `2026.06.30.077`

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
- ลด warning จาก POS auth โดยอ่าน role จาก tenant settings ก่อน collection fallback
- แก้ปุ่มเมนู POS ไม่ให้มี hamburger icon ซ้ำ
- เพิ่ม helper มาตรฐานสำหรับ counter document ของ POS

### POS Firestore Foundation

เพิ่มใน P9-B001:

- เพิ่มไฟล์ `public/assets/js/retail-pos-firestore-foundation.js`
- กำหนด collection มาตรฐานสำหรับ POS: `sales`, `saleItems`, `stockMovements`, `shifts`, `counters`, `dailySummary`, `syncQueue`, `auditLogs`
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

### Counter

เพิ่มใน P9-B003:

- เพิ่ม `buildCounterRow()` ใน `retail-pos-firestore-foundation.js`
- Counter doc มี metadata มาตรฐาน: `counterType`, `channel`, `orderType`, `monthKey`, `lastRunning`, `lastSaleId`, `schemaVersion`
- Online sale ใช้ helper เดียวกันตอน update `counters/POS_{YYYYMMDD}`
- Offline sync ใช้ helper เดียวกันตอนออกเลขบิลจริง
- ยังคง read counter ก่อน write ใน Firestore transaction
- แก้ hamburger icon ซ้ำบนปุ่มเมนู POS

### ยังต้องทำต่อ

- Deploy Firestore Rules และ Hosting
- ทดสอบ online sale ว่า counter เพิ่มต่อเนื่องต่อวัน
- ทดสอบ offline sale > online sync ว่า counter ไม่ซ้ำ
- ทดสอบ refresh/sync ซ้ำ ว่าไม่สร้างบิลซ้ำและไม่ตัด stock ซ้ำ
- ทดสอบ tenant mismatch ว่าเข้า conflict จริง
- เพิ่ม Offline Queue Worker + Retry + Conflict Resolver
- เพิ่ม Repository Layer
- เพิ่ม Firestore Composite Index
- เพิ่ม Audit Log สำหรับ sale/refund/void

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

## Important Regression Tests

### POS Counter Online

1. เปิด POS online ให้โหลดสินค้า
2. ขายสินค้า 2 บิลในวันเดียวกัน
3. `counters/POS_{YYYYMMDD}.current` ต้องเพิ่มจาก 1 เป็น 2
4. `lastRunning` ต้องเท่ากับ `current`
5. `lastSaleId` ต้องตรงกับบิลล่าสุด
6. `lastNumber` ต้องตรงกับ `saleNumber` ล่าสุด
7. ปุ่มเมนูต้องแสดง icon เดียว ไม่ซ้ำ

### POS Offline Sync

1. เปิด POS online ให้โหลดสินค้า
2. ตัดเน็ต
3. ขายสินค้า 1 บิล
4. local sale ต้องเป็น `syncStatus: pending`
5. ต่อเน็ตแล้ว sync
6. sale ที่ sync แล้วต้องได้เลขจริง `POS-YYYYMMDD-xxxxx`
7. counter ต้องเพิ่มครั้งเดียว
8. refresh แล้ว sync ซ้ำ ต้องไม่สร้างบิลซ้ำ/ไม่ลด stock ซ้ำ

## Deploy

```bash
git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
```

## Local Test

```bash
python3 -m http.server 8080 --directory public
```

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string เพื่อกัน browser cache
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
