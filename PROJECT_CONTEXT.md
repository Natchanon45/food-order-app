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

- Version: `0.12.62`
- Build: `2026.07.02.016`
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

## Current Milestone

`POS Hardening 002`

## แก้แล้วรอบนี้

- อัปเกรด `retail-pos-hardening.js` เป็น `HARDENING-002`
- เพิ่ม diagnostics สำหรับ long session
- เพิ่ม `window.retailPosHardening.diagnostics()` สำหรับตรวจสถานะด้วย Console
- เก็บ queue summary: pending / syncing / failed / conflict / synced / other
- เก็บ localStorage usage ของ sales / leader / snapshot
- เก็บ uptime, maintenance count, visibility state, online state
- เก็บ event counters: online / focus / visibility / pageshow / storage
- เก็บ memory snapshot ถ้า browser รองรับ `performance.memory`
- ส่ง event `retail-pos-diagnostics`
- `/pos/index.html` bump `retail-pos-hardening.js?v=20260702-016`
- Developer Panel เป็น Version `0.12.62` Build `2026.07.02.016`

## Regression Tests สำคัญ

1. เปิด POS แล้วขาย Online ได้ตามเดิม
2. ปิดเน็ตขาย Offline ได้ตามเดิม
3. เปิดเน็ตแล้ว Manual Sync ได้ตามเดิม
4. Console: `window.retailPosHardening.version` ต้องเป็น `HARDENING-002`
5. Console: `window.retailPosHardening.diagnostics()` ต้องคืน object diagnostics
6. เปิด POS 2 แท็บ แล้ว diagnostics ต้องมี `isLeader` แค่แท็บใดแท็บหนึ่งในช่วงเวลาเดียวกัน
7. ปิดจอ/ปล่อย browser sleep แล้วกลับมา diagnostics ต้องยัง update ได้
8. pending/failed/conflict queue ต้องไม่ถูกลบจาก localStorage
9. ตรวจว่าไม่กระทบ Order / Delivery
10. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- Test รวม / Stabilization / UI เชื่อม service ที่เป็นแกนกลางเข้าหน้าจอจริงเพิ่มเติม

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
