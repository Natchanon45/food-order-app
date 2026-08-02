const path = location.pathname.replace(/\/index\.html$/, "/");
const isReport = /\/admin\/sales-report\/?$/.test(path);
const body = document.body;

body.classList.add("admin-vr-page");
body.classList.toggle("admin-vr-dashboard", !isReport);
body.classList.toggle("admin-vr-report", isReport);

function visibleText(node) {
  return String(node?.textContent || "").replace(/\s+/g, " ").trim();
}

function firstMatch(selectors, root = document) {
  for (const selector of selectors) {
    const node = root.querySelector(selector);
    if (node) return node;
  }
  return null;
}

function directishCards(root) {
  const selectors = [
    ".admin-card",
    ".settings-card",
    ".setting-card",
    ".dashboard-card",
    ".report-card",
    ".panel",
    ".card",
    "details"
  ];
  const selector = selectors.join(",");
  const nodes = [...root.querySelectorAll(selector)];
  return nodes.filter((node, index) => {
    if (nodes.indexOf(node) !== index) return false;
    const parentCard = node.parentElement?.closest(selector);
    return !parentCard || !root.contains(parentCard);
  });
}

function accentFor(text, index) {
  const value = text.toLocaleLowerCase("th");
  if (/รายงาน|ยอดขาย|สรุป|กราฟ|วิเคราะห์/.test(value)) return "cyan";
  if (/โต๊ะ|คิว|qr|สแกน/.test(value)) return "blue";
  if (/delivery|จัดส่ง|ส่งอาหาร|ค่าส่ง/.test(value)) return "violet";
  if (/ชำระ|payment|promptpay|เงิน|ธนาคาร/.test(value)) return "amber";
  if (/พนักงาน|ผู้ใช้|สมาชิก|สิทธิ์/.test(value)) return "rose";
  if (/เมนู|หมวด|สินค้า|ร้าน|ตั้งค่า/.test(value)) return "green";
  return ["green", "blue", "violet", "amber", "rose", "cyan"][index % 6];
}

function classifyAction(button) {
  const text = visibleText(button);
  if (/ลบ|ยกเลิก|ปิดใช้งาน/.test(text)) {
    button.dataset.adminVrAction = "danger";
    return;
  }
  if (/บันทึก|เพิ่ม|สร้าง|ยืนยัน|อัปเดต|คัดลอก|เปิดรายงาน|ดูรายงาน/.test(text)) {
    button.dataset.adminVrAction = "primary";
    return;
  }
  button.dataset.adminVrAction = "secondary";
}

function ensureHero(main) {
  const heading = firstMatch([
    ".admin-hero",
    ".page-hero",
    ".hero",
    ".admin-page-header",
    ".page-header",
    ".dashboard-hero",
    "main > header",
    "main > section:first-child",
    "main > div:first-child"
  ], main);

  const hero = heading?.querySelector("h1,h2")
    ? heading
    : firstMatch(["h1", "h2"], main)?.parentElement;

  if (!hero) return;
  hero.classList.add("admin-vr-hero");

  if (!isReport) {
    hero.querySelectorAll(".admin-vr-eyebrow,.admin-vr-hero-chips")
      .forEach(node => node.remove());
    return;
  }

  if (!hero.querySelector(".admin-vr-eyebrow")) {
    const eyebrow = document.createElement("span");
    eyebrow.className = "admin-vr-eyebrow";
    eyebrow.textContent = isReport ? "ศูนย์วิเคราะห์ยอดขาย" : "ศูนย์จัดการร้าน";
    hero.prepend(eyebrow);
  }

  if (!hero.querySelector(".admin-vr-hero-chips")) {
    const chips = document.createElement("div");
    chips.className = "admin-vr-hero-chips";
    const labels = isReport
      ? ["ภาพรวมยอดขาย", "ช่องทางชำระ", "แนวโน้มและรายการ"]
      : ["เมนูและโต๊ะ", "การขายและการชำระ", "ตั้งค่าร้านและพนักงาน"];
    chips.innerHTML = labels
      .map(label => `<span class="admin-vr-hero-chip">${label}</span>`)
      .join("");
    hero.appendChild(chips);
  }
}

function enhanceDashboard(main) {
  directishCards(main).forEach((card, index) => {
    card.classList.add("admin-vr-card");
    card.dataset.adminVrAccent = accentFor(visibleText(card), index);
  });
}

function findSummaryContainers(main) {
  return [
    ...main.querySelectorAll(
      ".summary-grid,.stats-grid,.metric-grid,.report-summary,.summary-cards,.stats-cards,[data-summary-grid]"
    )
  ];
}

function enhanceReport(main) {
  const filter = firstMatch([
    ".report-filter",
    ".report-filters",
    ".filter-bar",
    ".filters",
    ".report-toolbar",
    ".toolbar",
    "form"
  ], main);
  filter?.classList.add("admin-vr-report-filter");

  findSummaryContainers(main).forEach(container => {
    container.classList.add("admin-vr-summary-grid");
    [...container.children].forEach(child => child.classList.add("admin-vr-metric"));
  });

  main.querySelectorAll(".summary-card,.stat-card,.metric-card,[data-metric]")
    .forEach(card => card.classList.add("admin-vr-metric"));

  main.querySelectorAll("canvas").forEach(canvas => {
    const host = canvas.closest(".card,.panel,section,article,div");
    host?.classList.add("admin-vr-chart-card");
  });

  main.querySelectorAll("table").forEach(table => {
    const host = table.closest(".table-wrap,.table-responsive,.card,.panel,section,article,div");
    host?.classList.add("admin-vr-table-card");
  });

  directishCards(main).forEach((card, index) => {
    if (card.classList.contains("admin-vr-chart-card")) return;
    if (card.classList.contains("admin-vr-table-card")) return;
    if (card.classList.contains("admin-vr-metric")) return;
    card.classList.add("admin-vr-card");
    card.dataset.adminVrAccent = accentFor(visibleText(card), index);
  });
}

function enhance(root = document) {
  const main = firstMatch([
    "main",
    ".admin-main",
    ".admin-container",
    ".page-container",
    ".container"
  ], root) || document.body;

  main.classList.add("admin-vr-main");
  ensureHero(main);

  main.querySelectorAll("h2,h3").forEach(heading => {
    if (!heading.closest(".admin-vr-hero")) {
      heading.classList.add("admin-vr-section-title");
    }
  });

  main.querySelectorAll("button,.btn,a.button").forEach(classifyAction);

  if (isReport) enhanceReport(main);
  else enhanceDashboard(main);
}

let scheduled = false;

function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhance();
  });
}

enhance();

new MutationObserver(scheduleEnhance).observe(document.body, {
  childList: true,
  subtree: true
});


/* ADMIN_RESPONSIVE_PRINT_REFINEMENT_20260803_002 */
function adminVrEnhancePagination(root = document) {
  root.querySelectorAll(".menu-pagination .menu-page-button").forEach(button => {
    const label = button.getAttribute("aria-label") || "";
    const previous = label === "หน้าก่อนหน้า";
    const next = label === "หน้าถัดไป";
    if (!previous && !next) return;

    button.classList.add("admin-vr-page-nav");
    const iconName = previous ? "chevron-left" : "chevron-right";
    if (button.dataset.adminVrPaginationIcon !== iconName) {
      button.dataset.adminVrPaginationIcon = iconName;
      button.innerHTML =
        `<i class="bi bi-${iconName}" aria-hidden="true"></i>`;
    }
  });
}

function adminVrPrintableQrHtml(paper) {
  const clone = paper.cloneNode(true);
  clone.querySelectorAll("[hidden]").forEach(node => node.removeAttribute("hidden"));
  const title = clone.querySelector(".delivery-qr-title")?.textContent?.trim()
    || "QR สำหรับร้าน";
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @font-face {
      font-family: "TH Sarabun PSK Local";
      src: url("${location.origin}/assets/fonts/THSarabun.ttf") format("truetype");
      font-style: normal;
      font-weight: 400;
      font-display: block;
    }
    @font-face {
      font-family: "TH Sarabun PSK Local";
      src: url("${location.origin}/assets/fonts/THSarabun-Bold.ttf") format("truetype");
      font-style: normal;
      font-weight: 700;
      font-display: block;
    }
    @page { size: 80mm 128mm; margin: 4mm; }
    * { box-sizing: border-box; }
    html, body { width: 72mm; margin: 0; padding: 0; background: #fff; }
    body {
      color: #102f1e;
      font-family: "TH Sarabun PSK Local";
    }
    .delivery-qr-paper {
      width: 72mm;
      min-height: 112mm;
      display: grid;
      justify-items: center;
      align-content: start;
      gap: 3mm;
      padding: 6mm 4mm;
      text-align: center;
      border: 0;
      background: #fff;
    }
    .delivery-qr-brand {
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .delivery-qr-paper > strong { font-size: 18pt; }
    .delivery-qr-title {
      color: #087443;
      font-size: 20pt;
      font-weight: 700;
    }
    .delivery-qr-paper img {
      width: 52mm;
      height: 52mm;
      display: block;
      object-fit: contain;
    }
    .delivery-qr-paper small {
      color: #53685b;
      font-size: 11pt;
    }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`;
}

function adminVrPrintSingleQr(button) {
  const delivery = button.id === "printDeliveryQr";
  const preview = document.querySelector(
    delivery ? "#deliveryQrPreview" : "#takeawayQrPreview"
  );
  const paper = preview?.querySelector(".delivery-qr-paper");
  const image = paper?.querySelector("img");

  if (!paper || !image?.src) {
    window.alert("QR ยังไม่พร้อม กรุณารอสักครู่แล้วลองใหม่");
    return;
  }

  const popup = window.open(
    "",
    delivery ? "delivery-qr-print" : "takeaway-qr-print",
    "width=520,height=760"
  );
  if (!popup) {
    window.alert("เบราว์เซอร์บล็อกหน้าพิมพ์ กรุณาอนุญาต Pop-up แล้วลองใหม่");
    return;
  }

  popup.document.open();
  popup.document.write(adminVrPrintableQrHtml(paper));
  popup.document.close();

  const printNow = () => window.setTimeout(() => {
    popup.focus();
    popup.print();
  }, 180);

  const popupImage = popup.document.querySelector("img");
  const imageReady = new Promise(resolve => {
    if (!popupImage || popupImage.complete) {
      resolve();
      return;
    }
    popupImage.addEventListener("load", resolve, { once: true });
    popupImage.addEventListener("error", resolve, { once: true });
  });
  const fontReady = popup.document.fonts?.ready || Promise.resolve();

  Promise.all([imageReady, fontReady]).then(printNow);
  popup.addEventListener("afterprint", () => popup.close(), { once: true });
}

document.addEventListener("click", event => {
  const printButton = event.target.closest("#printDeliveryQr, #printTakeawayQr");
  if (!printButton) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  adminVrPrintSingleQr(printButton);
}, true);

adminVrEnhancePagination();

new MutationObserver(() => adminVrEnhancePagination()).observe(document.body, {
  childList: true,
  subtree: true
});


/* ADMIN_MODAL_TEMPLATE_LOCAL_PRINT_FONT_20260803_003 */
function adminVrModalPresentation(titleText = "") {
  const isTable = /โต๊ะ/.test(titleText);
  const isEdit = /แก้ไข/.test(titleText);

  return {
    entity: isTable ? "table" : "menu",
    icon: isTable ? "grid-3x3-gap" : "egg-fried",
    subtitle: isTable
      ? "กำหนดรหัส ชื่อ จำนวนที่นั่ง และสถานะการใช้งาน"
      : "กรอกชื่อ หมวดหมู่ ราคา รูปอาหาร และสถานะการขาย",
    actionIcon: isEdit ? "floppy" : "plus-lg",
    actionLabel: isEdit ? "บันทึก" : "สร้าง"
  };
}

function adminVrEnsureModalTemplate() {
  const modal = document.querySelector(".admin-edit-modal");
  if (!modal || modal.dataset.adminVrTemplate === "true") return;

  const header = modal.querySelector(".admin-edit-modal-head");
  const body = modal.querySelector(".admin-edit-modal-body");
  const title = modal.querySelector("#adminEditModalTitle");
  const closeButton = modal.querySelector("[data-close-admin-modal]");

  if (!header || !body || !title || !closeButton) return;

  const iconWrap = document.createElement("span");
  iconWrap.className = "admin-edit-modal-icon";
  iconWrap.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "admin-edit-modal-copy";

  const subtitle = document.createElement("p");
  subtitle.className = "admin-edit-modal-subtitle";
  subtitle.id = "adminEditModalSubtitle";

  header.insertBefore(copy, title);
  copy.append(title, subtitle);
  header.insertBefore(iconWrap, copy);

  closeButton.className = "admin-edit-modal-close";
  closeButton.innerHTML =
    '<i class="bi bi-x-lg" aria-hidden="true"></i>';
  modal.setAttribute("aria-describedby", subtitle.id);

  const footer = document.createElement("footer");
  footer.className = "admin-edit-modal-footer";
  footer.innerHTML = `
    <button class="btn admin-edit-modal-cancel" type="button">
      <i class="bi bi-x-circle" aria-hidden="true"></i>
      <span>ยกเลิก</span>
    </button>
    <button class="btn btn-primary admin-edit-modal-submit" type="button">
      <i class="bi bi-plus-lg" aria-hidden="true"></i>
      <span>สร้าง</span>
    </button>
  `;
  body.insertAdjacentElement("afterend", footer);

  const cancelButton = footer.querySelector(".admin-edit-modal-cancel");
  const submitButton = footer.querySelector(".admin-edit-modal-submit");

  let sourceSubmit = null;
  let sourceObserver = null;

  function presentation() {
    return adminVrModalPresentation(title.textContent.trim());
  }

  function syncSubmitButton() {
    const current = presentation();
    const busy = Boolean(sourceSubmit?.disabled);
    submitButton.disabled = busy;

    if (busy) {
      const busyText = sourceSubmit?.textContent?.trim() || "กำลังบันทึก...";
      submitButton.innerHTML = `
        <span class="admin-edit-modal-spinner" aria-hidden="true"></span>
        <span>${busyText}</span>
      `;
      return;
    }

    submitButton.innerHTML = `
      <i class="bi bi-${current.actionIcon}" aria-hidden="true"></i>
      <span>${current.actionLabel}</span>
    `;
  }

  function bindSourceSubmit() {
    sourceObserver?.disconnect();
    if (sourceSubmit) sourceSubmit.classList.remove("admin-edit-modal-source-submit");

    const form = body.querySelector("form");
    sourceSubmit = form?.querySelector(
      "#saveMenuButton, button[type='submit'], button:not([type])"
    ) || null;

    if (sourceSubmit) {
      sourceSubmit.classList.add("admin-edit-modal-source-submit");
      sourceObserver = new MutationObserver(syncSubmitButton);
      sourceObserver.observe(sourceSubmit, {
        attributes: true,
        attributeFilter: ["disabled"],
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    syncSubmitButton();
  }

  function syncPresentation() {
    const current = presentation();
    modal.dataset.adminModalEntity = current.entity;
    iconWrap.innerHTML =
      `<i class="bi bi-${current.icon}" aria-hidden="true"></i>`;
    subtitle.textContent = current.subtitle;
    syncSubmitButton();
  }

  cancelButton.addEventListener("click", () => closeButton.click());

  submitButton.addEventListener("click", () => {
    const form = body.querySelector("form");
    if (!form || submitButton.disabled) return;

    if (typeof form.requestSubmit === "function") {
      if (sourceSubmit) form.requestSubmit(sourceSubmit);
      else form.requestSubmit();
      return;
    }

    sourceSubmit?.click();
  });

  new MutationObserver(syncPresentation).observe(title, {
    childList: true,
    characterData: true,
    subtree: true
  });

  new MutationObserver(() => {
    bindSourceSubmit();
    syncPresentation();
  }).observe(body, {
    childList: true,
    subtree: true
  });

  modal.dataset.adminVrTemplate = "true";
  syncPresentation();
  bindSourceSubmit();
}

adminVrEnsureModalTemplate();

new MutationObserver(adminVrEnsureModalTemplate).observe(document.body, {
  childList: true,
  subtree: true
});
