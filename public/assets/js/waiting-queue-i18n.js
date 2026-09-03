import { getIntlLocale, getLocale, t } from "./i18n.js?v=20260812-099";

const moduleKey = "waiting_queue";
const locale = getLocale();
const intlLocale = getIntlLocale();
const isEnglish = locale === "en";

function tr(key, replacements = {}) {
  return t(`${moduleKey}.${key}`, replacements);
}

function actionTr(key) {
  return t(`waiting_queue_actions.${key}`);
}

function applyStaticTranslations(root = document) {
  root.querySelectorAll?.("[data-wq-i18n]").forEach(element => {
    element.textContent = tr(element.dataset.wqI18n);
  });
  root.querySelectorAll?.("[data-wq-placeholder]").forEach(element => {
    element.setAttribute("placeholder", tr(element.dataset.wqPlaceholder));
  });
  root.querySelectorAll?.("[data-wq-aria]").forEach(element => {
    element.setAttribute("aria-label", tr(element.dataset.wqAria));
  });
  root.querySelectorAll?.("[data-wq-title]").forEach(element => {
    element.setAttribute("title", tr(element.dataset.wqTitle));
  });
}

const actionKeys = new Map([
  ["เรียกคิว", "call"],
  ["ตอบรับแล้ว", "acknowledge"],
  ["เรียกซ้ำ", "recall"],
  ["จัดโต๊ะ", "prepare"],
  ["เลื่อนคิว", "defer"],
  ["ยกเลิก", "cancel"],
  ["ไม่มา", "no_show"],
  ["ลิงก์ลูกค้า", "customer_link"],
]);

const exactKeys = new Map([
  ["ออนไลน์", "controls.online"],
  ["ออฟไลน์", "controls.offline"],
  ["Sync แล้ว", "controls.synced"],
  ["Sync", "controls.sync"],
  ["กำลัง Sync...", "controls.syncing"],
  ["จอเรียกคิว", "controls.display"],
  ["เพิ่มคิว", "controls.add"],
  ["รอเรียก", "queue.status.waiting"],
  ["เรียกแล้ว", "queue.status.called"],
  ["ลูกค้าตอบรับแล้ว", "queue.status.acknowledged"],
  ["กำลังจัดโต๊ะ", "queue.status.preparing_table"],
  ["ขอเลื่อนคิว", "queue.status.deferred"],
  ["เข้านั่งแล้ว", "queue.status.seated"],
  ["ไม่มา/พ้นเวลา", "queue.status.no_show"],
  ["ทั่วไป", "priority.normal"],
  ["ผู้สูงอายุ", "priority.elderly"],
  ["ผู้พิการ", "priority.disabled"],
  ["มีเด็กเล็ก", "priority.young_child"],
  ["เก้าอี้เด็ก", "needs.high_chair"],
  ["พื้นที่รถเข็น", "needs.wheelchair"],
  ["พื้นที่เงียบ", "needs.quiet"],
  ["พื้นที่รถเข็นเด็ก", "needs.stroller"],
  ["ลูกค้ายืนยันกำลังมา", "runtime.customer_on_way"],
  ["ลูกค้าขอยกเลิก", "runtime.customer_cancel"],
  ["ข้อมูลชนกัน", "runtime.data_conflict"],
  ["รอ Sync", "runtime.pending_sync"],
  ["พ้นเวลาตอบรับ", "runtime.response_overdue"],
  ["เลขชั่วคราว", "runtime.provisional"],
  ["ประมาณการ", "runtime.estimate"],
  ["แนะนำ", "tables.recommended"],
  ["คำแนะนำล่าสุด:", "tables.recommended_latest"],
  ["โต๊ะว่าง:", "tables.available"],
  ["ยังไม่มีคิวที่เหมาะสม", "tables.no_match"],
  ["ยังไม่มีโต๊ะว่าง", "tables.empty_title"],
  ["โหลดโต๊ะไม่สำเร็จ", "runtime.load_tables_failed"],
  ["ไม่ระบุชื่อ", "common.unknown_name"],
  ["ไม่มีเบอร์โทร", "common.no_phone"],
  ["เปิดโต๊ะ", "seat.open"],
  ["กำลังเปิดโต๊ะ...", "seat.opening"],
  ["กำลังบันทึก...", "add.saving"],
  ["บันทึกคิว", "add.save"],
  ["เหมาะสม", "seat.suitable"],
  ["ต้องระบุเหตุผล", "seat.reason_required"],
  ["แนะนำสำหรับคิวนี้", "seat.recommended"],
  ["ดำเนินการไม่สำเร็จ", "runtime.operation_failed"],
  ["อัปเดตข้อมูลล่าสุด", "runtime.update_latest"],
  ["อัปเดตคิวไม่สำเร็จ", "runtime.update_failed"],
  ["ส่งเสียงเรียกซ้ำไม่สำเร็จ", "runtime.recall_failed"],
  ["เรียกซ้ำไม่สำเร็จ", "runtime.recall_failed"],
  ["เปิดโต๊ะไม่สำเร็จ", "runtime.seat_failed"],
  ["เปิดโต๊ะเรียบร้อย ต้องการไปหน้าสั่งอาหารตอนนี้หรือไม่?", "runtime.seat_confirm_question"],
  ["เปิดโต๊ะสำเร็จ", "runtime.seat_confirm_title"],
  ["ไปหน้าสั่งอาหาร", "runtime.go_order"],
  ["อยู่หน้านี้", "runtime.stay_here"],
  ["Sync ไม่ครบ", "runtime.sync_incomplete"],
  ["มีรายการ Sync ไม่สำเร็จ", "runtime.sync_error"],
  ["ปรับร้านที่ใช้งานแล้ว", "runtime.tenant_corrected_title"],
  ["ระบบปรับร้านที่ใช้งานให้ตรงกับบัญชีเจ้าของร้านแล้ว ข้อมูลคิวของร้านเดิมยังถูกเก็บไว้และจะไม่ถูก Sync ข้ามร้าน", "runtime.tenant_corrected"],
  ["มีการเรียกข้อมูลถี่เกินไป ระบบพัก 60 วินาทีแล้วจะลองใหม่อัตโนมัติ", "runtime.rate_limited"],
  ["โหลดคิวจากระบบกลาง (MySQL) ไม่สำเร็จ กำลังใช้ข้อมูลสำรองในเครื่อง", "runtime.central_fallback"],
  ["เปิดระบบคิวรอโต๊ะไม่สำเร็จ", "runtime.initialize_failed"],
  ["ระบบคิวรอโต๊ะ", "runtime.system_title"],
  ["ระบบไม่สามารถบันทึกการเปลี่ยนสถานะคิวของร้านนี้ได้ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบร้านที่ผูกกับบัญชี แล้วลองอีกครั้ง", "runtime.permission_error"],
  ["ข้อมูลคิวถูกอัปเดตพร้อมกัน ระบบลองใหม่แล้ว กรุณากดอีกครั้ง", "runtime.retry_conflict"],
  ["คิวถูกแก้ไขจากอุปกรณ์อื่น ระบบกำลังโหลดสถานะล่าสุด", "runtime.queue_conflict"],
  ["สร้าง QR Code ไม่สำเร็จ กรุณาคัดลอกลิงก์ให้ลูกค้าแทน", "runtime.qr_failed"],
  ["ระบุเหตุผลที่เลื่อนคิว เช่น ลูกค้ายังมาไม่ครบ", "runtime.defer_prompt"],
  ["เหตุผลการเลื่อนคิว", "runtime.defer_reason_placeholder"],
  ["กรุณาระบุเหตุผล", "runtime.reason_required"],
]);

const thaiMonthIndexes = new Map([
  ["ม.ค.", 0],
  ["ก.พ.", 1],
  ["มี.ค.", 2],
  ["เม.ย.", 3],
  ["พ.ค.", 4],
  ["มิ.ย.", 5],
  ["ก.ค.", 6],
  ["ส.ค.", 7],
  ["ก.ย.", 8],
  ["ต.ค.", 9],
  ["พ.ย.", 10],
  ["ธ.ค.", 11],
]);

function translateThaiDateTime(value) {
  if (!isEnglish) return null;
  const match = String(value || "").trim().match(
    /^(\d{1,2})\s+(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s+(\d{4})\s+(\d{1,2}):(\d{2})$/
  );
  if (!match) return null;

  const month = thaiMonthIndexes.get(match[2]);
  if (month === undefined) return null;

  const year = Number(match[3]) - 543;
  const date = new Date(year, month, Number(match[1]), Number(match[4]), Number(match[5]));
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const fullPatterns = [
  [/^น้อยกว่า 1 นาที$/, () => tr("common.less_than_minute")],
  [/^(\d+)–(\d+) นาที$/, match => `${match[1]}–${match[2]} min`],
  [/^(\d+) นาที$/, match => tr("common.minutes", { count: match[1] })],
  [/^(\d+) ชม\. (\d+) นาที$/, match => tr("common.hours_minutes", { hours: match[1], minutes: match[2] })],
  [/^(\d+) คน$/, match => tr("common.people", { count: match[1] })],
  [/^(\d+) คิว$/, match => tr("common.queues", { count: match[1] })],
  [/^(\d+) ที่นั่ง$/, match => tr("common.seats", { count: match[1] })],
  [/^เหลือ (\d+) นาที$/, match => `Remaining ${match[1]} min`],
  [/^รอนานเกิน (\d+) นาที$/, match => tr("runtime.long_wait", { count: match[1] })],
  [/^รอ Sync ([\d,]+)$/, match => `${tr("runtime.pending_sync")} ${match[1]}`],
  [/^รับคิว (.+)$/, match => tr("runtime.received_at", { time: match[1] })],
  [/^(\d+) คิวที่เหมาะสมก่อนหน้า$/, match => tr("runtime.ahead_count", { count: match[1] })],
  [/^ข้ามชั่วคราว (\d+) คิว เพราะโต๊ะไม่เหมาะสม$/, match => `Temporarily skipped ${match[1]} queues because the table is not suitable`],
  [/^เพิ่มคิว (\S+) แล้ว$/, match => tr("runtime.added", { queue: match[1] })],
  [/^บันทึกคิว (\S+) ในเครื่องแล้ว รอ Sync$/, match => tr("runtime.saved_offline", { queue: match[1] })],
  [/^คัดลอกลิงก์คิว (\S+) แล้ว$/, match => tr("runtime.copied", { queue: match[1] })],
  [/^ส่งเสียงเรียกคิว (\S+) ซ้ำแล้ว$/, match => tr("runtime.recalled", { queue: match[1] })],
  [/^เรียกคิว (\S+) แล้ว$/, match => tr("runtime.called", { queue: match[1] })],
  [/^เลื่อนคิว (\S+)$/, match => tr("runtime.defer_title", { queue: match[1] })],
  [/^เปิดโต๊ะให้คิว (\S+)$/, match => tr("runtime.seat_title", { queue: match[1] })],
  [/^เปิด (.+) ให้คิว (\S+) แล้ว$/, match => tr("runtime.seat_success", { table: match[1], queue: match[2] })],
  [/^Sync สำเร็จ ([\d,]+) รายการ$/, match => tr("runtime.sync_success", { count: match[1] })],
  [/^(\S+) ยืนยันกำลังมา$/, match => tr("runtime.customer_confirmed", { queue: match[1] })],
  [/^(\S+) ขอยกเลิก$/, match => tr("runtime.customer_requested_cancel", { queue: match[1] })],
  [/^บัตรคิว (\S+)$/, match => `${tr("ticket.title")} ${match[1]}`],
  [/^เหตุผลที่ใช้โต๊ะไม่ตรงเงื่อนไข$/, () => "Reason for using a table that does not meet the queue requirements"],
  [/^เหตุผลที่เลือก (\S+) แทน (\S+)$/, match => `Reason for choosing ${match[1]} instead of ${match[2]}`],
];

const fragmentPatterns = [
  [/ไม่มีเบอร์โทร/g, () => tr("common.no_phone")],
  [/หมายเหตุ:\s*/g, () => "Note: "],
  [/รอจริง (น้อยกว่า 1 นาที|\d+ นาที|\d+ ชม\. \d+ นาที)/g, value => {
    const duration = translateThaiText(value.replace(/^รอจริง /, ""));
    return `Actual wait ${duration}`;
  }],
  [/(\d+) ที่นั่ง/g, value => tr("common.seats", { count: value.match(/\d+/)?.[0] || "0" })],
  [/(\d+) คน/g, value => tr("common.people", { count: value.match(/\d+/)?.[0] || "0" })],
  [/ • รอ /g, () => " • Wait "],
  [/ • รถเข็น/g, () => ` • ${tr("tables.wheelchair")}`],
  [/ • แนะนำสำหรับคิวนี้/g, () => ` • ${tr("seat.recommended")}`],
  [/ • เหมาะสม/g, () => ` • ${tr("seat.suitable")}`],
  [/ • ต้องระบุเหตุผล/g, () => ` • ${tr("seat.reason_required")}`],
  [/ เหมาะกับคิว /g, () => " matches queue "],
  [/ แต่ยังไม่มีคิวที่เหมาะสม/g, () => " but no suitable queue is available yet"],
];

function translateThaiText(value) {
  if (!isEnglish) return value;
  const text = String(value || "");
  const trimmed = text.trim();
  if (!trimmed) return text;

  const localizedDateTime = translateThaiDateTime(trimmed);
  if (localizedDateTime) return text.replace(trimmed, localizedDateTime);

  const actionKey = actionKeys.get(trimmed);
  if (actionKey) return text.replace(trimmed, actionTr(actionKey));

  const exactKey = exactKeys.get(trimmed);
  if (exactKey) return text.replace(trimmed, tr(exactKey));

  for (const [pattern, formatter] of fullPatterns) {
    const match = trimmed.match(pattern);
    if (match) return text.replace(trimmed, formatter(match));
  }

  let translated = text;
  fragmentPatterns.forEach(([pattern, formatter]) => {
    translated = translated.replace(pattern, formatter);
  });
  return translated;
}

function translateNode(node) {
  if (!isEnglish || !node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const translated = translateThaiText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  ["placeholder", "title", "aria-label"].forEach(attribute => {
    if (!node.hasAttribute(attribute)) return;
    const current = node.getAttribute(attribute);
    const translated = translateThaiText(current);
    if (translated !== current) node.setAttribute(attribute, translated);
  });
  node.childNodes.forEach(translateNode);
}

function hydrateFooter() {
  const release = globalThis.APP_RELEASE || {};
  const product = document.querySelector("[data-wq-footer-product]");
  const version = document.querySelector("[data-wq-footer-version]");
  const build = document.querySelector("[data-wq-footer-build]");
  const credit = document.querySelector("[data-wq-footer-credit]");
  if (product) product.textContent = t("shared.footer.product");
  if (version) version.textContent = t("shared.footer.version", { version: release.version || "-" });
  if (build) build.textContent = t("shared.footer.build", { build: release.build || "-" });
  if (credit) credit.textContent = t("shared.footer.icon_credit");
}

function initializePageLocale() {
  document.documentElement.lang = locale;
  document.documentElement.dir = "ltr";
  document.title = tr("meta.title");
  applyStaticTranslations(document);
  hydrateFooter();
  if (isEnglish) translateNode(document.body);

  const observer = new MutationObserver(records => {
    if (!isEnglish) return;
    records.forEach(record => {
      if (record.type === "characterData") translateNode(record.target);
      record.addedNodes.forEach(translateNode);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

initializePageLocale();