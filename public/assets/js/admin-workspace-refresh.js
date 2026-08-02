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
