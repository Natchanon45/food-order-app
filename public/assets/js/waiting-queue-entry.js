const href = "/waiting-queue/";

function createLink(className = "btn btn-secondary") {
  const link = document.createElement("a");
  link.href = href;
  link.className = `${className} waiting-queue-entry-link`;
  link.setAttribute("aria-label", "คิวรอโต๊ะ");
  link.title = "คิวรอโต๊ะ";
  link.innerHTML = '<i class="bi bi-people" aria-hidden="true"></i><span>คิวรอโต๊ะ</span>';
  return link;
}

function ensureStyle() {
  if (document.querySelector("#waitingQueueEntryStyle")) return;
  const style = document.createElement("style");
  style.id = "waitingQueueEntryStyle";
  style.textContent = `.waiting-queue-entry-link{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;text-decoration:none!important;white-space:nowrap!important}.waiting-queue-entry-link .pos-context-icon{display:none!important}@media(max-width:640px){.waiting-queue-entry-link span{display:none}.waiting-queue-entry-link{width:42px!important;min-width:42px!important;padding-inline:0!important}}`;
  document.head.appendChild(style);
}

function mount() {
  if (location.pathname.startsWith("/waiting-queue")) return;
  if (document.querySelector(".waiting-queue-entry-link")) return;
  ensureStyle();
  const headerActions = document.querySelector(".header-actions, .top-actions, [data-header-actions]");
  if (headerActions) {
    headerActions.prepend(createLink());
    return;
  }
  const mainActions = document.querySelector(".page-actions, .hero-actions, .dashboard-actions");
  if (mainActions) {
    mainActions.appendChild(createLink());
    return;
  }
  const floating = createLink("btn btn-pay");
  floating.style.position = "fixed";
  floating.style.right = "16px";
  floating.style.bottom = "54px";
  floating.style.zIndex = "8000";
  document.body.appendChild(floating);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();
