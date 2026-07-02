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

- Version: `0.12.63`
- Build: `2026.07.02.017`
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

## Current Milestone

`POS Hardening 002`

## แก้แล้วรอบนี้

- ปรับหน้า `/` ให้เป็นเมนูกลางรวม Order / Delivery / POS
- เพิ่ม Public quick links สำหรับ `/order`, `/delivery`, `/login`
- จัด Staff Dashboard เป็น 2 กลุ่ม: `Order / Delivery` และ `Retail POS`
- เพิ่มลิงก์ Staff Dashboard: `/order`, `/delivery`, `/kitchen`, `/cashier`, `/pos`, `/admin`, `/admin/users`
- เพิ่ม CSS สำหรับ quick links, dashboard section, POS featured card และ mobile responsive
- `/` bump `home-dashboard.css?v=20260702-017`
- Developer Panel เป็น Version `0.12.63` Build `2026.07.02.017`

## Regression Tests สำคัญ

1. เปิด `/` แล้วเห็นลิงก์ด่วน Order / Delivery / Login
2. Login เป็น Staff แล้วเห็น Staff Dashboard รวมเมนู Order / Delivery / POS
3. คลิก `/order`, `/delivery`, `/kitchen`, `/cashier`, `/pos`, `/admin`, `/admin/users` แล้วไปหน้าถูกต้องตามสิทธิ์
4. ตรวจ role visibility ของ card ไม่ให้ผู้ใช้ที่ไม่มีสิทธิ์เห็นเมนูเกินสิทธิ์
5. เปิด POS แล้วขาย Online ได้ตามเดิม
6. ปิดเน็ตขาย Offline ได้ตามเดิม
7. เปิดเน็ตแล้ว Manual Sync ได้ตามเดิม
8. ตรวจว่าไม่กระทบ Order / Delivery
9. ตรวจว่า record สำคัญยังมี `tenantId`
10. ตรวจ mobile dashboard ว่า card ไม่ล้นจอและกดได้ง่าย

## งานถัดไป

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
