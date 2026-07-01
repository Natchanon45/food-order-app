# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `O1-T001.2 Tenant Take Away Route Fix`
- Developer Panel version/build ปัจจุบัน: `0.12.26` / `2026.07.01.007`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- เพิ่ม Take Away Order โดยไม่ต้องเปิดโต๊ะจริง
- Take Away ใช้เลขคิว `TA-001`, `TA-002`, ... รายวัน
- ลูกค้าสั่ง Take Away ผ่าน `/takeaway/` หรือ `/s/{tenantSlug}/takeaway/` และกรอกชื่อหรือเบอร์โทร
- หน้า Cashier มีปุ่มเปิดลิงก์ Take Away และคัดลอกลิงก์ให้ลูกค้า Walk-in
- Take Away ส่งเข้าครัวด้วย orderType `takeaway`
- Cashier แยกการ์ด Take Away ออกจากโต๊ะและ Delivery
- Cashier กดเรียกรับของและกดส่งมอบแล้วได้
- แก้ Cashier ไม่ให้แสดง `Invalid Date` เมื่อ order ใช้ Firestore server timestamp หรือข้อมูลวันที่ไม่สมบูรณ์
- แก้ Firebase Hosting route ให้ `/s/{tenantSlug}/takeaway/` เปิดหน้า Take Away ไม่ตกไปหน้า Delivery

## Retail POS Status

ทำแล้ว:

- POS รองรับ online/offline/sync/tenant
- ใช้ stable `saleId` เดียวกันทั้ง online/offline
- กัน duplicate ด้วย sale document id
- กันตัด stock ซ้ำด้วย deterministic stock movement id
- เพิ่ม Running Number `POS-YYYYMMDD-00001`
- เพิ่ม Repository Layer เบื้องต้น `retail-pos-repository.js`
- เพิ่ม OfflineQueueWorker สำหรับ retry อัตโนมัติ
- เพิ่ม Firestore composite indexes สำหรับ Retail POS collections
- เพิ่ม audit log สำหรับการขาย POS ที่บันทึกสำเร็จบน Firestore
- ปรับระบบเปิดกะ/ปิดกะ
- ปรับคืนสินค้า/คืนเงิน/VOID

## Current Milestone

`O1-T001.2 Tenant Take Away Route Fix`

## Regression Tests

1. เปิด `/cashier/`
2. ต้องเห็นปุ่ม `เปิด QR Take Away` และ `คัดลอกลิงก์`
3. กดเปิด QR Take Away ต้องไปที่ `/s/{tenantSlug}/takeaway/` ถ้ามี tenant slug หรือ `/takeaway/` เป็น fallback
4. เปิด `/s/{tenantSlug}/takeaway/` ต้องเห็นหน้า `สั่งกลับบ้าน` ไม่ใช่หน้า Delivery
5. เปิด `/takeaway/` ต้องยังใช้งานได้
6. กรอกชื่อหรือเบอร์โทรอย่างน้อย 1 อย่าง
7. เลือกเมนูและส่งออเดอร์ ต้องได้เลขคิว `TA-xxx`
8. หน้า Cashier ต้องแสดงวันที่/เวลา ไม่ใช่ `Invalid Date`
9. ออเดอร์ Take Away ต้องเข้า Kitchen ได้เหมือนออเดอร์ทั่วไป
10. QR Table Order และ Delivery ต้องยังทำงานตามเดิม

## Next Tasks

1. O1-T002 Pickup Screen / Counter Display
2. P9-B010 Performance

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
firebase deploy --only firestore:indexes

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string เพื่อกัน browser cache
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
