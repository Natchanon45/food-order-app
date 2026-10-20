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
2. รอบบิลแรกตามวันสมัคร **ยกเว้นเฉพาะค่ารายรอบ** ถ้ายอด Delivery ถึงเกณฑ์ต้องคิดส่วนแบ่งทั้งวันที่ถึงเกณฑ์หลังปิดวัน
3. รอบถัดไป (นับวันชนวันจากวันสมัคร) หากยอดสะสม Delivery ไม่ถึงเกณฑ์ในรอบให้คิดค่ารายรอบเท่านั้น; ถ้าถึงเกณฑ์คิด % เท่านั้น ห้ามคิดซ้ำ
4. วันที่ยอดสะสม Delivery ถึงหรือเกินเกณฑ์ ต้องรอจนวันนั้นปิด 23:59:59 เวลาไทย แล้วคิดเปอร์เซ็นต์ของ **ยอด Delivery ที่จ่ายเงินจริงทั้งหมดของวันนั้น** ไม่ใช่เฉพาะยอด threshold หรือยอด ณ เวลาแตะเกณฑ์ เช่น 09:00 แตะ 10,000 แต่ 23:00 ยอดทั้งวัน 15,500 บาท → 15,500 x 5% = **775 บาท** ไม่ย้อนหลังคิดยอดวันก่อน
5. ตั้งแต่วันถัดไปถึงวันสุดท้ายของรอบบิล คิดเฉพาะ % จากยอด Delivery ที่ชำระเงินจริงของวันใหม่ ไม่รวม POS/Table/Takeaway/ค่าส่ง
6. เมื่อมีเงินส่วนแบ่งค้างชำระถึงวันถัดไป ร้านต้องถูกจำกัดการใช้งานจนชำระครบ โดยเจ้าของ/แอดมินต้องยังเข้าหน้าบิล/ชำระได้ ห้ามเปิดทั้งระบบเพียงเพราะส่งรูปสลิปมา ต้องตรวจยืนยันจริง
7. รีเซ็ตยอดสะสมและโควตาสลิป **ตรงวันสมัครทุกเดือน** เช่น สมัคร 16/10/2026 รอบ 16/10–15/11 รีเซ็ต 16/11 เวลา 00:00 (ไทย) แล้ว 16/12; หนี้ค้างเดิมต้องอยู่ครบ วันที่ 29–31 ปรับเป็นวันสุดท้ายของเดือนที่สั้น แต่เดือนยาวกลับมาใช้วันเดิม
8. Super Admin ตั้งค่า `monthlyFee`, `deliveryThreshold`, `deliveryShareRate`, `monthlySlipQuota` ได้ ห้าม hardcode; โควตาสลิปก่อนถึงเกณฑ์เป็นต่อ **รอบบิลตรงวันสมัคร** หลังถึงเกณฑ์ไม่จำกัดสิทธิ์โดยยังติดข้อจำกัด Provider
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
5. นโยบาย **วันชนวันและ Trigger-day ยอดทั้งวันได้รับการยืนยันแล้ว**; ยังต้องสรุป due date ของค่ารายรอบ, การนับ Slip2Go attempts, credit note/คืนเงินย้อนหลัง, cut-off ของ pending review
6. เพิ่ม unit/security/emulator tests และ UAT PC/mobile, update .md, bump Version/Build ก่อน Hosting release, ตรวจ Backend rollout plan
7. เมื่อพร้อมจริง ใช้ MCP Remote สั่งทดสอบ/Build/Deploy บน Mac Mini ให้จบ โดย **ไม่โยนคำสั่ง Deploy ให้ผู้ใช้ทำเอง**; ตรวจ Live หลัง Deploy และแจ้งผลตามจริง

**การเริ่มลงมือแชทใหม่**: ตรวจ `git status --short --branch`, `git log -3 --oneline`, `git fetch origin`, `git diff --check`; อ่านไฟล์แผน; ตรวจ test `npm run test:hybrid-billing`, `npm run test:react-parity`, `npm run verify:react-build`; แล้วพัฒนา Next Phase ต่อทันทีและอัปเดต `docs/NEXT_CHAT_HANDOFF.md` + `docs/WORKLOG.md` + ไฟล์นี้เมื่อเสร็จทุกช่วง

จบคำสั่งเริ่มแชทใหม่


## อัปเดตจากงาน Phase 3 (2026-10-19)

- ตรวจ Mac/Git แล้ว HEAD เริ่มต้น `c9aef253`, origin ตรงกัน `0/0`, เก็บ hashed Build เดิมทั้งหมด 24 ไฟล์; ยังไม่ได้ Commit/Push/Merge
- เพิ่ม Backend เฉพาะต้นแบบ **ไม่ Export, ไม่ Deploy**: `functions/hybrid-billing-ledger.js` (Snapshot + invoice idempotency), `functions/hybrid-billing-payments.js` (Evidence + Super Admin manual bank approval แบบไม่เชื่อภาพสลิปทันที), `functions/hybrid-billing-arrears.js` (หนี้ค้างและระงับ, รอปลดล็อกอย่างปลอดภัย), `functions/hybrid-billing-slip-quota.js` (Quota จองเครดิตแบบ Atomic จาก trusted paid Delivery preview)
- เพิ่ม Regression Node/Fake transaction 4 ชุดใน `tests/react-parity/hybrid-billing-{ledger,payments,arrears,slip-quota}.spec.mjs` และผูก `npm run test:hybrid-billing` เรียบร้อย
- เอกสารขอบเขตและ UAT: `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/WORKLOG.md`, `docs/NEXT_CHAT_HANDOFF.md` ให้ยึดรายการ Gate ล่าสุด ไม่ใช่ข้อความสถานะ Phase2 ก่อนหน้านี้
- **สำคัญ** ระบบนี้ยังเป็น Candidate เพราะไม่มี Cloud Function callable/scheduler ที่เปิดใช้จริง, UI แจ้งหนี้/ชำระ/Review, Rules/Storage, provider integration, safe Unlock, Emulator/UAT และไม่ได้ Deploy. `HYBRID_REGISTRATION_READY=false` เท่านั้น; Production เดิม .524 ห้ามแตะต้อง
- งานถัดไป: ตรวจ race จริง Firestore Emulator, เติม Security/Storage permission และ payment provider integration, สร้างหน้าบิล+Upload+Super Admin Review, ปลดล็อกร้านอย่างปลอดภัย, เชื่อม quota ใน `delivery-slip.js` เฉพาะ hybrid, ทดสอบ UAT Desktop/Mobile/Staging โดยรักษาร้านเก่า, ตรวจนโยบายยังไม่สรุปใน UAT และรับอนุมัติจึง Rollout

## 2026-10-19 — User-confirmed billing-cycle/trigger update (takes precedence over prior chat)

- Registration date is the anniversary anchor: 16/10/2026 → reset 16/11/2026 (inclusive 16/10 through 15/11), next reset 16/12. NOT calendar months; first anniversary cycle waives fixed fee only. Short months clamp to month-end, then restore original anchor.
- Threshold reached at 09:00 does NOT create an invoice then; after full Bangkok-day close, bill percentage of ALL paid Delivery sales of threshold-crossing day. Example day ends at 15,500 and rate 5% → **775 THB**, not 500. Following days bill ONLY their own paid Delivery daily sales. Previous-day cumulative volume never rebilled.
- Local source functions/core/preview/ledger/slip quota, signup and React report updated to anniversary cycles; regression and UAT matrix updated. **Previous historical Phase1–3 entries specifying calendar months or threshold-only fee are obsolete.**
- Candidate remains source-only while the previous React .526 build remains unchanged; `HYBRID_REGISTRATION_READY=false`; no production deploy or new callable/scheduler. See latest WORKLOG and HYBRID_BILLING_IMPLEMENTATION.md.

### Latest 2026-10-19 Phase 3F checkpoint — supersedes earlier "No Firestore Emulator" notes

- On the authorized Mac mini, Java 25 bundled with Android Studio runs Firebase CLI Firestore Emulator; default system Java 17 alone does not. Repeat synthetic isolation checks with `npm run test:hybrid-billing:emulator`, **8/8 real Firestore integration PASS**, using explicit demo project/localhost/temporary deny-all rules; no production access.
- `tools/run-hybrid-billing-emulator.mjs` runner and `tests/react-parity/hybrid-billing-firestore-emulator.spec.mjs` cover real transaction invoice/arrears/settlement/520-row scan and triple concurrent idempotency. Read latest `docs/WORKLOG.md` and `docs/HYBRID_BILLING_UAT.md` for passed cases.
- Do not repeat completed work; next focus is phantom concurrent paidAt insert/refund and late adjustment policy, secure backend actor + Storage verification, bank review UI/settlement and safe tenant restore, Rules/Storage/Auth emulators and staged UAT. Never enable `HYBRID_REGISTRATION_READY` or deploy real Firebase without explicit approval; preserve 24 old hashed bundles and all uncommitted changes.

### Current Phase 3G checkpoint (after Phase 3F)

- Mac mini `npm run test:hybrid-billing:emulator`: **12/12 real Firestore PASS, 2 TODO release blockers**. Added races for mid-transaction paidAt insert, post-close backdated paid order, refund writer overlapping scan, and simultaneous billing + concurrent order writer.
- Urgent new source findings: Cashier non-PromptPay Delivery saves client ISO-string `paidAt`, which the trusted Timestamp query silently ignores; implement server-authoritative paid receipts with source completeness audit (not string coercion). Existing Firestore Rules tenantBusinessEnabled ignores Hybrid suspension; add guarded Rules and server writes with emulator deny/allow tests while protecting legacy. Add post-close credit adjustment policy. Do not deploy/activate/commit/push/merge without explicit instruction.

## Phase 3G — Auth + Firestore Rules isolated candidate (local-only, 2026-10-19)

- New separate repeatable smoke command: `npm run test:hybrid-billing:rules-emulator`. The runner uses the checked-in `firestore.rules` **read-only** as a source and constructs an extra Hybrid billing `hybridBillingSuspended`/`active` check in a temporary file (never writes it to production rules). Uses fresh demo project `demo-penguin-hybrid-rules-uat`, localhost Auth :9098 + Firestore :8188, Android Studio JDK 25. No deployed rule changes, no Production tenant changes.
- Tests via real Firebase client SDK authentication and real Firestore Rules emulator: **5/5 local candidate scenarios PASS** for normal Hybrid read/update, suspended Hybrid order deny, suspended POS deny, unchanged legacy cashier read/update and billing/tenant fields inaccessible to cashier. This is a **partial policy smoke**, NOT security signoff.
- **Critical unresolved problem:** The Emulator prints `PERMISSION_DENIED: Unable to evaluate the expression as the maximum of 1000 expressions ...` for certain denied write paths. Consequently those writes may have been denied due to evaluation exhaustion, not because the new early guard is correctly evaluating all branches. Fix Rules complexity and rerun explicit allow/deny with no evaluation errors before counting writer authorization as proven. Also protect top-level legacy order write paths, Functions Admin SDK writers and Storage separately.
- Files: `tools/run-hybrid-billing-rules-emulator.mjs`, `tests/react-parity/hybrid-billing-rules-emulator.spec.mjs`, package.json command. No changes to `firestore.rules`, `storage.rules`, `firebase.json` or `.firebaserc`.

**Phase 3G FINAL STRICT SECURITY CHECK (2026-10-19):** `npm run test:hybrid-billing:rules-emulator` runs 5/5 role assertions but **intentionally exits with code 2 (BLOCKED)** because Firestore logged `maximum of 1000 expressions` on denied writes. The temporary candidate therefore MUST NOT be considered proven secure; real `firestore.rules` remains unchanged. The new runner now detects these messages and fails the UAT gate instead of returning a misleading success. In contrast, `npm run test:hybrid-billing:emulator` (transaction emulator) **12/12 PASS, 2 TODO**, focused `test:hybrid-billing` **73/73 PASS**, full React Parity **PASS**, Operational **PASS**, existing React Build .526 contract **PASS**, no new build/Production deploy.

## 2026-10-19 — Phase 3H: Paid Delivery source completeness fail-closed guard

- **Root cause verified:** Cashier's non-PromptPay Delivery write may store `paidAt` as ISO text, while the billing engine's timestamp range cannot select the row. The previous `paidDeliverySale` validator only rejected invalid timestamps it could see; invisible paid orders could cause silent underbilling.
- **Source-only mitigation implemented:** `functions/hybrid-billing-preview.js` now exports `auditPaidDeliveryReceiptCoverage(tenantRef, {transaction,maxRecords})`, a separate paginated Firestore query on ALL `orderType=delivery` + `paymentStatus=paid` records with independent index/order-by document ID, requiring true Firestore Timestamp-derived `toDate()`. Both read-only preview and internal `functions/hybrid-billing-ledger.js` now fail closed on ISO/missing paidAt before billing a period. Ledger audit runs inside its **same Firestore transaction** and before any invoice/period writes; scans bounded to 3,000 paid Delivery receipts per tenant across historical cycles. Overlimit and partial-read data also block issuance. No string conversion or client time trust, no production deployment.
- **Real Firestore Emulator QA:** **14/14 passed + 2 TODOs**. New end-to-end case proves a trusted 10,000 THB paid Delivery order plus an invisible 5,500 THB ISO paidAt cannot generate an underbilled 500 THB invoice or seal a period; invalid ISO and missing paidAt each abort. Read-only preview also aborts. POS ISO paidAt unaffected; 520-order audit pagination and 500-limit cutoff tested. Previous midnight/775 THB, idempotency, bank/arrears, concurrency cases still pass. Focused `npm run test:hybrid-billing` **73/73 PASS**.
- **Release remains BLOCKED:** Guard detects but does **NOT** repair existing ISO-string receipts or create an authoritative payment timestamp, so hybrid shops with these records cannot issue invoices. Need server-trusted non-PromptPay payment capture (cashier role and business guards), controlled reconciliation/migration of legacy data, full source completeness using immutable receipt events, Firestore compound index for `{orderType,paymentStatus}` in staging (`docs/HYBRID_BILLING_INDEXES_CANDIDATE.json` reference ONLY), scalable index/transaction design, late refund credit notes, and suspended-business Rules/backend enforcement. A 3,000-row tenant lifetime cap is an intentional fail-closed staging guard, not a production-scalable solution.
- `npm run test:hybrid-billing:rules-emulator` is **still explicitly BLOCKED (exit 2)** due to Firestore Rules `maximum of 1000 expressions` on denied writes despite 5/5 client assertions. This has NOT been bypassed. No modifications to production Rules/Storage/indexes or Firestore project, no Functions exports/deploy, no commit/push/merge, `HYBRID_REGISTRATION_READY=false`.


### 2026-10-20 Phase 3I checkpoint (latest)

- Hybrid COD internal server module `functions/hybrid-billing-cod-payment.js` created: validates active trusted profile/tenant/COD completion, server-stamps paidAt and Lalamove receipt, idempotent in transaction. Still **not exported, no production change, no Cashier React wiring**; old ISO client paidAt route still exists.
- Test status: Hybrid contracts **77/77 PASS**, real Firestore Emulator **19/19 PASS, 2 TODO**; rules candidate 5/5 assertions but strict **BLOCKED code 2** on 1,000-expression evaluator errors despite early guard attempt. See Worklog/UAT for details and release blockers.


### 2026-10-20 Phase 3J checkpoint — latest

- `functions/hybrid-billing-cod-callable.js` exists as **unexported** v2 Callable candidate (Auth UID from verified context, strict input allowlist, enforceAppCheck:true). Handler-level mock Auth + real Firestore tests pass but no real callable/Auth/AppCheck E2E run. Frontend remains unchanged; production safe.
- `functions/hybrid-billing-cod-payment.js` tightened Lalamove COD to require provider ID/COD enabled/completion markers; browser mutability of these fields remains a blocker until Rules/code writers secured.
- Node Hybrid **81/81 PASS**, Firestore Emulator **21/21 PASS +2 TODO**, temporary Auth+Firestore Rules candidate 7/7 assertions BUT **Security Gate remains BLOCKED exit 2** on rules expression exhaustion. Do not claim Rules are approved. No code deployed, no Build, no commit/push/merge; preserve local dirty tree and 24 hashed assets.


### 2026-10-20 Phase 3K — latest checkpoint

- COD Cashier source plumbing added but **OFF** via `HYBRID_COD_CASHIER_CUTOVER_READY=false`. Read `react-app/src/data/hybridCodCashierRoute.mjs` + `hybridCodCashier.js` + `CashierPage.jsx`. Hybrid COD does NOT fall back to browser ISO `paidAt`; Hybrid PromptPay uses existing review, Legacy unchanged. No live Callable reference until exported and approved.
- Single Firestore Emulator vertical slice covers simulated COD 15,500 → post-day invoice **775** → synthetic slip & bank review → safe recovery pending. Real Emulator **22/22 PASS +2 TODO**, Node Hybrid **87/87 PASS**, full React Parity **PASS**. Rules Candidate security remains BLOCKED exit 2.
- DO NOT enable either cutover/registration flag, deploy production or modify client Rules without a full test matrix. No commit/push/merge or new Build. Remaining blockers in Worklog/UAT; preserve old 24 Vite assets and all uncommitted local source.


---

## HANDOFF CONTRACT — 2026-10-20 (สำคัญ: ต้องใส่ในคำสั่งขึ้นแชทใหม่ทุกครั้ง)

ผู้ใช้กำหนดให้ **ทุกครั้งที่ต้องย้ายแชท/ใกล้จบแชท/โควต้าเริ่มไม่พอ ต้องเตรียมคำสั่งขึ้นแชทใหม่ที่คัดลอกใช้ได้ทันที** และคำสั่งนั้นต้องสั่งแชทใหม่ให้ทำแบบเดียวกันในแชทถัดไป (recursive handoff) โดยไม่ต้องให้ผู้ใช้ร้องขอซ้ำ ยึด **GitHub source-of-truth** เป็นหลักและห้ามเริ่มใหม่โดยไม่ตรวจบริบท GitHub ล่าสุด

**Snapshot จาก CI ที่ตรวจสอบแล้ว (ไม่ใช่สถานะ Production):**
- Repo: `Natchanon45/food-order-app`; canonical branch: `feature/hybrid-billing-github-first`; Draft PR: https://github.com/Natchanon45/food-order-app/pull/7
- GitHub Actions: code commit `f47510c7`, run `39397207041` = 6/6 jobs PASS: Hybrid 96/96; Firestore 31 PASS + 2 TODO; Firestore Rules Hybrid 7 + Legacy 4; Storage 4; Auth+Functions Emulator 4; React source build/Parity/Operational PASS. Subsequent documentation commits do not themselves establish newer code test results.
- Product work: anniversary billing 590 THB or closed-day Delivery 5% at threshold 10,000 THB, day close, invoice, arrears, COD, bank-proof and Super Admin recovery candidates, Rules/Storage source, Owner/Super Admin staged UI and read-only historical paidAt/refund/late-receipt audit. See latest append-only sections of `docs/WORKLOG.md`, `docs/NEXT_CHAT_HANDOFF.md`, `docs/HYBRID_BILLING_UAT.md`.
- All source release flags **FALSE** (`HYBRID_REGISTRATION_READY`, `HYBRID_COD_CASHIER_CUTOVER_READY`, `HYBRID_FINANCE_UI_READY`, `HYBRID_FINANCE_API_READY`); finance/COD/daily candidate exports are NOT active in `functions/index.js`. PR #7 remains Draft, not merged/deployed. Business production NOT ready.
- Release blockers: provenance-backed historical paidAt repair, reviewed real credit/debit notes and refunds, bank verification and real Lalamove status provenance, audit beyond 3,000 rows and indexes, actual Production-like App Check on devices, interactive end-to-end Owner/Super Admin + PC/mobile staging UAT and explicit approved deploy.
- GitHub-first: develop, test, commit and track CI on GitHub; use Mac mini Desktop Commander only for necessary `git pull --ff-only`, environment-only builds/emulators and explicitly approved staging/deploy. Do NOT reset/checkout/clean/delete uncommitted work or the 24 existing untracked hashed JS assets on Mac.
- **Do not confuse this repository with** Flutter `penguin_app`, LUKKAJA or PHP80.

### คำสั่งขึ้น Chat ใหม่ (แม่แบบ คัดลอกได้ และอัปเดตสถานะก่อนส่งทุกครั้ง)

> ต่องาน PENGUIN Hybrid Billing เดิมจาก GitHub โดยทันที ไม่เริ่มเขียนใหม่
>
> Repo: Natchanon45/food-order-app
> Branch: feature/hybrid-billing-github-first
> Draft PR: https://github.com/Natchanon45/food-order-app/pull/7 (ห้าม Merge/Deploy เอง)
>
> **ก่อนทำงาน:** อ่านไฟล์ล่าสุดบน Branch นี้: docs/NEXT_CHAT_HANDOFF.md, docs/WORKLOG.md, docs/HYBRID_BILLING_IMPLEMENTATION.md, docs/HYBRID_BILLING_UAT.md และ docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md โดยอ่านส่วนท้าย/ส่วนล่าสุดก่อน แล้วตรวจ Branch Head, status PR และ GitHub Actions ล่าสุดจาก GitHub จริง ไม่ใช้เลขทดสอบเก่าเป็นสถานะล่าสุดโดยไม่ตรวจ
>
> **สถานะล่าสุดที่ยืนยัน:** CI ของ code commit f47510c7 run 39397207041 ผ่านทั้ง 6 jobs (Hybrid 96/96, Firestore 31+2 TODO, Rules 7+4, Storage 4, actual demo Auth/Functions 4, React build/parity ผ่าน). พัฒนาเพิ่มรายงาน Super Admin แบบอ่านอย่างเดียวสำหรับ paidAt เก่าและยอด refund/late receipt แต่ยังไม่ได้ซ่อมข้อมูลหรือออกใบลดหนี้อัตโนมัติ
>
> **ข้อห้าม:** คง Hybrid registration/COD cashier/finance UI/finance API release flags เป็น false; Functions candidates ไม่ export; ห้ามแก้ข้อมูลการเงินจริงหรือ Deploy/Merge โดยไม่ผ่าน Release UAT และอนุมัติ; ห้าม reset/clean/checkout ที่ทำลายงานยังไม่ Commit บน Mac รวมถึง hashed assets 24 ไฟล์
>
> **Workflow:** GitHub-first เท่านั้นสำหรับแก้ไข/Commit/CI; Mac mini MCP เฉพาะ pull/build/emulator/staging/deploy เมื่อจำเป็นจริงและได้รับอนุญาต ให้พัฒนาให้ครบหนึ่งกระบวนการ ไม่แบ่ง Phase ย่อยมากเกินไป ปิด release blockers จริงโดยเฉพาะ migration paidAt ด้วยหลักฐาน, approved immutable credit notes, audit scale, real bank/Lalamove proof, App Check และ PC/mobile staging UAT
>
> **สำคัญที่สุด — กฎส่งต่องานแบบต่อเนื่อง:** ก่อนแชทนี้จะจบหรือโควต้าจะหมด ให้สร้างคำสั่งคัดลอกเพื่อเปิด Chat ใหม่อีกครั้ง โดยอัปเดต Repo/Branch/PR/Commit/CI ที่ตรวจสอบแล้ว สิ่งที่ทำสำเร็จ สิ่งที่เหลือ ข้อควรระวัง และคำสั่งให้แชทถัดไปจัดทำ handoff สำหรับแชทต่อไปด้วยทุกครั้ง พร้อมอัปเดต docs/NEXT_CHAT_HANDOFF.md และ docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md บน GitHub ห้ามลืมหรือให้ผู้ใช้ทวนอีก

---


## 2026-10-20 — Phase 3M: independently-attested historical paidAt correction candidate (GitHub-only; NOT LIVE)

- Worked solely in `Natchanon45/food-order-app` on `feature/hybrid-billing-github-first`, Draft PR #7. Current verified **code commit `f71c0f2818fe32166976a69aef25f57338e42d21`**, GitHub Actions PR workflow **39399801570 = 6/6 jobs GREEN**. Hybrid focused tests **100/100 PASS**; real isolated Firestore Emulator **33 PASS + 2 explicit TODO**; Auth+Functions, Auth+Firestore Rules (incl legacy baseline), Auth+Storage, React source compile, parity and operational jobs PASS. These are **GitHub/Emulator results, NOT staging/provider/App Check or production acceptance**.
- New **UNEXPORTED** `functions/hybrid-billing-historical-repair.js`: a server-only correction candidate that **refuses to operate without an independently queried bank/Lalamove payment-verification adapter**. Attestation must bind exact tenant/order, recent check, THB and verified gross amount, hashed immutable evidence, bank recipient/platform account or Lalamove provider COMPLETED+COD settled status. The checked-in repository has **NO live independent resolver**; uploaded slip, ISO string or browser data cannot substitute.
- In a Firestore transaction: re-check active Super Admin identity, Hybrid tenant and paid Delivery order, reject a valid canonical receipt, verify receipt gross amount, claim payment reference against duplicate histories and bank billing settlements, write a separate immutable `hybridBillingReceiptCorrections` audit case, and only then stamp canonical Firestore `paidAt` plus case ID on the affected order. Replays with identical verified evidence are idempotent; changed evidence, another order or reused reference fail closed.
- Reconciliation **NEVER** overwrites a sealed invoice/day digest, creates a settlement, issues a credit note or triggers a refund. Already-sealed days are explicitly marked `adjustmentReviewRequired`; later billing still fails closed on changed seals. One real Firestore test proves legacy ISO row repaired with synthetic independent-attestation fixture, original invoice/seals unchanged and +5,500 THB late-source discrepancy requiring manual review. Another proves actor/amount/reference enforcement. External bank/provider attestation is mocked **only in tests**.
- Other release gates remain: implement and audit ACTUAL authenticated independent bank statement/provider adapters and retained evidence, immutable approved credit/debit notes and refund disposition, >3,000 lifetime paid-row scalable canonical receipt ledger/indexes, real Lalamove COD provenance/webhook signature replay protection, real App Check device/domain staging validation, Finance/COD callable wiring only in reviewed staging, full PC/mobile Owner+Super Admin UAT, explicit human Production release approval.
- Keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. Do NOT export the historical repair candidate or existing COD/Finance/Daily prototypes from `functions/index.js`; no production Rules/Functions/Hosting/index deploy, no real tenant/order/payment writes, no Merge. Preserve Mac uncommitted work/24 historic hashed JS assets; no reset/clean.
- **Next exact work:** design approved credit/debit note ledger bound to immutable original invoice and reviewed post-close discrepancy; devise per-cycle scalable provenance receipt snapshots without breaking transaction limits; integrate real independent bank/Lalamove verification in isolated staging credentials; enforce App Check and test authenticated PC/mobile workflow. Leave all monetary activation behind manual release approval.


## CURRENT COPY/PASTE NEW-CHAT COMMAND — 2026-10-20 (Recursive handoff required)

> Continue PENGUIN Hybrid Billing **without restarting**. Repository `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7. Do not merge/deploy or enable money gates without explicit approval.
>
> FIRST read latest appended sections of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`; check actual GitHub branch HEAD, Draft PR, latest commits and GitHub Actions before touching code.
>
> LAST VERIFIED SOURCE code commit `f71c0f2818fe32166976a69aef25f57338e42d21`: six GitHub Actions jobs GREEN in run 39399801570; focused Hybrid Node **100/100 PASS**, real Firestore Emulator **33 PASS + 2 TODO**, Auth/Functions/Rules/Storage + React compile/parity/operational PASS. Later documentation commits may make branch HEAD newer; ALWAYS check actual live commit and rerun CI. No real App Check/bank/provider/PC-mobile staging completion is evidenced.
>
> DONE: signup-anniversary cycle/day-close Delivery-only calculation, immutable invoice/daily seals, manual settlement and guarded recovery candidates, reviewed Rules+Storage, gated Owner/Super Admin JSX, read-only legacy ISO `paidAt` and post-close adjustments review. New UNEXPORTED `functions/hybrid-billing-historical-repair.js` offers evidence-attested, transactionally idempotent correction **only after an independently verified bank/Lalamove adapter exists** (none wired now); two real Firestore tests use MOCK attestation, preserving existing invoices/seals. Full code+test details in latest Worklog.
>
> REMAINING RELEASE BLOCKERS: real external evidence/provenance for old `paidAt` corrections (never trust ISO or uploaded slips), approved immutable credit/debit/refund ledger, paid-row scale over 3,000 and indexes, actual bank and Lalamove webhook/provider reconciliation, live App Check attestations, fully activated staged Owner+Super Admin HTTPS/Storage flow, PC/mobile UAT, explicit production approval. Two Firestore Emulator TODO remain.
>
> SAFETY: keep `HYBRID_REGISTRATION_READY`, `HYBRID_COD_CASHIER_CUTOVER_READY`, `HYBRID_FINANCE_UI_READY`, `HYBRID_FINANCE_API_READY` ALL FALSE; no production exports of COD/Finance/Daily/Historical-Repair candidates; no real-money writes, merge, Firebase deployment, or bypass of fail-closed source/Rules safeguards without approval. Work GitHub-first; Mac MCP only when necessary for safe pull/build/emulator/approved staging. Do not reset/clean/checkout away uncommitted work or 24 older untracked hashed assets on Mac. Do not confuse food-order-app with penguin_app/LUKKAJA/PHP.
>
> NEXT: build immutable reviewed adjustment/credit-note candidate with no automatic refunds or invoice rewrites; plan scalable provenance/index; test all negative cases and CI; only then stage external bank/Lalamove+AppCheck+PC/mobile tests with authorized nonproduction credentials.
>
> CRITICAL RECURSIVE HANDOFF: **BEFORE END OF THIS CHAT/QUOTA prepare a complete immediately-copyable new-chat command again** with current Repo/Branch/Draft PR/latest actual HEAD and verified code SHA/CI runs, successes, open TODOs, blockers, key files/safety gates, and exact next steps; command must contain this SAME recursive handoff requirement for the following chat. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, and `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` on GitHub. Do not ask to restart or lose context.

---

## 2026-10-20 — Phase 3N: immutable UNAPPLIED credit/debit candidates + >3,000 safe-volume UAT (GitHub-only)

- SOURCE repo `Natchanon45/food-order-app`, branch `feature/hybrid-billing-github-first`, DRAFT PR #7 (never merged/deployed), latest VERIFIED source-code commit **`43ef8e08ec87e1e1d91584bc73576de9e8bcaa5c`**, PR GitHub Actions run **39401725967: all 6/6 jobs PASS**. Hybrid focused Node **104/104 PASS**; real Firestore Emulator **37 PASS, 2 explicit TODO**, Auth + Firestore Rules Hybrid/legacy, Auth + Storage, demo Auth + HTTPS Functions, React JSX source compilation, Parity/Operational **PASS**. A 3,001-receipt Firestore test **PASS**: read-only anomaly inventory pages all 3,001 without truncation, while invoice creation refuses to proceed beyond existing 3,000 safe cap and writes **no invoices/periods**. This is NOT high-volume production billing support; it verifies fail-closed safety.
- Added **unexported** `functions/hybrid-billing-adjustments.js` with server-only `recordHybridReviewedAdjustment`. It requires injected **independently verified, fresh, exact tenant/cycle/original-invoice and old/new SHA-256 seal-bound provenance** (NO live adapter exists). Transaction rereads Super Admin role, original invoice, frozen policy/seals, ALL paid Delivery source and canonical Timestamp coverage, recomputes locked invoice with unchanged billing topology. Rejects forged amount/source direction, missing data, receipt coverage >3,000, threshold topology changes, multiple changed days, mismatched evidence, already-used evidence and altered approvals. Browser/user never chooses adjustment cents.
- Creates a single **immutable** `hybridBillingAdjustments/{originalInvoiceId}` row and deduplicated global evidence claim, `credit_note_candidate` or `debit_note_candidate`, with `status=approved_unapplied`, `refundInitiated=false`, `settlementChanged=false`. **NOT a tax credit note, NOT applied to AR, NOT cash paid/refunded, NOT new customer invoice.** Does NOT modify original invoice, period day-seal, settlement or tenant suspension. A new source discrepancy after recording still requires manual review; underlying billing scheduler still FAILS CLOSED on prior changed seals. This is a safety stopgap, not a completed settlement system.
- Emulator examples: Paid Delivery 15,500 THB issued 775 THB; verified 1,000 THB merchandise refund calculates **50 THB UNAPPLIED CREDIT**; late 5,500 THB paid Delivery calculates **275 THB UNAPPLIED DEBIT**; idempotent replay and strict reviewer/source/threshold-denial tests PASS. External proof is **MOCKED in tests only**, not bank, Lalamove or live refund.
- Production release STILL BLOCKED: implement independently attested bank/Lalamove provider and refund data plus audit retention; actual credit-note numbering/tax and settlement/AR/reversal procedure with double-control, 3,000+ immutable receipt index and concurrency-safe day-close, verified Firestore indexes, live App Check on registered devices/domains, staged active Owner/Super Admin Functions+Storage+PC/mobile UAT, two existing Emulator TODOs, explicit human financial release signoff. NO Mac MCP, real money write, Firebase deploy, merge, production function exports or feature gate activation.
- **Next steps:** prioritize provenance-driven immutable receipt event journal and scale architecture with transaction-level read/write race tests; formally decide post-close credit/debit posting/refund/arrears reconciliation (incl settled vs unpaid invoices); integrate real bank/provider adapters in controlled staging, validate Lalamove COD signed confirmation, App Check real tokens and PC/mobile flows. Reviewed source-only notes cannot replace these tests.
- Keep `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`, all candidate exports OFF in `functions/index.js`, DRAFT PR open, no production deployment. Preserve Mac uncommitted files and old 24 hashed JS assets, no reset/clean/unsafe checkout. **Recursive next-chat handoff required in every future chat.**

## COPY/PASTE NEXT-CHAT COMMAND — after Phase 3N (recursive and mandatory)

> Continue **PENGUIN Hybrid Billing** from GitHub; do NOT restart or ask to begin. Repository `Natchanon45/food-order-app`, canonical branch `feature/hybrid-billing-github-first`, Draft PR https://github.com/Natchanon45/food-order-app/pull/7 (remain Draft; no Merge/Deploy). Last verified **code** commit `43ef8e08ec87e1e1d91584bc73576de9e8bcaa5c` (followed by docs-only commit(s); **query actual HEAD at start**), GitHub Actions PR run `39401725967` GREEN 6/6; Hybrid 104/104 PASS, real Firestore 37 PASS + 2 TODO, Auth+Functions/Rules/Storage and React source compile/parity/operational PASS.
>
> FIRST: read the **newest appended sections** of `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md`, and new `docs/HYBRID_BILLING_RELEASE_GATES.md`; verify actual GitHub Branch HEAD/PR #7 status/actions, including later runs. Do not mistake old historical notes for latest state.
>
> COMPLETED: signup-anniversary Bangkok billing and closed-day Delivery 5% at threshold 10,000 THB, immutable invoice/day seals, arrears/recovery, trusted COD candidate, Security/Storage Rules and staged OFF finance Owner/Super Admin JSX, paginated historical paidAt anomaly audit, evidence-bound historical correction CANDIDATE with no live resolver. **NEW:** unexported `functions/hybrid-billing-adjustments.js` records ONE immutable reviewed but **UNAPPLIED** credit/debit candidate per original invoice, independently attested old/new day digest; never changes original invoice, payments, account, tax or refunds. Emulator tests 15,500→775 THB, refund 1,000→50 THB credit, late paid 5,500→275 THB debit, idempotence/authorization/topology denial. Separate 3,001 paid-row Firestore test proves 13-page read-only audit succeeds and invoice creation FAILS CLOSED above 3,000 (not production-scalable).
>
> BLOCKERS: actual independent bank/provider/refund attestation and historic source migration, accounting-approved legal tax credit/debit note and AR/refund settlement posting, receipt ledger scaling/index/concurrency and 2 TODO tests, real signed Lalamove COD provenance, real App Check on domain/device, staged real export/callable/Auth/Storage security, PC/mobile Owner/Super Admin UAT, explicit approved production release. No external bank/Lalamove credential/data or real App Check staging tests were available; do not invent proof.
>
> SAFETY: `HYBRID_REGISTRATION_READY=false`, `HYBRID_COD_CASHIER_CUTOVER_READY=false`, `HYBRID_FINANCE_UI_READY=false`, `HYBRID_FINANCE_API_READY=false`. COD, Finance, Daily, Historical-Repair and Adjustment candidates remain UNEXPORTED in `functions/index.js`. NO Firebase deploy, customer/tenant/order/payment production writes, release switches or Merge without full safety UAT and explicit user authorization. GitHub-first for edits/commits/CI; Mac mini MCP only safe pull/build/emulator or approved nonproduction stage. No reset/clean/checkout that could destroy uncommitted Mac files or 24 old hashed build JS assets. Do not confuse repository with Flutter penguin_app/LUKKAJA/PHP.
>
> NEXT ACTIONS: address the remaining true release blockers rather than polishing offline mock UI: propose accounting and tax credit-note settlement design (paid/unpaid and corrected day), add immutable receipt-event indexes and concurrent close writer fence, integrate verified bank/Lalamove provider in nonproduction with real approved credentials, App Check genuine tokens, UAT PC/mobile, 2 TODOs. Keep all candidates source-only until approved.
>
> **MANDATORY RECURSIVE HANDOFF:** Before this new chat ends or quota becomes insufficient, ALWAYS construct another immediately copyable **next chat command** with latest verified Repo/Branch/Draft PR/HEAD/code SHA/CI, finished work, real test results, remaining blockers, key files, exact next actions and safety gates. The next-chat command MUST itself include this SAME recursive handoff instruction so every future chat repeats it. Update `docs/NEXT_CHAT_HANDOFF.md`, `docs/WORKLOG.md`, `docs/HYBRID_BILLING_UAT.md`, `docs/HYBRID_BILLING_IMPLEMENTATION.md`, `docs/HYBRID_BILLING_NEXT_CHAT_PROMPT.md` and PR #7 on GitHub.
