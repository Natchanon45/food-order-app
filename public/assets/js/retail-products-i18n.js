import { getIntlLocale, getLocale, t } from "./i18n.js?v=20260812-099";

const locale = getLocale();
const intlLocale = getIntlLocale();
const isEnglish = locale === "en";

function tr(key, replacements = {}) {
  return t(`pos_products.${key}`, replacements);
}

const exactTextKeys = new Map([
  ["เพิ่มสินค้า", "product_form.add_title"],
  ["แก้ไขสินค้า", "product_form.edit_title"],
  ["ลบสินค้า", "runtime.delete_product_title"],
  ["ปรับสต็อก", "common.adjust_stock"],
  ["แก้ไข", "common.edit"],
  ["ลบ", "common.delete"],
  ["ก่อนหน้า", "common.previous"],
  ["ถัดไป", "common.next"],
  ["ไม่พบสินค้า", "products.empty"],
  ["รายการที่แสดง", "categories.summary_visible"],
  ["ใช้งานอยู่", "categories.status_used"],
  ["ยังไม่มีสินค้า", "categories.status_empty"],
  ["รอบันทึกหมวด", "categories.status_derived"],
  ["จัดการ", "categories.manage"],
  ["สถานะ", "categories.status"],
  ["แสดงต่อหน้า", "common.per_page"],
  ["จำนวนสินค้าต่อหน้า", "common.products_per_page"],
  ["หมวดสินค้า", "categories.title"],
  ["จำนวนสินค้า", "categories.product_count"],
  ["พร้อมใช้บนหน้าขาย POS", "categories.ready_pos"],
  ["พบจากข้อมูลสินค้า • บันทึกเพื่อจัดการหมวด", "categories.derived_help"],
  ["บันทึกหมวด", "categories.save_derived"],
  ["ไม่พบหมวดสินค้าที่ค้นหา", "categories.no_match"],
  ["ยังไม่มีหมวดสินค้า", "categories.empty_title"],
  ["ลองเปลี่ยนคำค้นหาหรือตัวกรอง", "categories.no_match_help"],
  ["กด “เพิ่มหมวดหมู่” เพื่อเริ่มจัดหมวดสินค้า", "categories.empty_help"],
  ["เพิ่มหมวดสินค้า", "category_form.add_title"],
  ["แก้ไขหมวดสินค้า", "category_form.edit_title"],
  ["ชื่อหมวดจะแสดงในหน้าขาย POS", "category_form.hint_empty"],
  ["บันทึกหมวดหมู่", "category_form.save"],
  ["ลากเพื่อจัดลำดับ", "sort_manager.drag_aria"],
  ["ลำดับหมวดหมู่หน้า POS", "sort_manager.category_title"],
  ["ลากการ์ดเพื่อจัดลำดับจากซ้ายไปขวา", "sort_manager.category_help"],
  ["ลากการ์ดเพื่อจัดลำดับสินค้า", "sort_manager.products_help"],
  ["สินค้าใน “ขายดี” เรียงตามจำนวนชิ้นที่ขายได้ จึงไม่เปิดให้จัดลำดับเอง", "sort_manager.best_sellers_locked"],
  ["“ทั้งหมด” ใช้ลำดับหมวดหมู่และลำดับสินค้าภายในแต่ละหมวดโดยอัตโนมัติ", "sort_manager.all_auto"],
  ["ไม่มีสินค้าในหมวดนี้", "sort_manager.category_empty"],
  ["ไม่มีบาร์โค้ด", "sort_manager.no_barcode"],
  ["บันทึกลง ฐานข้อมูล และนำไปใช้ที่หน้า /pos ทันที โดยอันดับสินค้า “ขายดี” ยังคำนวณจากยอดขาย", "sort_manager.note"],
  ["บันทึกลำดับ", "sort_manager.save"],
  ["กำลังบันทึก...", "sort_manager.saving"],
  ["ต้นทุนและการแสดงผลบนหน้าขาย", "merch.title"],
  ["ราคาทุนต่อหน่วย", "merch.cost"],
  ["หมวดสินค้า", "merch.category"],
  ["ลำดับการแสดง", "merch.sort_order"],
  ["อัปโหลดรูปสินค้า", "merch.upload_image"],
  ["หรือ URL รูปสินค้า", "merch.image_url"],
  ["ยังไม่มีรูป", "merch.no_image"],
  ["ลบรูป", "merch.remove_image"],
  ["แสดงบนหน้าขาย", "merch.show_on_pos"],
  ["ราคาทุนใช้สำหรับคำนวณกำไรขั้นต้น โดยบันทึกติดไปกับบิล ณ เวลาขาย", "merch.cost_help"],
  ["ตัวอย่างรูปสินค้า", "merch.image_alt"],
  ["โหลดรูปไม่สำเร็จ", "merch.image_load_failed"],
  ["เพิ่มหมวดสินค้าใหม่", "merch.create_category"],
  ["พิมพ์ค้นหาหมวดสินค้า", "merch.category_search"],
  ["เช่น 7.50", "merch.cost_placeholder"],
  ["https://... หรือ /assets/images/products/สินค้า.webp", "merch.image_url_placeholder"],
  ["ซ่อนจากหน้าขาย", "merch.hidden_on_pos"],
  ["ลากรูปมาวางที่นี่", "merch.drop_title"],
  ["หรือคลิกเพื่อเลือกรูปจากเครื่อง", "merch.drop_help"],
  ["เลือกรูปแล้ว", "merch.selected"],
  ["กรุณากรอกข้อมูลสินค้าให้ครบและถูกต้อง", "runtime.product_required"],
  ["รหัสสินค้าต้องเป็น P ตามด้วยตัวเลข 9 หลัก เช่น P000000001", "runtime.product_code_format"],
  ["รหัสสินค้านี้มีอยู่แล้ว", "runtime.product_code_exists"],
  ["บาร์โค้ดนี้ถูกใช้กับสินค้าอื่นแล้ว", "runtime.barcode_exists"],
  ["อัปโหลดรูปสินค้าเข้า Server ไม่สำเร็จ", "runtime.image_upload_failed"],
  ["จำนวนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป", "runtime.stock_quantity_invalid"],
  ["ไม่สามารถลดสต็อกให้ติดลบได้", "runtime.stock_negative"],
  ["ส่งเข้าระบบแล้ว", "common.synced"],
  ["รอส่งเมื่อออนไลน์", "common.pending"],
  ["บันทึกในเครื่อง", "common.local"],
  ["ต้องตรวจสอบข้อมูล", "common.needs_review"],
  ["ล้างประวัติแล้ว", "runtime.history_cleared"],
  ["ล้างประวัติการปรับสต็อก", "runtime.clear_history_title"],
  ["ล้างประวัติการปรับสต็อกทั้งหมดในเครื่องนี้หรือไม่?", "runtime.clear_history_confirm"],
  ["กรุณาระบุชื่อหมวดสินค้า", "runtime.category_name_required"],
  ["ต้องเชื่อมต่อฐานข้อมูลเพื่อเพิ่มหรือแก้ไขหมวดสินค้า", "runtime.category_online_save_required"],
  ["ต้องเชื่อมต่อฐานข้อมูลเพื่อลบหมวดสินค้า", "runtime.category_online_delete_required"],
  ["บันทึกหมวดสินค้าไม่สำเร็จ", "runtime.category_save_failed"],
  ["จัดการหมวดสินค้าไม่สำเร็จ", "runtime.category_manage_failed"],
  ["ลบไม่ได้ เนื่องจากยังมีสินค้าอยู่ในหมวดนี้", "runtime.category_in_use"],
  ["ลบหมวดสินค้า", "runtime.category_delete_title"],
  ["สร้างไฟล์รูปไม่สำเร็จ", "runtime.image_create_failed"],
  ["อ่านไฟล์รูปไม่สำเร็จ", "runtime.image_read_failed"],
  ["ข้อมูลรูปไม่ถูกต้อง", "runtime.image_invalid"],
  ["กรุณาเลือกไฟล์รูปภาพ", "runtime.image_choose"],
  ["ไม่พบรหัสสินค้า", "runtime.product_id_missing"],
  ["ไฟล์รูปมีขนาดเกินที่ Server รองรับ จึงบันทึกรูปไว้ในเครื่องนี้แทน", "runtime.image_quota_fallback"],
  ["ไม่มีสิทธิ์อัปโหลดรูปสินค้าเข้า Server", "runtime.image_forbidden"],
  ["อัปโหลดรูปสินค้าเข้า Server ไม่สำเร็จ จึงบันทึกรูปไว้ในเครื่องนี้แทน", "runtime.image_local_fallback"],
  ["เพิ่มหมวดสินค้าไม่สำเร็จ", "runtime.category_add_failed"],
  ["ไม่มีสิทธิ์แก้ไขลำดับสินค้า", "runtime.sort_no_permission"],
  ["ไม่มีลำดับที่ต้องบันทึก", "runtime.sort_nothing"],
  ["บันทึกลำดับลงฐานข้อมูลแล้ว", "runtime.sort_saved"],
  ["บันทึกลำดับไม่สำเร็จ: ไม่มีสิทธิ์แก้ไข", "runtime.sort_save_forbidden"],
  ["กรุณาลองใหม่", "runtime.try_again"],
  ["คุณไม่มีสิทธิ์ดำเนินการนี้", "runtime.permission_denied"],
  ["ไม่สามารถดำเนินการได้", "runtime.permission_title"],
]);

const protectedSelectors = [
  ".product-name",
  ".movement-item strong",
  ".category-main-text > strong",
  ".category-combobox-options [data-category-id] span",
  ".sort-row[data-product-id] .sort-row-title",
  ".merch-tag:not(.hidden)",
  ".product-thumb",
];

function isProtectedBusinessNode(node) {
  const element = node?.parentElement;
  if (!element) return false;
  if (protectedSelectors.some(selector => element.matches(selector))) return true;
  if (element.matches(".sort-row-title")) {
    return !element.closest('[data-category-id="quick"], [data-category-id="all"]');
  }
  return false;
}

function formatNumber(value) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number.toLocaleString(intlLocale) : String(value ?? "");
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

function localizedSystemCategory(value) {
  const text = String(value || "").trim();
  const activeSystemCategory = document.querySelector(".sort-row.active[data-category-id]")?.dataset.categoryId || "";
  if (text === "ขายดี" && activeSystemCategory === "quick") return tr("sort_manager.best_sellers");
  if (text === "ทั้งหมด" && activeSystemCategory === "all") return tr("sort_manager.all");
  return text;
}

function translateMovementMeta(text) {
  const parts = String(text || "").split(" • ");
  if (parts.length < 3) return null;
  let changed = false;

  if (parts[1]?.trim() === "ปรับสต็อก") {
    parts[1] = tr("runtime.stock_default_note");
    changed = true;
  }

  for (let index = 1; index < parts.length; index += 1) {
    const localizedDate = translateThaiDateTime(parts[index]);
    if (localizedDate) {
      parts[index] = localizedDate;
      changed = true;
      continue;
    }
    const translated = translatePlainText(parts[index], { allowShort: true });
    if (translated !== parts[index]) {
      parts[index] = translated;
      changed = true;
    }
  }

  return changed ? parts.join(" • ") : null;
}

function translatePlainText(value, { allowShort = false } = {}) {
  const text = String(value ?? "");
  const trimmed = text.trim();
  if (!trimmed) return text;

  const exactKey = exactTextKeys.get(trimmed);
  if (exactKey && (allowShort || trimmed.length > 2)) {
    return text.replace(trimmed, tr(exactKey));
  }

  let match = trimmed.match(/^หน้า\s+([\d,]+)$/);
  if (match) return text.replace(trimmed, tr("common.page", { page: formatNumber(match[1]) }));

  match = trimmed.match(/^([\d,]+)\s+หมวด$/);
  if (match) return text.replace(trimmed, tr("categories.count", { count: formatNumber(match[1]) }));

  match = trimmed.match(/^([\d,]+)\s+รายการ$/);
  if (match) return text.replace(trimmed, tr("common.item_count", { count: formatNumber(match[1]) }));

  match = trimmed.match(/^แสดง\s+([\d,]+)–([\d,]+)\s+จาก\s+([\d,]+)\s+รายการ$/);
  if (match) {
    return text.replace(trimmed, tr("common.showing", {
      start: formatNumber(match[1]),
      end: formatNumber(match[2]),
      total: formatNumber(match[3]),
    }));
  }

  match = trimmed.match(/^แสดง\s+([\d,]+)–([\d,]+)\s+จาก\s+([\d,]+)$/);
  if (match) {
    return text.replace(trimmed, tr("common.showing_short", {
      start: formatNumber(match[1]),
      end: formatNumber(match[2]),
      total: formatNumber(match[3]),
    }));
  }

  match = trimmed.match(/^มีสินค้าในหมวดนี้\s+([\d,]+)\s+รายการ$/);
  if (match) {
    return text.replace(trimmed, tr("category_form.hint_with_count", {
      count: formatNumber(match[1]),
    }));
  }

  match = trimmed.match(/^สินค้าในหมวด\s+(.+)$/);
  if (match) {
    return text.replace(trimmed, tr("sort_manager.products_title", {
      category: localizedSystemCategory(match[1]),
    }));
  }

  match = trimmed.match(/^(.+?)\s+•\s+คงเหลือ\s+(.+)$/);
  if (match) {
    return text.replace(trimmed, tr("stock_form.remaining", {
      product: match[1],
      stock: match[2],
    }));
  }

  match = trimmed.match(/^ลบสินค้า\s+“(.+)”\s+หรือไม่\?\s*ประวัติการขายเดิมจะไม่ถูกลบ$/);
  if (match) {
    return text.replace(trimmed, tr("runtime.delete_product_confirm", { name: match[1] }));
  }

  match = trimmed.match(/^ลบหมวดสินค้า\s+“(.+)”\s+หรือไม่\?$/);
  if (match) {
    return text.replace(trimmed, tr("runtime.category_delete_confirm", { name: match[1] }));
  }

  match = trimmed.match(/^(เพิ่ม|แก้ไข)หมวดสินค้า\s+“(.+)”\s+สำเร็จ$/);
  if (match) {
    return text.replace(trimmed, tr("runtime.category_saved", {
      action: match[1] === "เพิ่ม" ? tr("runtime.category_action_add") : tr("runtime.category_action_edit"),
      name: match[2],
    }));
  }

  match = trimmed.match(/^บันทึกหมวดสินค้า\s+“(.+)”\s+สำเร็จ$/);
  if (match) {
    return text.replace(trimmed, tr("runtime.category_saved_direct", { name: match[1] }));
  }

  match = trimmed.match(/^ลบหมวดสินค้า\s+“(.+)”\s+สำเร็จ$/);
  if (match) {
    return text.replace(trimmed, tr("runtime.category_deleted", { name: match[1] }));
  }

  match = trimmed.match(/^ลบสินค้าไม่สำเร็จ\s+•\s+(.+)$/);
  if (match) {
    return text.replace(trimmed, tr("runtime.product_delete_failed", { error: match[1] }));
  }

  match = trimmed.match(/^ล้างประวัติแล้ว\s+•\s+เก็บ\s+([\d,]+)\s+รายการที่รอส่ง$/);
  if (match) {
    return text.replace(trimmed, tr("runtime.history_cleared_pending", {
      count: formatNumber(match[1]),
    }));
  }

  match = trimmed.match(/^บันทึกลำดับไม่สำเร็จ:\s*(.+)$/);
  if (match) {
    const error = match[1] === "กรุณาลองใหม่" ? tr("runtime.try_again") : match[1];
    return text.replace(trimmed, tr("runtime.sort_save_failed", { error }));
  }

  let result = text;
  result = result.replace(/^เพิ่มสินค้าแล้ว/, tr("runtime.product_added"));
  result = result.replace(/^แก้ไขสินค้าแล้ว/, tr("runtime.product_updated"));
  result = result.replace(/^ลบสินค้าแล้ว/, tr("runtime.product_deleted"));
  result = result.replace(/^ปรับสต็อกแล้ว/, tr("runtime.stock_adjusted"));
  result = result.replace(/แจ้งเตือนเมื่อเหลือ\s+([\d,.]+)/g, (_, stock) =>
    tr("runtime.low_stock_alert", { stock: formatNumber(stock) })
  );
  result = result.replace(/ทุน\s+([\d,.]+)/g, (_, amount) =>
    tr("runtime.cost", { amount })
  );
  result = result.replace(/ยังไม่กำหนดทุน/g, tr("runtime.cost_unset"));
  result = result.replace(/รอส่งเมื่อออนไลน์/g, tr("common.pending"));
  result = result.replace(/ส่งเข้าระบบแล้ว/g, tr("common.synced"));
  result = result.replace(/ต้องตรวจสอบข้อมูล/g, tr("common.needs_review"));
  result = result.replace(/ตรวจสอบข้อมูล\s+\(([^)]+)\)/g, (_, error) =>
    tr("common.conflict", { error })
  );

  const localizedDate = translateThaiDateTime(trimmed);
  if (localizedDate) return text.replace(trimmed, localizedDate);

  return result;
}

function translateKnownElement(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

  if (element.matches(".category-list-head span:first-child")) element.textContent = tr("categories.title");
  if (element.matches(".category-list-head span:nth-child(2)")) element.textContent = tr("categories.product_count");
  if (element.matches(".category-list-head span:nth-child(3)")) element.textContent = tr("categories.status");
  if (element.matches(".category-list-head span:nth-child(4)")) element.textContent = tr("categories.manage");
  if (element.matches(".category-product-count span")) element.textContent = tr("common.items");

  const action = element.matches("button[data-action]") ? element.dataset.action : "";
  if (action === "stock") element.textContent = tr("common.adjust_stock");
  if (action === "edit" && !element.querySelector("i")) element.textContent = tr("common.edit");
  if (action === "delete") {
    const icon = element.querySelector("i");
    if (!icon) element.textContent = tr("common.delete");
  }

  if (element.matches('[data-category-id="quick"] .sort-row-title')) {
    element.textContent = tr("sort_manager.best_sellers");
  }
  if (element.matches('[data-category-id="all"] .sort-row-title')) {
    element.textContent = tr("sort_manager.all");
  }
  if (element.matches(".category-card-actions [data-action='edit']")) {
    element.lastChild.textContent = ` ${tr("common.edit")}`;
  }
  if (element.matches(".category-card-actions [data-action='delete']")) {
    element.lastChild.textContent = ` ${tr("common.delete")}`;
  }
  if (element.matches(".category-card-actions [data-action='save-derived']")) {
    element.lastChild.textContent = ` ${tr("categories.save_derived")}`;
  }
}

function translateAttributes(element) {
  if (!element?.getAttribute) return;
  for (const attribute of ["placeholder", "title", "aria-label"]) {
    if (!element.hasAttribute(attribute)) continue;
    const current = element.getAttribute(attribute);
    const translated = translatePlainText(current, { allowShort: true });
    if (translated !== current) element.setAttribute(attribute, translated);
  }
}

function translateTextNode(node) {
  if (!isEnglish || node?.nodeType !== Node.TEXT_NODE || isProtectedBusinessNode(node)) return;

  const parent = node.parentElement;
  const current = node.nodeValue || "";
  let translated = current;

  if (parent?.matches(".pagination-summary label") && current.trim() === "รายการ") {
    translated = current.replace("รายการ", tr("common.items"));
  } else if (parent?.matches(".movement-meta")) {
    translated = translateMovementMeta(current) || current;
  } else {
    translated = translatePlainText(current, { allowShort: parent?.matches("button, option, .category-status, .sort-save") });
  }

  if (translated !== current) node.nodeValue = translated;
}

function translateTree(root = document) {
  if (!isEnglish || !root) return;

  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root);
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    translateKnownElement(root);
    translateAttributes(root);
  }

  const elementRoot = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
  if (!elementRoot?.querySelectorAll) return;

  elementRoot.querySelectorAll("*").forEach(element => {
    translateKnownElement(element);
    translateAttributes(element);
  });

  const walker = document.createTreeWalker(elementRoot, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) translateTextNode(node);
}

if (isEnglish) {
  document.documentElement.lang = locale;
  translateTree(document);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        translateTextNode(mutation.target);
        continue;
      }

      if (mutation.type === "attributes") {
        translateAttributes(mutation.target);
        translateKnownElement(mutation.target);
        continue;
      }

      mutation.addedNodes.forEach(node => translateTree(node));
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "title", "aria-label"],
  });
}
