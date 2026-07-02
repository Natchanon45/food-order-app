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

- Version: `0.12.64`
- Build: `2026.07.02.018`
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

## Current Milestone

`POS Hardening 002`

## แก้แล้วรอบนี้

- บังคับ logout redirect ไป `/login` เท่านั้น
- Public Landing เหลือ quick link ไป `/login` เท่านั้น ไม่ปล่อย `/order` หรือ `/delivery` แบบไม่มี tenant
- ตัด Staff Dashboard card `QR / Table Order` และ `Delivery Order` ออก เพราะลิงก์ที่ถูกต้องต้องมี tenant slug เช่น `/s/saas-test-shop/order` และ `/s/saas-test-shop/delivery`
- Staff Dashboard เหลือเมนูพนักงานตามสิทธิ์: ครัว, แคชเชียร์ร้านอาหาร, Retail POS, จัดการระบบ, จัดการพนักงาน
- เพิ่ม module guard เบื้องต้นให้ POS card ตรวจ `module`, `modules`, `allowedModules`, `tenantType`, `businessType` ถ้ามีข้อมูลใน profile
- เพิ่ม role `manager` ใน `STAFF_ROLES` เพื่อให้ dashboard/POS ตรวจสิทธิ์สอดคล้องกับ `/pos`
- `/` bump `home-dashboard.css?v=20260702-018`
- `/` bump `home-session-fa.js?v=20260702-018`
- Developer Panel เป็น Version `0.12.64` Build `2026.07.02.018`

## Regression Tests สำคัญ

1. กดออกจากระบบแล้ว URL ต้องเป็น `/login` เท่านั้น
2. เปิด `/` แบบยังไม่ login แล้ว quick link ต้องไป `/login` เท่านั้น
3. Login เป็น Staff แล้ว Staff Dashboard ต้องไม่แสดง `QR / Table Order` และ `Delivery Order` แบบ `/order`, `/delivery`
4. Login เป็น Staff แล้วเมนูต้องแสดงตามสิทธิ์และไม่ข้าม tenant
5. Login เป็น cashier ร้านอาหาร ตรวจว่าใช้เมนูแคชเชียร์ร้านอาหารได้
6. Login เป็น cashier ร้านค้า ตรวจว่าเห็น Retail POS เฉพาะเมื่อ profile module/tenant type อนุญาต
7. เปิด POS แล้วขาย Online ได้ตามเดิม
8. ปิดเน็ตขาย Offline ได้ตามเดิม
9. เปิดเน็ตแล้ว Manual Sync ได้ตามเดิม
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
