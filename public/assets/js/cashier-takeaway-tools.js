import { toast } from "./ui.js?v=20260805-081";
import { sweetPrompt } from "./sweet-dialog.js?v=20260726-034";
import { t } from "./i18n.js?v=20260812-099";

function translated(key, fallback) {
  const value = t(key);
  return value === key ? fallback : value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function readStoredJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function tenantSlug() {
  const session = readStoredJson("retail_pos_session_v1");
  const activeTenant = readStoredJson("food_order_active_tenant");
  return String(session?.tenantSlug || activeTenant?.slug || "").trim();
}

function takeawayUrl() {
  const slug = tenantSlug();
  if (!slug) return "";
  return new URL(`/s/${encodeURIComponent(slug)}/takeaway/`, location.origin).toString();
}

function requireTakeawayUrl() {
  const url = takeawayUrl();
  if (url) return url;
  toast(translated(
    "cashier.takeaway_tools.store_unavailable",
    "ไม่พบข้อมูลร้าน กรุณารีเฟรชหน้าแล้วลองใหม่",
  ));
  return "";
}

async function qrImage(url) {
  try {
    const { qrDataUrl } = await import("./local-qr.js?v=20260722-037");
    return qrDataUrl(url, { size: 260, margin: 4 });
  } catch (error) {
    console.error("[cashier-takeaway] local QR generation failed", error);
    return `https://quickchart.io/qr?size=260&margin=2&text=${encodeURIComponent(url)}`;
  }
}

async function copyTakeawayLink(url) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.left = "-9999px";
      field.style.top = "0";
      field.style.fontSize = "16px";
      document.body.appendChild(field);
      field.focus();
      field.select();
      field.setSelectionRange(0, field.value.length);
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) throw new Error("COPY_NOT_SUPPORTED");
    }
    toast(t("cashier.takeaway_tools.copy_done"));
  } catch (error) {
    console.warn("[cashier-takeaway] clipboard copy failed", error);
    await sweetPrompt(t("cashier.takeaway_tools.copy_blocked"), url, {
      title: t("cashier.takeaway_tools.copy_title"),
      confirmText: t("cashier.takeaway_tools.close"),
      readOnly: true,
    });
  }
}

function ensureModal() {
  let modal = document.querySelector("#takeawayQrModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "takeawayQrModal";
  modal.hidden = true;
  modal.innerHTML = `<div class="takeaway-qr-backdrop" data-close-takeaway-qr></div><section class="takeaway-qr-card" role="dialog" aria-modal="true" aria-labelledby="takeawayQrTitle"><button class="takeaway-qr-close" type="button" data-close-takeaway-qr aria-label="${t("cashier.takeaway_tools.close")}"><i class="bi bi-x-lg" aria-hidden="true"></i></button><h2 id="takeawayQrTitle">${t("cashier.takeaway_tools.qr_title")}</h2><p>${t("cashier.takeaway_tools.qr_help")}</p><img data-takeaway-qr-image alt="${t("cashier.takeaway_tools.qr_alt")}"><input data-takeaway-qr-url readonly aria-label="${t("cashier.takeaway_tools.link_aria")}"><div class="order-actions"><button class="btn btn-warning" type="button" id="copyTakeawayQrUrl"><i class="bi bi-clipboard app-icon" aria-hidden="true"></i><span>${t("cashier.takeaway_tools.copy_link")}</span></button><a class="btn btn-primary" data-open-takeaway-page target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right app-icon" aria-hidden="true"></i><span>${t("cashier.takeaway_tools.open_page")}</span></a></div></section>`;
  document.body.appendChild(modal);

  modal.querySelectorAll("[data-close-takeaway-qr]").forEach(el => {
    el.addEventListener("click", () => { modal.hidden = true; });
  });
  modal.querySelector("#copyTakeawayQrUrl")?.addEventListener("click", () => {
    const url = modal.dataset.takeawayUrl || requireTakeawayUrl();
    if (url) copyTakeawayLink(url);
  });

  return modal;
}

async function showTakeawayQr() {
  const url = requireTakeawayUrl();
  if (!url) return;

  const modal = ensureModal();
  modal.dataset.takeawayUrl = url;
  modal.querySelector("[data-takeaway-qr-url]").value = url;
  modal.querySelector("[data-open-takeaway-page]").href = url;
  modal.hidden = false;

  const image = modal.querySelector("[data-takeaway-qr-image]");
  image.removeAttribute("src");
  image.src = await qrImage(url);
}

function mountTools() {
  const qrButton = document.querySelector("#showTakeawayQr");
  const orderLink = document.querySelector("#openTakeawayOrder");
  const copyButton = document.querySelector("#copyTakeawayUrl");

  if (orderLink) {
    const initialUrl = takeawayUrl();
    if (initialUrl) orderLink.href = initialUrl;
    orderLink.addEventListener("click", event => {
      const url = requireTakeawayUrl();
      if (!url) {
        event.preventDefault();
        return;
      }
      orderLink.href = url;
    });
  }

  qrButton?.addEventListener("click", showTakeawayQr);
  copyButton?.addEventListener("click", () => {
    const url = requireTakeawayUrl();
    if (url) copyTakeawayLink(url);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountTools, { once: true });
} else {
  mountTools();
}
