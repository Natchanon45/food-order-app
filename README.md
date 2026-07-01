# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Take Away Kitchen Served Flow`
- Developer Panel version/build ปัจจุบัน: `0.12.30` / `2026.07.01.012`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- เพิ่ม Take Away Order โดยไม่ต้องเปิดโต๊ะจริง
- ลูกค้าสั่ง Take Away ผ่าน `/takeaway/` หรือ `/s/{tenantSlug}/takeaway/`
- หน้า Admin มี QR สำหรับสั่ง Delivery และ QR สำหรับสั่งกลับบ้าน
- Take Away ส่งเข้าครัวด้วย `orderType = takeaway`
- หน้าครัวแสดง Take Away ด้วยเลขคิว ไม่ปนกับโต๊ะจริง
- หน้าครัว Take Away มีปุ่ม `เสิร์ฟแล้ว` เหมือน QR โต๊ะ
- เมื่อ Take Away เป็นสถานะ `served` แล้ว รายการจะแก้ไขหรือยกเลิกไม่ได้ เหมือนออเดอร์นั่งทานที่ร้าน

## Current Milestone

`Take Away Kitchen Served Flow`

## Regression Tests

1. เปิด `/s/{tenantSlug}/takeaway`
2. ส่ง Take Away ให้เข้า Kitchen
3. หน้า Kitchen ต้องแสดง `Take Away: TA-xxx`
4. กดรับออเดอร์ > เริ่มทำ > พร้อมเสิร์ฟ
5. หลังพร้อมเสิร์ฟต้องเห็นปุ่ม `เสิร์ฟแล้ว`
6. กด `เสิร์ฟแล้ว` แล้วรายการต้องเป็นสถานะ `served`
7. หลัง served ต้องไม่มีปุ่มแก้ไขรายการ
8. หลัง served ต้องไม่มีปุ่มยกเลิกรายการหรือยกเลิกทั้งออเดอร์
9. QR โต๊ะนั่งทานที่ร้านต้องยังทำงานเหมือนเดิม

## Next Tasks

1. O1-T002 Pickup Screen / Counter Display
2. P9-B010 Performance

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string หรือกำหนด no-cache เฉพาะไฟล์
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
