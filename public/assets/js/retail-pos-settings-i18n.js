import { getLocale, t } from './i18n.js?v=20260812-099';

const locale = getLocale();
const isEnglish = locale === 'en';
const tr = key => t(`pos_settings.${key}`);

const exact = new Map([
  ['ตั้งค่าร้านค้าปลีก', 'page.title'], ['ข้อมูลร้าน รูปแบบใบเสร็จ ภาษี และระบบสมาชิก', 'page.subtitle'],
  ['ข้อมูลร้าน', 'store.title'], ['ข้อมูลส่วนนี้จะแสดงบนใบเสร็จรับเงินทุกใบ', 'store.description'], ['ชื่อร้าน', 'store.name'], ['เช่น ร้านสมใจมาร์ท', 'store.name_placeholder'], ['ที่อยู่ร้าน', 'store.address'], ['เลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด รหัสไปรษณีย์', 'store.address_placeholder'], ['เบอร์โทรศัพท์', 'store.phone'], ['เช่น 081-234-5678', 'store.phone_placeholder'], ['เลขประจำตัวผู้เสียภาษี', 'store.tax_id'], ['13 หลัก', 'store.tax_id_placeholder'],
  ['ตำแหน่งร้าน', 'store_location.title'], ['เลือกตำแหน่งร้านบนแผนที่ หรือลากหมุดไปยังตำแหน่งที่ถูกต้อง', 'store_location.description'], ['ใช้ตำแหน่งปัจจุบัน', 'store_location.use_current'], ['ยังไม่ได้กำหนดตำแหน่งร้าน', 'store_location.not_set'], ['กำหนดตำแหน่งร้านแล้ว', 'store_location.ready'], ['ไม่สามารถโหลดแผนที่ได้', 'store_location.map_load_failed'], ['อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง', 'store_location.geolocation_unsupported'], ['ไม่สามารถอ่านตำแหน่งปัจจุบันได้', 'store_location.geolocation_failed'], ['หมายเหตุ: พิกัดตำแหน่งร้านนี้จะถูกบันทึกไว้ในตั้งค่าร้านเท่านั้น และยังไม่ส่งผลต่อการทำงานของระบบใด ๆ', 'store_location.note'],
  ['ภาษีมูลค่าเพิ่ม / ใบกำกับภาษีอย่างย่อ', 'tax.title'], ['ใช้เป็นฐานสำหรับคำนวณ VAT ทั้งบิลในขั้นตอนขาย หลังหักส่วนลดและแต้ม', 'tax.description'], ['สถานะ VAT', 'tax.status'], ['ยังไม่จด VAT', 'tax.not_registered'], ['จด VAT แล้ว', 'tax.registered'], ['อัตรา VAT (%)', 'tax.rate'], ['ค่าเริ่มต้นตอนขาย', 'tax.default_mode'], ['สาขา', 'tax.branch'], ['สำนักงานใหญ่', 'tax.head_office'], ['เลขที่สาขา', 'tax.branch_number'], ['เช่น 00001', 'tax.branch_placeholder'], ['ชื่อที่ใช้บนใบกำกับภาษี', 'tax.invoice_name'], ['เว้นว่างเพื่อใช้ชื่อร้าน', 'tax.invoice_name_placeholder'], ['ที่อยู่สำหรับใบกำกับภาษี', 'tax.invoice_address'], ['เว้นว่างเพื่อใช้ที่อยู่ร้าน', 'tax.invoice_address_placeholder'], ['หมายเหตุ: ใบเสร็จเดิมจะใช้เป็นใบกำกับภาษีอย่างย่อในงานถัดไป โดยแสดงยอดก่อน VAT, VAT และยอดสุทธิ', 'tax.note'],
  ['PromptPay / โอนเงิน', 'promptpay.title'], ['ใช้สร้าง QR ตอนรับชำระเงินและแสดงยอดบนจอลูกค้า', 'promptpay.description'], ['เปิดใช้ QR PromptPay', 'promptpay.enabled'], ['ปิด', 'promptpay.off'], ['เปิด', 'promptpay.on'], ['เบอร์ PromptPay / เลขนิติบุคคล', 'promptpay.id'], ['เช่น 0812345678 หรือ 13 หลัก', 'promptpay.id_placeholder'], ['ชื่อบัญชีที่แสดงให้ลูกค้าเห็น', 'promptpay.account_name'], ['จอลูกค้าจะแสดงชื่อร้าน ชื่อบัญชี ยอดชำระ และเว็บไซต์ที่สร้าง QR เพื่อให้ตรวจสอบก่อนสแกน', 'promptpay.note'],
  ['รูปแบบการพิมพ์ใบเสร็จ', 'printing.title'], ['เลือกขนาดกระดาษและวิธีพิมพ์หลังบันทึกการขาย', 'printing.description'], ['ขนาดใบเสร็จ', 'printing.paper_size'], ['หลังบันทึกการขาย', 'printing.after_sale'], ['ไม่พิมพ์ใบเสร็จ', 'printing.none'], ['พิมพ์ทันที', 'printing.auto'],
  ['ข้อความบนใบเสร็จ', 'message.title'], ['ตั้งค่าข้อความที่แสดงในใบเสร็จรับเงิน', 'message.description'], ['ข้อความขอบคุณ', 'message.thanks'], ['ขอบคุณที่ใช้บริการ', 'message.thanks_placeholder'], ['ข้อความท้ายใบเสร็จ', 'message.footer'], ['เช่น สินค้าซื้อแล้วไม่รับเปลี่ยนหรือคืน', 'message.footer_placeholder'],
  ['ตัวอย่างข้อมูลบนใบเสร็จ', 'preview.title'], ['ตรวจสอบรูปแบบข้อมูลร้านก่อนบันทึก', 'preview.description'], ['คืนค่าเริ่มต้น', 'actions.reset'], ['บันทึกการตั้งค่า', 'actions.save'],
  ['ระบบสะสมแต้มสมาชิก', 'loyalty.title'], ['เปิดใช้งานระบบแต้ม', 'loyalty.enabled'], ['เปิดใช้งาน', 'loyalty.on'], ['ปิดใช้งาน', 'loyalty.off'], ['ยอดซื้อที่ได้รับ 1 แต้ม', 'loyalty.spend_per_point'], ['มูลค่าต่อ 1 แต้ม', 'loyalty.point_value'], ['ตัวอย่างยอดซื้อ', 'loyalty.sample_spend'], ['แต้มที่ได้รับ', 'loyalty.points_earned'], ['มูลค่า 10 แต้ม', 'loyalty.ten_points_value'],
]);

function translate(value) {
  if (!isEnglish) return value;
  const text = String(value ?? '');
  const trimmed = text.trim();
  const key = exact.get(trimmed);
  return key ? text.replace(trimmed, tr(key)) : text;
}

function translateNode(node) {
  if (!isEnglish || !node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const translated = translate(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  ['placeholder', 'title', 'aria-label'].forEach(attribute => {
    if (!node.hasAttribute(attribute)) return;
    const value = node.getAttribute(attribute);
    const translated = translate(value);
    if (translated !== value) node.setAttribute(attribute, translated);
  });
  node.childNodes.forEach(translateNode);
}

if (isEnglish) {
  document.documentElement.lang = locale;
  document.title = tr('meta.title');
  translateNode(document.documentElement);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        translateNode(mutation.target);
        continue;
      }

      if (mutation.type === 'attributes') {
        translateNode(mutation.target);
        continue;
      }

      mutation.addedNodes.forEach(translateNode);
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label'],
  });
}
