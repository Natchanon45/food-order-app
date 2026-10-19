# คำสั่งเริ่มแชทใหม่ — PENGUIN Hybrid Billing

> คัดลอกข้อความด้านล่างไปวางใน ChatGPT แชทใหม่ แล้วสั่ง "ต่อครับ" ได้เลย
> อัปเดต 2026-10-19 (Asia/Bangkok), candidate Version 0.4.296 Build 2026.10.19.526

## PROMPT FOR NEW CHAT (copy everything below)

โปรด **ต่อยอดงานเดิม PENGUIN Hybrid Billing จาก GitHub Repository `Natchanon45/food-order-app` โดยเฉพาะ** ห้ามแก้ `food-order-app-php80` หรือ Repository อื่น

- ใช้ Mac mini Remote Desktop Commander MCP:
  `/Users/natchanonsripleng/Desktop/Sites/food-order-app`
- Branch พัฒนา: `feature/react-firebase-port` เช็คสถานะ Commit ล่าสุดบน Mac และ GitHub ก่อนแก้ไข **ห้ามเดา SHA**, อ่าน `README.md`, `STRUCTURE.md`, `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md` และไฟล์นี้ก่อนทำ
- Commit ล่าสุดก่อนเริ่มงานนี้คือ `886ca7e3` (phase1); ดู `git log -1` เพื่อหา Commit ใหม่ของ phase2 หลังจากนี้ หากมี
- รักษาไฟล์ untracked `public/react/assets/index-*.js` ของ Build เก่าไว้ ห้าม `git reset --hard`, `git clean`, ลบ หรือทับงาน Local
- ถ้ามีข้อขัดแย้งหรือ Git diverge ให้หยุดตรวจสอบ ไม่บังคับ Merge

**กฎธุรกิจที่ลูกค้ายืนยันแล้ว**
1. ร้านสมัครใหม่เลือก POS, Restaurant/Delivery หรือทั้งสองอย่าง **ไม่ให้เลือก Subscription vs Revenue Share**
2. เดือนแรก **ยกเว้นเฉพาะค่ารายเดือน** ไม่ยกเว้น % จาก Delivery: หากยอด Delivery สะสมถึงเพดานตั้งแต่เดือนแรกต้องคิดส่วนแบ่งทันที
3. เดือนถัดไป ถ้ายอด Delivery สะสมตลอดเดือนไม่ถึงเพดาน คิดค่ารายเดือนเพียงอย่างเดียว (เช่น 590 บาท); ถ้าถึงเพดานคิดแบบ % แทน 590 บาท ไม่เรียกเก็บซ้ำ
4. วันแรกที่ถึงหรือเกินเพดาน: คิด `deliveryThreshold * deliveryShareRate/100` **เฉพาะเพดาน** แม้ยอดจริงจะเกิน เพดานส่วนที่เกินวันนั้นไม่ต้องย้อนคิดอีก
5. วันถัด ๆ ไปจนจบเดือน: คิด % เฉพาะยอด Delivery ขายได้รายวัน ไม่รวม POS, Table, Takeaway, ค่าส่ง
6. เมื่อมีเงินส่วนแบ่งค้างชำระถึงวันถัดไป ร้านต้องถูกจำกัดการใช้งานจนชำระครบ โดยเจ้าของ/แอดมินต้องยังเข้าหน้าบิล/ชำระได้ ห้ามเปิดทั้งระบบเพียงเพราะส่งรูปสลิปมา ต้องตรวจยืนยันจริง
7. ทุกต้นเดือน Reset ยอด Delivery สะสม แต่ต้องรักษาหนี้ค้างของเดือนก่อน
8. Super Admin ต้องเปลี่ยน `monthlyFee`, `deliveryThreshold`, `deliveryShareRate`, `monthlySlipQuota` ได้ ไม่มีการ Hardcode ตัวเลข; ก่อนถึงเพดานมีโควตาสลิปต่อเดือน เช่น 100 ครั้ง หลังถึงเพดานไม่จำกัดเชิงสิทธิ์ (ยังขึ้นกับทรัพยากร Provider)
9. ต้องใช้เวลาไทย Asia/Bangkok, เงินหน่วยสตางค์, ไอดีธุรกรรมที่ Idempotent และ snapshot เงื่อนไขค่าบริการรายเดือน ป้องกันการเปลี่ยนราคาไปแก้บิลเก่า
10. ห้ามเปลี่ยนนโยบายลูกค้าเดิม Subscription/Revenue Share โดยอัตโนมัติ

**สิ่งที่ทำสำเร็จ (candidate เท่านั้น)**
- Phase1 commit `886ca7e3`: `functions/hybrid-billing-core.js` เป็นตัวคำนวณที่ไม่มี Side effects; `hybrid-billing-settings.js` ค่ากลางจาก Super Admin; ลงทะเบียน `hybrid_v1` ที่ Backend บังคับ, React RegisterPage เปลี่ยนใหม่, PlatformPricingPage ตั้งค่า 4 ค่า, เงื่อนไข legacy ไม่ทับ Hybrid, localization TH/EN/MY/LO/KM, Tests.
- Phase2: `functions/hybrid-billing-orders.js` คัดยอด **paid Delivery + paidAt ของ Server เท่านั้น** ไม่รวม POS/อื่น ๆ/ส่งของ/คืนเงิน; `functions/hybrid-billing-preview.js` Callable read-only `getTenantHybridBillingPreview` รวมยอดด้วย Firestore order scans แบบ paginate, จำกัดจำนวน 50,000, ยึด snapshot รายเดือนถ้ามี; หน้า `/reports/hybrid-billing` แสดง Preview, Dashboard entry เฉพาะ Hybrid, รองรับบทบาท Owner/Admin ตอน Billing suspended, ปรับ CSS/i18n.
- เอกสารนี้และ `docs/HYBRID_BILLING_IMPLEMENTATION.md` คือแผนและสถานะรวม ทั้งสองชุดโค้ด **ไม่ใช่ระบบเรียกเก็บเงินจริง**
- Candidate Version `0.4.296`, Build `2026.10.19.526`; **production ล่าสุดยังเป็น 0.4.294 / .524** จนตรวจสอบการ Deploy จริง

**Safety gate — สำคัญมาก**
- `functions/hybrid-billing-settings.js` มี `HYBRID_REGISTRATION_READY = false` และ `functions/public-signup.js` บล็อกการสมัคร/activate แบบ Hybrid จนกว่า Engine เรียกเก็บจริงจะครบ ห้ามเปิด flag ก่อนผ่าน UAT
- Phase2 เป็น **read-only preview**, ยังไม่มีการสร้างใบแจ้งหนี้จริง การชำระผ่านสลิป ยอดค้าง บังคับโควตา หรือ Scheduled Lock/Unlock
- **ห้าม Firebase Production Deploy ระหว่างที่ยังไม่พร้อม** ห้าม Deploy Functions/Rules/Storage Rules หรือเขียน Tenant/Order/Payment ของลูกค้าจริงโดยไม่ตรวจผลกระทบ/ยืนยันขอบเขต
- ยัง **ไม่ Merge เข้า main** จนกว่าจะทดสอบและผู้ใช้อนุมัติให้ Merge

**งานลำดับถัดไป**
1. ออกแบบและพัฒนา **Idempotent server-side billing event ledger + immutable invoice** จาก paid Delivery order ที่ได้รับอนุมัติแล้ว (หลังคำนวณ threshold ข้ามวัน; ต้องรองรับ concurrency, canceled/refunds, ตัดรอบ, ปิดยอดรายวันตามเวลาที่สมเหตุผล)
2. ออกแบบ **Daily charge payment & Slip2Go / manual review**: แยก slip evidence กับ approved payment; ตรวจ Slip2Go recipient, amount, duplicate; ledger รายการค้าง; ป้องกัน race/duplicate และทดสอบผิดจำนวน
3. **Suspension / recovery**: เฉพาะหนี้ที่ครบกำหนด, ไม่ล้างหนี้เมื่อเปลี่ยนเดือน, เปิด Owner/Admin billing-only; สอดคล้อง AuthProvider/TenantProvider และ Firebase backend guards
4. **Slip quota**: เชื่อมจุด verify Delivery จริง `functions/delivery-slip.js` โดยทำ atomic per-tenant per-month quota reservation; unlimited เมื่อข้าม threshold; ระวัง technical quota Provider
5. ตอบประเด็นนโยบายก่อน go-live: เดือนแรกคือเดือนปฏิทินหรือ 30 วันหลังเปิดร้าน, วันครบกำหนดค่ารายเดือน, นิยาม attempts/approved ของโควตา, ความหมายคืนเงินหลังปิดบิล, ความหมายยอดขายรายวันหลังตัดรอบ, เงินส่วนเกินวัน Trigger ที่ตกลงแล้วว่าไม่ย้อนหลัง
6. เพิ่ม unit/security/emulator tests และ UAT PC/mobile, update .md, bump Version/Build ก่อน Hosting release, ตรวจ Backend rollout plan
7. เมื่อพร้อมจริง ใช้ MCP Remote สั่งทดสอบ/Build/Deploy บน Mac Mini ให้จบ โดย **ไม่โยนคำสั่ง Deploy ให้ผู้ใช้ทำเอง**; ตรวจ Live หลัง Deploy และแจ้งผลตามจริง

**การเริ่มลงมือแชทใหม่**: ตรวจ `git status --short --branch`, `git log -3 --oneline`, `git fetch origin`, `git diff --check`; อ่านไฟล์แผน; ตรวจ test `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run verify:react-build`; แล้วพัฒนา Next Phase ต่อทันทีและอัปเดต `docs/NEXT_CHAT_HANDOFF.md` + `docs/WORKLOG.md` + ไฟล์นี้เมื่อเสร็จทุกช่วง

จบคำสั่งเริ่มแชทใหม่
