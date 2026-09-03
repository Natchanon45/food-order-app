import { getIntlLocale, getLocale, t } from "./i18n.js?v=20260812-099";

const locale = getLocale();
const intlLocale = getIntlLocale();
const isEnglish = locale === "en";

function tr(key, replacements = {}) {
  return t(`pos.${key}`, replacements);
}

const exactTextKeys = new Map([
  ["ขายดี", "catalog.best_sellers"],
  ["ทั้งหมด", "catalog.all"],
  ["สินค้าหมด", "catalog.out_of_stock"],
  ["ไม่พบสินค้า", "catalog.not_found"],
  ["ยังไม่มีประวัติการขายสำหรับคำนวณสินค้าขายดี", "catalog.no_best_sellers"],
  ["ไม่มีสินค้าในหมวดนี้", "catalog.no_category"],
  ["เซสชันหมดอายุ", "catalog.session_expired"],
  ["โหลดสินค้าจากฐานข้อมูลไม่สำเร็จ", "catalog.load_failed"],
  ["กรุณาเข้าสู่ระบบใหม่เพื่อโหลดข้อมูลของร้าน", "catalog.login_again_help"],
  ["ตรวจสอบเครือข่าย แล้วแตะลองใหม่", "catalog.retry_help"],
  ["เข้าสู่ระบบใหม่", "catalog.login_again"],
  ["ลองใหม่", "catalog.retry"],
  ["กำลังโหลด...", "catalog.loading"],
  ["จำนวนในบิลเกินสต็อกคงเหลือ", "runtime.stock_limit"],
  ["ไม่พบบาร์โค้ดหรือรหัสสินค้านี้", "runtime.barcode_not_found"],
  ["จำนวนเงินที่รับมายังไม่ครบ", "runtime.insufficient_payment"],
  ["กำลังบันทึก...", "runtime.saving"],
  ["กรุณาเข้าสู่ระบบก่อนบันทึกการขาย", "runtime.auth_required"],
  ["บันทึกการขายไม่สำเร็จ กรุณาลองใหม่", "runtime.sale_failed"],
  ["ยืนยันการขาย", "payment.confirm"],
  ["แป้นตัวเลข", "payment.number_pad"],
  ["รับพอดี", "payment.exact"],
  ["ล้าง", "payment.clear"],
  ["ลบตัวเลขล่าสุด", "payment.backspace"],
  ["ปิด", "common.close"],
  ["สมาชิก / ลูกค้า (ไม่บังคับ)", "customer.label"],
  ["ค้นหารหัสสมาชิก ชื่อ หรือเบอร์โทร", "customer.search_placeholder"],
  ["ล้างลูกค้า", "customer.clear_aria"],
  ["ลูกค้าทั่วไป / ไม่ระบุ", "customer.walk_in"],
  ["ลูกค้าทั่วไป", "customer.walk_in_name"],
  ["ไม่ระบุสมาชิก", "customer.not_member"],
  ["ขายโดยไม่ผูกกับทะเบียนลูกค้า", "customer.unlinked_sale"],
  ["ไม่พบลูกค้าที่ค้นหา", "customer.not_found"],
  ["รับชำระเงินสำเร็จ", "complete.title"],
  ["ยอดสุทธิ", "complete.net_total"],
  ["รับเงิน", "complete.received"],
  ["เงินทอน", "complete.change"],
  ["ไม่พิมพ์ เริ่มบิลใหม่", "complete.no_print_new"],
  ["พิมพ์ใบเสร็จ", "complete.print_receipt"],
  ["ถามก่อนพิมพ์", "complete.ask_before_print"],
  ["เปิดหน้าพิมพ์อัตโนมัติ", "complete.auto_print"],
  ["พิมพ์บิล", "receipt.header_title"],
  ["ใบกำกับภาษี", "receipt.tax_invoice"],
  ["กำลังโหลดบิล...", "receipt.loading"],
  ["ใบเสร็จรับเงิน", "receipt.title"],
  ["ใบกำกับภาษีอย่างย่อ / ใบเสร็จรับเงิน", "receipt.abbreviated_tax_title"],
  ["เลขที่", "receipt.bill_number"],
  ["วันที่", "receipt.date"],
  ["ชำระเงิน", "receipt.payment"],
  ["รายการ", "receipt.item"],
  ["ราคา", "receipt.price"],
  ["รวม", "receipt.total"],
  ["รวมสินค้า", "receipt.subtotal"],
  ["ส่วนลด", "receipt.discount"],
  ["โทร", "receipt.phone"],
  ["เลขประจำตัวผู้เสียภาษี", "receipt.tax_id"],
  ["สำนักงานใหญ่", "receipt.head_office"],
  ["บิลนี้บันทึกแบบออฟไลน์ รอส่งข้อมูลเข้าระบบ", "receipt.offline_pending"],
  ["เปิดใบเสร็จ", "runtime.receipt_open"],
  ["ลดจำนวน", "runtime.decrease"],
  ["เพิ่มจำนวน", "runtime.increase"],
  ["ลบออกจากบิล", "runtime.remove"],
  ["บิลพัก", "held.default_name"],
  ["เรียกบิล", "held.resume"],
  ["ลบ", "held.delete"],
  ["ไม่มีบิลที่พักไว้", "held.empty"],
  ["ยังไม่มีสินค้าในบิลสำหรับพักไว้", "held.no_items_message"],
  ["พักบิล", "held.hold_title"],
  ["ระบุชื่อบิลพัก เช่น ลูกค้าเสื้อแดง หรือ คิว 1", "held.prompt_message"],
  ["ชื่อลูกค้า หรือหมายเลขคิว", "held.prompt_placeholder"],
  ["พักบิลแล้ว แต่ต้องตรวจสอบ", "held.saved_review_title"],
  ["พักบิลเรียบร้อยแล้ว • ส่งเข้าระบบแล้ว", "held.saved_synced"],
  ["พักบิลเรียบร้อยแล้ว • รอส่งเมื่อออนไลน์", "held.saved_pending"],
  ["พักบิลสำเร็จ", "held.saved_title"],
  ["บิลพักพร้อมเรียกคืนแล้ว แต่บิลปัจจุบันมีสินค้า กรุณาเปิดรายการบิลพักเพื่อเรียกคืน", "held.resume_ready_message"],
  ["บิลพักพร้อมเรียกคืน", "held.resume_ready_title"],
  ["บิลปัจจุบันยังมีสินค้า ต้องการล้างแล้วเรียกบิลพักหรือไม่?", "held.resume_confirm"],
  ["เรียกบิลพัก", "held.resume_title"],
  ["ล้างและเรียกบิล", "held.resume_confirm_button"],
  ["บันทึกคำขอเรียกบิลแล้ว • จะคืนสินค้าเข้าบิลเมื่อเชื่อมต่อระบบสำเร็จ", "held.resume_pending"],
  ["เรียกบิลไม่สำเร็จ", "held.resume_failed_title"],
  ["บันทึกคำขอแล้ว", "held.request_saved_title"],
  ["ลบบิลพัก", "held.delete_title"],
  ["ลบบิลแล้ว แต่ต้องตรวจสอบ", "held.delete_review_title"],
]);

function formatCount(value) {
  const count = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(count) ? count.toLocaleString(intlLocale) : String(value || "");
}

function translateThaiDateTime(value) {
  const match = String(value || "").trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:น\.)?$/
  );
  if (!match) return null;

  const sourceYear = Number(match[3]);
  const year = sourceYear > 2400 ? sourceYear - 543 : sourceYear;
  const date = new Date(
    year,
    Number(match[2]) - 1,
    Number(match[1]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0),
  );
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function translateText(value) {
  if (!isEnglish) return value;
  const text = String(value ?? "");
  const trimmed = text.trim();
  if (!trimmed) return text;

  const exactKey = exactTextKeys.get(trimmed);
  if (exactKey) return text.replace(trimmed, tr(exactKey));

  let match = trimmed.match(/^([\d,]+)\s+รายการ$/);
  if (match) return text.replace(trimmed, tr("common.item_count", { count: formatCount(match[1]) }));

  match = trimmed.match(/^คงเหลือ\s+(.+)$/);
  if (match) return text.replace(trimmed, tr("catalog.stock", { stock: match[1] }));

  match = trimmed.match(/^เหลือ\s+(.+)$/);
  if (match) return text.replace(trimmed, tr("catalog.remaining", { stock: match[1] }));

  match = trimmed.match(/^([\d,.]+)\s+บาท\s*\/\s*(.+)$/);
  if (match) return text.replace(trimmed, tr("common.price_per_unit", { amount: match[1], unit: match[2] }));

  match = trimmed.match(/^([\d,.]+)\s+บาท$/);
  if (match) return text.replace(trimmed, tr("common.amount_thb", { amount: match[1] }));

  match = trimmed.match(/^โทร\s+(.+)$/);
  if (match) return text.replace(trimmed, tr("receipt.phone_value", { value: match[1] }));

  match = trimmed.match(/^เลขประจำตัวผู้เสียภาษี\s+(.+)$/);
  if (match) return text.replace(trimmed, tr("receipt.tax_id_value", { value: match[1] }));

  match = trimmed.match(/^สาขา\s+(.+)$/);
  if (match) return text.replace(trimmed, tr("receipt.branch", { value: match[1] }));

  match = trimmed.match(/^แสดงเพิ่ม\s+([\d,]+)\s+รายการ$/);
  if (match) return text.replace(trimmed, tr("catalog.show_more", { count: formatCount(match[1]) }));

  match = trimmed.match(/^จากทั้งหมด\s+([\d,]+)$/);
  if (match) return text.replace(trimmed, tr("catalog.from_total", { count: formatCount(match[1]) }));

  match = trimmed.match(/^แสดง\s+([\d,]+)\s+รายการ$/);
  if (match) return text.replace(trimmed, tr("catalog.showing", { count: formatCount(match[1]) }));

  match = trimmed.match(/^ลดจำนวน\s+(.+)$/);
  if (match) return text.replace(trimmed, tr("runtime.decrease_qty", { product: match[1] }));

  match = trimmed.match(/^เพิ่มจำนวน\s+(.+)$/);
  if (match) return text.replace(trimmed, tr("runtime.increase_qty", { product: match[1] }));

  match = trimmed.match(/^ลบ\s+(.+)\s+ออกจากบิล$/);
  if (match) return text.replace(trimmed, tr("runtime.remove_item", { product: match[1] }));

  match = trimmed.match(/^สต็อก\s+(.+)\s+ไม่พอ$/);
  if (match) return text.replace(trimmed, tr("runtime.insufficient_stock", { product: match[1] }));

  match = trimmed.match(/^ไม่พบสินค้า\s+(.+)$/);
  if (match) return text.replace(trimmed, tr("runtime.product_not_found", { product: match[1] }));

  match = trimmed.match(/^บันทึกบิล\s+(.+)\s+ในเครื่องแล้ว\s+รอส่งเข้าฐานข้อมูล$/);
  if (match) return text.replace(trimmed, tr("runtime.sale_local_waiting", { number: match[1] }));

  match = trimmed.match(/^บันทึกการขาย\s+(.+)\s+แบบออฟไลน์แล้ว$/);
  if (match) return text.replace(trimmed, tr("runtime.sale_offline", { number: match[1] }));

  match = trimmed.match(/^บันทึกการขาย\s+(.+)\s+สำเร็จ$/);
  if (match) return text.replace(trimmed, tr("runtime.sale_success", { number: match[1] }));

  match = trimmed.match(/^พักบิลในเครื่องแล้ว แต่ต้องตรวจสอบ:\s*(.+)$/);
  if (match) return text.replace(trimmed, tr("held.saved_review", { error: match[1] }));

  match = trimmed.match(/^เรียกบิลไม่ได้:\s*(.+)$/);
  if (match) return text.replace(trimmed, tr("held.resume_failed", { error: match[1] }));

  match = trimmed.match(/^ลบบิลพัก\s+“(.+)”\s+หรือไม่\?$/);
  if (match) return text.replace(trimmed, tr("held.delete_confirm", { name: match[1] }));

  match = trimmed.match(/^ลบบิลในเครื่องแล้ว แต่ต้องตรวจสอบ:\s*(.+)$/);
  if (match) return text.replace(trimmed, tr("held.delete_local_review", { error: match[1] }));

  match = trimmed.match(/^(.+?)\s*•\s*([\d,]+)\s+รายการ$/);
  if (match) {
    const localizedDate = translateThaiDateTime(match[1]);
    if (localizedDate) {
      return text.replace(trimmed, tr("held.summary", {
        time: localizedDate,
        count: formatCount(match[2]),
      }));
    }
  }

  match = trimmed.match(/^(.+?)\s+•\s+(คงเหลือ\s+.+|สินค้าหมด)$/);
  if (match) {
    const stock = translateText(match[2]);
    return text.replace(trimmed, `${match[1]} • ${stock}`);
  }

  match = trimmed.match(/^(.+?)\s+(คงเหลือ\s+[\d,.]+\s+.+|สินค้าหมด)\s+([\d,.]+)\s+บาท$/);
  if (match) {
    const stock = translateText(match[2]);
    const amount = tr("common.amount_thb", { amount: match[3] });
    return text.replace(trimmed, `${match[1]} ${stock} ${amount}`);
  }

  const localizedDate = translateThaiDateTime(trimmed);
  if (localizedDate) return text.replace(trimmed, localizedDate);

  return text;
}

function translateElementAttributes(element) {
  if (!isEnglish || element?.nodeType !== Node.ELEMENT_NODE) return;
  ["placeholder", "title", "aria-label"].forEach(attribute => {
    if (!element.hasAttribute(attribute)) return;
    const current = element.getAttribute(attribute);
    const translated = translateText(current);
    if (translated !== current) element.setAttribute(attribute, translated);
  });
}

function translateNode(node) {
  if (!isEnglish || !node) return;

  if (node.nodeType === Node.TEXT_NODE) {
    const translated = translateText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  translateElementAttributes(node);
  node.childNodes.forEach(translateNode);
}

function initialize() {
  if (!isEnglish) return;
  document.documentElement.lang = locale;
  translateNode(document.documentElement);

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === "characterData") {
        translateNode(mutation.target);
        return;
      }
      if (mutation.type === "attributes") {
        translateElementAttributes(mutation.target);
        return;
      }
      mutation.addedNodes.forEach(translateNode);
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "title", "aria-label"],
  });
}

initialize();
