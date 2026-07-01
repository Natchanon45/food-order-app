# Food Order / Delivery / Retail POS

ระบบร้านอาหารและร้านค้าปลีกบน Firebase รองรับ QR Table Order, Take Away, Delivery, Kitchen, Cashier และ Retail POS

## Current Branch

- Branch: `feature/retail-pos`
- Current milestone: `HOTFIX Take Away Kitchen Submit & Mobile UX`
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
- Take Away ส่งเข้าครัวด้วย orderType `takeaway`
- Cashier แยกการ์ด Take Away ออกจากโต๊ะและ Delivery
- Cashier กดเรียกรับของและกดส่งมอบแล้วได้
- Hotfix: คืน `getStoreSettings()` ใน `data-service.js` เพื่อให้ Delivery โหลดเมนูและ settings ได้
- Hotfix: Take Away ส่งออเดอร์โดยไม่ใช้ public counter transaction
- Hotfix: อัปเดต Firestore Rules ให้ public tenant Take Away create order ได้
- Hotfix: โคลน sticky category และ mobile scrollspy จากหน้า QR โต๊ะมาหน้า Take Away
- Hotfix: toast alert ถูกบังคับเป็น top layer เหนือ cart bar และ overlay ทุกกรณี
- Hotfix: bump cache `app.css?v=20260701-010`, `takeaway-order.js?v=20260701-010`, `takeaway/index.html`

## Current Milestone

`HOTFIX Take Away Kitchen Submit & Mobile UX`

## Regression Tests

1. Deploy hosting และ firestore rules ใหม่
2. เปิด `/s/{tenantSlug}/takeaway/` ต้องเห็นหน้า `สั่งกลับบ้าน`
3. Console ต้องไม่ยิง `counters/takeaway_...` จากหน้า Take Away
4. เลือกเมนูและส่งออเดอร์ ต้องได้เลขคิว `TA-xxx`
5. ออเดอร์ Take Away ต้องเข้า Kitchen
6. หน้า Take Away mobile ต้องมี sticky หมวดหมู่เหมือนหน้า QR โต๊ะ
7. เลื่อนเมนูบน mobile แล้วหมวดหมู่ active ต้องเปลี่ยนตามรายการที่เลื่อนถึง
8. toast alert ต้องอยู่ layer บนสุด ไม่โดน cart bar บัง
9. หน้า Cashier ต้องเห็น QR Take Away และปุ่มสั่งกลับบ้าน
10. QR Table Order และ Delivery ต้องยังทำงานตามเดิม

## Next Tasks

1. O1-T002 Pickup Screen / Counter Display
2. P9-B010 Performance

## Deploy

git pull --rebase origin feature/retail-pos
firebase deploy --only hosting
firebase deploy --only firestore:rules

## Notes

- ต้องอ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงานทุกครั้ง
- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string หรือกำหนด no-cache เฉพาะไฟล์
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
