# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `HOTFIX Take Away Recovery`
- Developer Panel version/build ปัจจุบัน: `0.12.27` / `2026.07.01.008`

## Food Order Status

ทำแล้ว:

- QR Table Order เสร็จ
- Kitchen เสร็จ
- Delivery Lock เสร็จ
- Cashier ย้ายโต๊ะเสร็จ
- เพิ่ม Take Away Order โดยไม่ต้องเปิดโต๊ะจริง
- ลูกค้าสั่ง Take Away ผ่าน `/takeaway/` หรือ `/s/{tenantSlug}/takeaway/` และกรอกชื่อหรือเบอร์โทร
- หน้า Cashier มีปุ่ม QR Take Away และปุ่มสั่งกลับบ้านสำหรับ Cashier สั่งแทนลูกค้า
- Take Away ส่งเข้าครัวด้วย orderType `takeaway`
- Cashier แยกการ์ด Take Away ออกจากโต๊ะและ Delivery
- Cashier กดเรียกรับของและกดส่งมอบแล้วได้
- Hotfix: เพิ่ม route `/s/{tenantSlug}/delivery/` กลับให้ชัดเจนก่อน fallback `/s/**`
- Hotfix: Take Away ส่งออเดอร์โดยไม่ใช้ public counter transaction
- Hotfix: bump cache `takeaway-order.js?v=20260701-008` และ `cashier.js?v=20260701-009`

## Current Milestone

`HOTFIX Take Away Recovery`

## Regression Tests

1. Deploy hosting ใหม่
2. เปิด `/s/{tenantSlug}/delivery/` ต้องโหลดเมนู Delivery ได้
3. เปิด `/s/{tenantSlug}/order/` ต้องเห็นออเดอร์โต๊ะเดิมตาม table token
4. เปิด `/s/{tenantSlug}/takeaway/` ต้องเห็นหน้า `สั่งกลับบ้าน`
5. กรอกชื่อหรือเบอร์โทรอย่างน้อย 1 อย่าง
6. เลือกเมนูและส่งออเดอร์ ต้องได้เลขคิว `TA-xxx`
7. หน้า Cashier ต้องเห็น QR Take Away และปุ่มสั่งกลับบ้าน
8. กด QR Take Away ต้องแสดง QR สำหรับลูกค้าสแกน
9. Cashier กดรับชำระเงิน เรียกรับของ และส่งมอบแล้วได้
10. QR Table Order และ Delivery ต้องยังทำงานตามเดิม

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
