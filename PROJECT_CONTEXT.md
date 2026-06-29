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

- Version: `0.12.4`
- Build: `2026.06.30.052`
- Branch: `feature/retail-pos`
- Milestone ใน panel ยังเก่า: `P7-B027 Table Move`

หมายเหตุ: ควรอัปเดต `public/assets/js/app-info.js` หลังจบชุด P8-B001 ให้ panel ตรงกับงาน POS ล่าสุด

## สถานะล่าสุดของระบบที่ทำไปแล้ว

### 1. Table Order / QR Order

- ลูกค้าสั่งอาหารจาก QR ของโต๊ะ
- มีตะกร้าและรายการรอบปัจจุบัน
- แสดงรายการที่โต๊ะนี้เคยสั่งแล้ว
- รองรับการสั่งหลายรอบจากโต๊ะเดียว
- ปรับ mobile spacing ระหว่างรายการอาหารกับตะกร้าแล้ว

### 2. Kitchen

- ครัวรับออเดอร์แบบ realtime
- เปลี่ยนสถานะออเดอร์ได้: รอรับออเดอร์, ครัวรับแล้ว, กำลังทำ, พร้อมเสิร์ฟ, เสิร์ฟแล้ว
- แก้ไขรายการอาหารรายตัวได้ เช่น ลดจำนวน เปลี่ยนเมนู เพิ่มหมายเหตุ
- ยกเลิกรายการรายตัวได้ก่อนล็อกสถานะ
- ยกเลิกทั้งออเดอร์ได้ก่อนล็อกสถานะ
- เพิ่มปุ่มเสิร์ฟรายตัวเฉพาะออเดอร์โต๊ะในร้าน
- ถ้ากดเสิร์ฟทั้งออเดอร์แล้ว ปุ่มเสิร์ฟรายตัวจะไม่แสดงซ้ำ
- แก้ Toast ไม่ให้ขึ้นข้อความซ้ำแบบ `เสิร์ฟแล้ว แล้ว`
- Delivery เมื่อกด `ส่งให้ไรเดอร์แล้ว` จะล็อกเหมือนโต๊ะที่เสิร์ฟแล้ว: แก้ไข/ยกเลิกรายการ/ยกเลิกทั้งออเดอร์ไม่ได้

### 3. Cashier

- แสดงบิลรวมตามโต๊ะ
- แสดงยอดรวมทั้งโต๊ะ
- รับชำระเงินและปิดบิลได้
- พิมพ์ใบเสร็จได้
- ดูรายละเอียดออเดอร์เดิม/รายการเดิมได้
- เพิ่มระบบเปลี่ยนโต๊ะแล้ว

### 4. Table Move

เงื่อนไขที่ทำไว้:

- โต๊ะเดิมต้องยัง active / occupied
- โต๊ะใหม่ต้องว่างเท่านั้น
- ย้ายเฉพาะออเดอร์โต๊ะที่ยังไม่ชำระ
- โต๊ะเก่าถูกปิดเป็นว่าง
- โต๊ะใหม่ถูกเปิดด้วย token เดิม
- ออเดอร์เดิมย้าย `tableCode/tableName` ไปโต๊ะใหม่

### 5. POS Retail

มีหน้า `/pos` แล้ว และใช้ไฟล์หลัก:

- `public/assets/js/retail-pos.js`
- `public/assets/js/retail-offline-sale-sync.js`
- `public/assets/js/retail-pos-hold.js`
- `public/assets/js/retail-pos-customer-link.js`
- `public/assets/js/retail-pos-loyalty.js`

งานที่ทำล่าสุดใน P8-B001:

- Offline sale sync ใช้ tenant ปัจจุบันเท่านั้น
- ถ้า `sale.tenantId` ไม่ตรงกับ `getTenantId()` จะไม่ sync ข้ามร้าน และ mark เป็น `conflict`
- POS online/offline ใช้ stable `saleId` เดียวกันตั้งแต่กดยืนยันขาย
- Online sale ใช้ path `tenants/{tenantId}/sales/{saleId}` ไม่ใช้ auto id แล้ว
- Offline sale ใช้ `syncStatus: "pending"` เสมอ
- Online sale ใช้ `syncStatus: "synced"` เสมอ
- Stock movement ใช้ deterministic id `${saleId}_${productId}` ทั้ง online และ offline
- Online transaction เช็ก sale เดิมก่อน ถ้ามีอยู่แล้วจะไม่ตัด stock ซ้ำ
- POS records มี `tenantId`, `shopId`, `channel: "retail-pos"`, `orderType: "pos"`

## เรื่องที่ยังควรทำต่อ / ยังไม่เสร็จสมบูรณ์

### Priority 1 — P8-B001 Retail POS Offline Sync Safe

เหลือ:

- เพิ่ม UI แสดงจำนวนบิล pending sync / conflict
- เพิ่มปุ่ม manual retry sync
- ทดสอบ offline sale > online sync > refresh/sync ซ้ำ ว่าไม่บิลซ้ำ/ไม่ตัด stock ซ้ำ
- ทดสอบ tenant mismatch ว่าเข้า conflict จริง
- อัปเดต `app-info.js` ให้ milestone เป็น `P8-B001 Retail POS Offline Sync Safe`
- พิจารณาเพิ่ม `CHANGELOG.md`

### Priority 2 — POS Payment / Receipt

- เพิ่มช่องทางชำระเงินเพิ่มเติมถ้าต้องใช้
- ปรับใบเสร็จ POS ให้ครบข้อมูลร้าน/ผู้ขาย/ช่องทางชำระเงิน
- ตรวจ flow พักบิลกับลูกค้า/แต้มสะสมหลัง stable sale id

### Priority 3 — Sales Report

- รายงานยอดขายรายวัน
- แยกยอดตามวิธีชำระเงิน
- แยกยอดตามช่องทาง: โต๊ะ, POS, Delivery
- สรุปจำนวนบิล / ยอดรวม / ส่วนลด / ยอดสุทธิ
- Export CSV หรือพิมพ์รายงานได้ในอนาคต

### Priority 4 — README หลักยังเก่า

`README.md` ยังเป็น Version 1 และยังไม่สะท้อนระบบ Retail POS / tenant / delivery / kitchen item edit / table move จึงควรปรับในภายหลัง

หัวข้อที่ควรเพิ่มใน README หลัก:

- โครงสร้างระบบปัจจุบัน
- URL สำคัญ
- วิธี deploy ที่ถูกต้อง
- วิธีทดสอบ flow หลัก
- Known issues / Regression tests

## Regression Tests สำคัญ

### A. POS Offline Sync

1. เปิด POS online ให้โหลดสินค้า
2. ตัดเน็ต
3. ขายสินค้า 1 บิล
4. local sale ต้องเป็น `syncStatus: pending`
5. ต่อเน็ต
6. sync ต้องสร้าง sale ใน Firestore 1 ใบเท่านั้น
7. stock ต้องลด 1 ครั้งเท่านั้น
8. refresh แล้ว sync ซ้ำ ต้องไม่สร้างบิลซ้ำ/ไม่ลด stock ซ้ำ

### B. POS Online Sale

1. ขายตอน online
2. สร้าง sale ใน Firestore ด้วย `saleId` ที่ stable
3. ลด stock ทันที
4. สร้าง stock movement id แบบ `${saleId}_${productId}`
5. local sale ต้องเป็น `syncStatus: synced`

### C. POS Conflict / Tenant

1. สร้าง local sale ของ tenant A
2. เปลี่ยน context เป็น tenant B
3. sync ต้องไม่ข้ามร้าน
4. local sale ต้องเป็น `syncStatus: conflict`

### D. สั่งอาหารที่โต๊ะ

1. เปิด QR โต๊ะ
2. ลูกค้าสั่ง 1 รอบ
3. ครัวรับออเดอร์ > เริ่มทำ > พร้อมเสิร์ฟ
4. เสิร์ฟรายตัว
5. ถ้าเสิร์ฟครบ ต้องกลายเป็น `served`
6. แคชเชียร์คิดเงิน
7. โต๊ะกลับว่าง

### E. Delivery Kitchen Lock

1. สั่ง Delivery
2. ครัวรับ > เริ่มทำ > พร้อมจัดส่ง
3. กด `ส่งให้ไรเดอร์แล้ว`
4. รายการต้องแก้ไขไม่ได้
5. รายการต้องยกเลิกไม่ได้
6. ยกเลิกทั้งออเดอร์ไม่ได้

### F. ย้ายโต๊ะ

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

## Current Milestone

`P8-B001 Retail POS Offline Sync Safe`

Scope:

1. Stable sale id
2. Tenant-safe offline sync
3. Idempotent Firestore sale sync
4. No duplicate bill
5. No duplicate stock deduction
6. Pending/conflict sync status UI
