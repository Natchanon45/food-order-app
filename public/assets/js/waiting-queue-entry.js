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

function createHeaderLink() {
  const link = document.createElement("a");
  link.href = WAITING_QUEUE_HREF;
  link.className = "btn btn-secondary waiting-queue-header-link";
  link.dataset.waitingQueueHeaderLink = "1";
  link.setAttribute("aria-label", "คิวรอโต๊ะ");
  link.title = "คิวรอโต๊ะ";
  link.innerHTML = '<i class="bi bi-person-standing" aria-hidden="true"></i><span>คิวรอโต๊ะ</span>';
  return link;
}

function mountCashierHeaderLink() {
  if (!location.pathname.startsWith("/cashier")) return false;
  if (document.querySelector('[data-waiting-queue-header-link="1"]')) return true;
  const headerActions = document.querySelector(".header-actions,.top-actions,[data-header-actions]");
  if (!headerActions) return false;
  headerActions.prepend(createHeaderLink());
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
    .waiting-queue-header-link{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;text-decoration:none!important;white-space:nowrap!important}
    .waiting-queue-header-link>.pos-context-icon,.waiting-queue-home-card>.pos-context-icon{display:none!important}
    .waiting-queue-home-card .waiting-queue-home-icon{color:#159447!important}
    @media(max-width:640px){.waiting-queue-header-link span{display:none}.waiting-queue-header-link{width:42px!important;min-width:42px!important;padding-inline:0!important}}
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
