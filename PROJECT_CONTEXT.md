# Food Order App — Project Context / POS Roadmap

Repository: `Natchanon45/food-order-app`  
Branch: `feature/retail-pos`  
Main product: QR Table Order + Take Away + Kitchen + Cashier + Delivery + Retail POS

## Workflow ที่ต้องยึดทุกครั้ง

1. อ่าน `PROJECT_CONTEXT.md` ก่อนเริ่มงาน
2. เช็ก HEAD ล่าสุดของ `feature/retail-pos` ก่อนแก้ไขทุกครั้ง
3. แจ้ง Version / Build / HEAD ทุกครั้งหลังแก้
4. แก้แบบเล็กและเฉพาะจุด เพื่อลดผลกระทบกับระบบที่ใช้งานได้แล้ว
5. ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
6. หลังแก้ต้องแจ้งไฟล์ที่แก้, สิ่งที่เสร็จ, สิ่งที่เหลือ, regression test
7. แจ้งคำสั่ง deploy ทุกครั้ง

## Version / Build ล่าสุดที่ Developer Panel แสดง

- Version: `0.12.47`
- Build: `2026.07.01.030`
- Branch: `feature/retail-pos`
- Milestone: `Customer Previous Orders Table Code Fix`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order เสร็จ
- Take Away / Kitchen / Cashier / Delivery เสร็จขั้นหลัก
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- Admin Users แสดงเฉพาะพนักงาน ไม่แสดง Owner
- หน้า Order ลูกค้านั่งทานที่ร้านโหลด previous rounds จาก `tableCode`, `tableToken`, และ `movedFromTableCode`
- หน้า Admin รายการสินค้า/อาหารและโต๊ะใช้ icon ล้วนสำหรับสถานะ ไม่มีตัวหนังสือ

## Current Milestone

`Customer Previous Orders Table Code Fix`

## แก้แล้วรอบนี้

- `customer-table-token-orders.js` เพิ่ม query จาก `tableCode` เพื่อให้โต๊ะเดิมเห็นออเดอร์เก่าก่อนทดสอบย้ายโต๊ะ
- `/order/index.html` bump `customer-table-token-orders.js?v=20260701-030`
- `admin-status-icons.js` แสดงเฉพาะ icon `bi-check-square` หรือ `bi-square`
- `/admin/index.html` bump `admin-status-icons.js?v=20260701-030`
- Developer Panel เป็น Version `0.12.47` Build `2026.07.01.030`

## Regression Tests สำคัญ

1. เปิดโต๊ะ A แล้วสั่งอาหารจาก QR
2. ลูกค้าคนเดิมหรืออีกเครื่องเปิด QR โต๊ะ A ต้องเห็นรายการที่เคยสั่ง
3. รอบการสั่งถัดไปต้องต่อจากรอบเดิม
4. Cashier เปลี่ยนโต๊ะ A ไปโต๊ะ B
5. ลูกค้าสแกน QR เดิมของโต๊ะ A ต้องยังเห็นรายการเดิม
6. ลูกค้าสั่งเพิ่มจาก QR เดิม ต้องเข้าโต๊ะ B ที่ active อยู่
7. หน้า Admin สถานะใช้งานต้องเป็น icon `bi-check-square` สีเขียว ไม่มีตัวหนังสือ
8. หน้า Admin สถานะไม่ได้ใช้งานต้องเป็น icon `bi-square` สีเทา ไม่มีตัวหนังสือ

## งานถัดไป

1. O1-T002 Pickup Screen / Counter Display
2. O1-T003 Kitchen Take Away Visual Badge
3. P9-B010 Performance phase 2

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
