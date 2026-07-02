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

- Version: `0.12.66`
- Build: `2026.07.02.020`
- Branch: `feature/retail-pos`
- Milestone: `POS Hardening 002`

## สถานะล่าสุดของระบบที่ทำไปแล้ว

- QR Table Order / Take Away / Kitchen / Cashier / Delivery เสร็จแล้ว
- Retail POS รองรับ Online / Offline / Sync / Tenant แล้ว
- POS Roadmap P9-B001 ถึง P9-B010 เสร็จครบแล้ว
- Manual Sync Hotfix เสร็จแล้ว
- commit ฐานล่าสุดจากผู้ใช้: `927047f`
- POS Hardening 001 เสร็จแล้ว
- POS Hardening 002 เสร็จแล้ว
- Unified Order / Delivery / POS Menu เสร็จแล้ว
- Dashboard Tenant-safe Link Correction เสร็จแล้ว
- Dashboard Final Grouping เสร็จแล้ว
- POS Payment UX Update เสร็จแล้ว

## Current Milestone

`POS Hardening 002`

## แก้แล้วรอบนี้

- ซ่อนปุ่ม `โหลดตัวอย่าง` ออกจากหน้าขาย POS
- เพิ่มไฟล์ `public/assets/js/retail-pos-payment-enter.js`
- เมื่ออยู่ใน Modal รับชำระเงิน และ cursor อยู่ในช่อง `รับเงินมา` สามารถกด Enter เพื่อยืนยันการขายได้
- Enter-to-confirm ใช้วิธี click ปุ่ม `ยืนยันการขาย` เดิม จึงยังใช้ validation และ logic การบันทึกเดิมทั้งหมด
- `/pos/index.html` โหลด `retail-pos-payment-enter.js?v=20260702-020`
- Developer Panel เป็น Version `0.12.66` Build `2026.07.02.020`

## Regression Tests สำคัญ

1. หน้า `/pos` ต้องไม่เห็นปุ่ม `โหลดตัวอย่าง`
2. เปิด Modal รับชำระเงิน ใส่จำนวนเงินในช่อง `รับเงินมา` แล้วกด Enter ต้องเท่ากับกดปุ่ม `ยืนยันการขาย`
3. ถ้ารับเงินไม่ครบ กด Enter แล้วต้องขึ้น validation `จำนวนเงินที่รับมายังไม่ครบ`
4. ถ้ารับเงินครบ กด Enter แล้วขาย Online ได้ตามเดิม
5. ปิดเน็ตขาย Offline แล้วกด Enter เพื่อยืนยันการขายได้ตามเดิม
6. เปิดเน็ตแล้ว Manual Sync ได้ตามเดิม
7. กดออกจากระบบแล้ว URL ต้องเป็น `/login` เท่านั้น
8. Login เป็น owner แล้วเห็นลิงก์ `/pos/catalog`
9. Login เป็น role ที่ไม่ใช่ owner/super_admin แล้วต้องไม่เห็น `POS Catalog`
10. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- พิจารณาแยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`
- Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
