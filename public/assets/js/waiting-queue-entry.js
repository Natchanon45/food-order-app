const WAITING_QUEUE_HREF = "/waiting-queue/";
const ROOT_PATHS = new Set(["/", "/index.html"]);

function visibleText(element) {
  return String(element?.textContent || "").replace(/\s+/g, " ").trim();
}

function stripDuplicateIdentity(root) {
  root.removeAttribute("id");
  root.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
  [root, ...root.querySelectorAll("*")].forEach(element => {
    [...element.attributes].forEach(attribute => {
      if (/^data-(?:route|role|permission|menu|module|action|target)/i.test(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
}

function replaceText(element, title, description) {
  const titleNode = element.querySelector(".nav-card-label,.dashboard-card-title,.card-title,.menu-title,h2,h3,h4,strong");
  if (titleNode) titleNode.textContent = title;

  const descriptionNode = [...element.querySelectorAll("p,small,.menu-description,.card-description")]
    .find(node => node !== titleNode && visibleText(node));
  if (descriptionNode) descriptionNode.textContent = description;
}

function replaceIcon(element) {
  const icons = [...element.querySelectorAll("i")];
  const primary = icons[0];
  if (primary) {
    primary.className = "bi bi-person-standing app-icon waiting-queue-home-icon";
    primary.setAttribute("aria-hidden", "true");
  }
  icons.slice(1).forEach(icon => {
    if (icon.classList.contains("pos-context-icon")) icon.remove();
  });
}

function homeCardExists() {
  return Boolean(document.querySelector('[data-waiting-queue-home-card="1"],a[href="/waiting-queue/"].waiting-queue-home-card'));
}

function mountHomeCard() {
  if (homeCardExists()) return true;
  const reference = [...document.querySelectorAll("a[href]")].find(anchor =>
    /แคชเชียร์ร้านอาหาร|cashier/i.test(visibleText(anchor))
  );
  if (!reference) return false;

  const card = reference.cloneNode(true);
  stripDuplicateIdentity(card);
  card.href = WAITING_QUEUE_HREF;
  card.classList.add("waiting-queue-home-card");
  card.dataset.waitingQueueHomeCard = "1";
  card.setAttribute("aria-label", "คิวรอโต๊ะ");
  card.title = "คิวรอโต๊ะ";
  replaceText(card, "คิวรอโต๊ะ", "รับคิว เรียกคิว และเปิดโต๊ะเมื่อถึงลำดับ");
  card.querySelectorAll(".nav-card-label").forEach(node => {
    node.textContent = "คิวรอโต๊ะ";
  });
  replaceIcon(card);
  reference.insertAdjacentElement("afterend", card);
  return true;
}

function mountCashierHeaderLink() {
  if (!location.pathname.startsWith("/cashier")) return false;
  document
    .querySelectorAll('[data-waiting-queue-header-link="1"],.waiting-queue-header-link')
    .forEach(element => element.remove());
  return true;
}

function removeLegacyFloatingEntry() {
  document.querySelectorAll(".waiting-queue-entry-link").forEach(element => {
    const style = getComputedStyle(element);
    if (style.position === "fixed" || element.style.position === "fixed") element.remove();
  });
}

function ensureStyles() {
  if (document.querySelector("#waitingQueueEntryStyle")) return;
  const style = document.createElement("style");
  style.id = "waitingQueueEntryStyle";
  style.textContent = `
    .waiting-queue-home-card>.pos-context-icon{display:none!important}
    .waiting-queue-home-card .waiting-queue-home-icon{color:#159447!important}
  `;
  document.head.appendChild(style);
}

function mount() {
  removeLegacyFloatingEntry();
  if (location.pathname.startsWith("/waiting-queue")) return;
  ensureStyles();

  if (ROOT_PATHS.has(location.pathname)) {
    if (!mountHomeCard()) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (mountHomeCard() || attempts >= 20) clearInterval(timer);
      }, 150);
    }
    return;
  }

  mountCashierHeaderLink();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
