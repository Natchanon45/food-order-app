# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `Admin Take Away QR Poster`
- Developer Panel version/build ปัจจุบัน: `0.12.29` / `2026.07.01.010`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- เพิ่ม Take Away Order โดยไม่ต้องเปิดโต๊ะจริง
- ลูกค้าสั่ง Take Away ผ่าน `/takeaway/` หรือ `/s/{tenantSlug}/takeaway/` และกรอกชื่อหรือเบอร์โทร
- หน้า Cashier มีปุ่ม QR Take Away และปุ่มสั่งกลับบ้านสำหรับ Cashier สั่งแทนลูกค้า
- หน้า Admin มี QR สำหรับสั่ง Delivery และ QR สำหรับสั่งกลับบ้าน เพื่อพิมพ์แปะหน้าร้าน/หน้า Counter
- Take Away ส่งเข้าครัวด้วย orderType `takeaway`
- Cashier แยกการ์ด Take Away ออกจากโต๊ะและ Delivery
- Cashier กดเรียกรับของและกดส่งมอบแล้วได้
- Hotfix: หน้าครัวแสดง Take Away ด้วยเลขคิว ไม่ปนกับโต๊ะจริง
- Hotfix: อัปเดต Firestore Rules ให้ public tenant Take Away create order ได้
- Hotfix: โคลน sticky category และ mobile scrollspy จากหน้า QR โต๊ะมาหน้า Take Away
- Hotfix: toast alert ถูกบังคับเป็น top layer เหนือ cart bar และ overlay ทุกกรณี

## Current Milestone

`Admin Take Away QR Poster`

## Regression Tests

1. เปิด `/admin`
2. ต้องเห็น `QR สำหรับสั่ง Delivery`
3. ต้องเห็น `QR สำหรับสั่งกลับบ้าน`
4. QR สั่งกลับบ้านต้องชี้ไป `/s/{tenantSlug}/takeaway`
5. ปุ่มคัดลอกลิงก์ / ดาวน์โหลด QR / พิมพ์ ของสั่งกลับบ้านต้องทำงาน
6. เปิด QR สั่งกลับบ้านแล้วต้องเข้า Take Away ไม่ใช่ Delivery
7. ส่ง Take Away แล้วต้องเข้า Kitchen เป็น `Take Away: TA-xxx`
8. QR Delivery เดิมต้องยังทำงาน

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
