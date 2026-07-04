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

## Current Milestone

`POS Hardening 002`

## แก้แล้วรอบนี้

- ปรับหน้าแรก `/` บน Mobile ให้ card, heading, icon และ spacing เป็นสัดส่วนมากขึ้น
- ปรับ hero, feature cards, quick link และ about card ให้กระชับเหมาะกับจอมือถือ
- ปรับลิงก์ Privacy / Terms เป็นปุ่มแยกบรรทัดบน Mobile ให้กดง่ายและมองเห็นชัด
- ลดขนาด footer version บนหน้าแรก Mobile
- แก้เฉพาะ inline CSS/HTML ของหน้าแรก
- ไม่แตะ logic ขาย, Online/Offline, Sync, Stable `saleId`, Firestore หรือ Stock Transaction
- Developer Panel ยังเป็น Version `0.12.70` Build `2026.07.02.024`

## Regression Tests สำคัญ

1. เปิด `/` บน Mobile แล้ว card ต้องเรียงเป็นสัดส่วน อ่านง่าย ไม่อัดหรือเหลื่อม
2. icon และหัวข้อใน hero/feature/quick/about ต้องอยู่แนวเดียวกัน ไม่ทับตัวหนังสือ
3. ปุ่ม `เข้าสู่ระบบสำหรับพนักงาน` บน Mobile ต้องกว้างเต็ม card และกดง่าย
4. ลิงก์ Privacy / Terms บน Mobile ต้องเป็นปุ่มแยกชัดเจน
5. Footer version หน้าแรกบน Mobile ต้องเล็กลงและไม่เด่นเกินเนื้อหา
6. เปิด `/login` แล้ว icon ช่องอีเมลและรหัสผ่านต้องเป็นสีเขียวทั้งตอนปกติ, focus และ floating
7. เปิด `/pos/login` แล้วต้องยังใช้ logo `POS` และทำงานเดิม
8. เปิด `/pos` แล้วต้องโหลดหน้าขายได้ ไม่ค้างหรือหน้าขาว
9. ตรวจว่า record สำคัญยังมี `tenantId`

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
