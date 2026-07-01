# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `O1-T001 Take Away Order / Pickup Queue`
- Developer Panel version/build ปัจจุบัน: `0.12.24` / `2026.07.01.005`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- เพิ่ม Take Away Order โดยไม่ต้องเปิดโต๊ะจริง
- Take Away ใช้เลขคิว `TA-001`, `TA-002`, ... รายวัน
- ลูกค้าสั่ง Take Away ผ่าน `/takeaway/` และกรอกชื่อหรือเบอร์โทร
- Take Away ส่งเข้าครัวด้วย orderType `takeaway`
- Cashier แยกการ์ด Take Away ออกจากโต๊ะและ Delivery
- Cashier กดเรียกรับของและกดส่งมอบแล้วได้

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

`O1-T001 Take Away Order / Pickup Queue`

## Regression Tests

1. เปิด `/takeaway/`
2. กรอกชื่อหรือเบอร์โทรอย่างน้อย 1 อย่าง
3. เลือกเมนูและส่งออเดอร์ ต้องได้เลขคิว `TA-xxx`
4. Firestore order ต้องมี `orderType = takeaway`, `queueNo`, `customerName`, `customerPhone`, `pickupStatus`
5. ออเดอร์ Take Away ต้องเข้า Kitchen ได้เหมือนออเดอร์ทั่วไป
6. หน้า Cashier ต้องแสดงการ์ด Take Away แยกจากโต๊ะและ Delivery
7. Cashier กดรับชำระเงินได้
8. เมื่อ Kitchen ทำเสร็จเป็น `ready` แล้ว Cashier ต้องกดเรียกรับของได้
9. Cashier กดส่งมอบแล้ว ต้องอัปเดต `pickupStatus = picked_up` และปิดออเดอร์เป็น paid
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
