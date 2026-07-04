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

- Version: `0.12.70`
- Build: `2026.07.02.024`
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
- Retail Category/Product Sort Manager เสร็จแล้ว
- Product Image Storage Rules Fix เสร็จแล้ว
- POS Display Order Hard Rollback เสร็จแล้ว
- Admin Icon Theme Color Fix เสร็จแล้ว
- Admin Action Button Desktop/Mobile Polish เสร็จแล้ว
- Main Login UI Polish เสร็จแล้ว
- Public Landing Icon Polish เสร็จแล้ว
- Floating Login Input Icons เสร็จแล้ว
- Login Input Spacing Balance เสร็จแล้ว
- Login User Circle Icon Polish เสร็จแล้ว
- Login Input Icon Color Polish เสร็จแล้ว
- Login Footer + Legal Pages Polish เสร็จแล้ว
- Public Landing Mobile Layout Polish เสร็จแล้ว
- Public Landing Pricing CTA Design เสร็จแล้ว

## Current Milestone

`POS Hardening 002`

## แก้แล้วรอบนี้

- เพิ่มหัวข้อแพ็กเกจ `ฟรี`, `โปร`, `พรีเมี่ยม` บนหน้าแรก `/`
- เพิ่มปุ่ม `ลงทะเบียน` เป็น design-only ยังไม่ผูกกับการใช้งานจริง
- เปลี่ยน CTA หน้า public landing เป็น `ลงชื่อเข้าใช้`
- ปรับ pricing section ให้ responsive บน Mobile
- แก้เฉพาะ HTML/inline CSS ของหน้าแรก
- ไม่แตะ logic ขาย, Online/Offline, Sync, Stable `saleId`, Firestore หรือ Stock Transaction
- Developer Panel ยังเป็น Version `0.12.70` Build `2026.07.02.024`

## Regression Tests สำคัญ

1. เปิด `/` แล้วต้องเห็นแพ็กเกจ `ฟรี`, `โปร`, `พรีเมี่ยม`
2. ปุ่ม `ลงทะเบียน` ต้องแสดงเป็น design-only และยังไม่ต้องผูก action จริง
3. ปุ่ม `ลงชื่อเข้าใช้` ต้องลิงก์ไป `/login`
4. เปิด `/` บน Mobile แล้ว pricing section ต้องเรียง 1 คอลัมน์ อ่านง่าย
5. เปิด `/login` แล้วระบบเข้าสู่ระบบเดิมต้องยังทำงาน
6. เปิด `/pos/login` แล้วต้องยังใช้ logo `POS` และทำงานเดิม
7. เปิด `/pos` แล้วต้องโหลดหน้าขายได้ ไม่ค้างหรือหน้าขาว
8. ตรวจว่า record สำคัญยังมี `tenantId`

## งานถัดไป

- POS Hardening 003: ตรวจ/ลด event listener ซ้ำและ snapshot unsubscribe patterns ในโมดูลที่มี listener จริง
- ทดสอบการ apply ลำดับสินค้าใน `/pos` แบบปลอดภัยก่อนเปิดใช้อีกครั้ง
- พิจารณาแยกบทบาท cashier ร้านอาหาร / cashier ร้านค้า แบบถาวร หากต้องการ role คนละชุด เช่น `restaurant_cashier` และ `retail_cashier`

## ข้อควรระวัง

- ทุก record สำคัญต้องมี `tenantId`
- ห้าม sync POS ข้าม tenant
- ใช้ stable sale/order id เดิมทั้ง online/offline
- Firestore transaction ต้อง read เอกสารทั้งหมดก่อน write
- ถ้าแก้ JS/CSS ที่ import ใน HTML ต้อง bump query string
- ถ้าแก้ `storage.rules` ต้อง deploy ด้วย `firebase deploy --only storage`
