import "./sweet-dialog.js?v=20260726-034";
import { inspectLegacyData, migrateLegacyStore } from "./saas-migration-service.js?v=20260812-134";
import { toast } from "./ui.js?v=20260805-081";
import translations from "./saas-setup-translations.js?v=20260903-216";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";

configureI18n(translations);
applyTranslations();
document.title = t("saas_setup.meta.title");
const heroDescription = document.querySelector("#saasSetupHeroDescription");
if (heroDescription) heroDescription.textContent = t("saas_setup.hero.description", { source: "shops/default-shop", tenant: "ส้มตำตัวเฮีย" });

if (!document.querySelector('link[href*="sweet-dialog.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/sweet-dialog.css?v=20260726-034";
  document.head.appendChild(link);
}

const state = document.querySelector("#migrationState");
const menuCount = document.querySelector("#menuCount");
const tableCount = document.querySelector("#tableCount");
const orderCount = document.querySelector("#orderCount");
const settingCount = document.querySelector("#settingCount");
const overwriteData = document.querySelector("#overwriteData");
const refreshButton = document.querySelector("#refreshMigration");
const startButton = document.querySelector("#startMigration");
const log = document.querySelector("#migrationLog");

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === "function") return await window.sweetConfirm(message, options);
  return false;
}

function appendLog(message) {
  log.hidden = false;
  log.textContent = `${log.textContent}${log.textContent ? "\n" : ""}${message}`;
}

async function refreshSummary() {
  state.textContent = t("saas_setup.runtime.state.checking");
  refreshButton.disabled = true;
  try {
    const summary = await inspectLegacyData();
    menuCount.textContent = t("saas_setup.runtime.count.items", { count: summary.menus });
    tableCount.textContent = t("saas_setup.runtime.count.tables", { count: summary.tables });
    orderCount.textContent = t("saas_setup.runtime.count.orders", { count: summary.orders });
    settingCount.textContent = summary.settings
      ? t("saas_setup.runtime.settings.found")
      : t("saas_setup.runtime.settings.missing");
    state.textContent = summary.tenantExists
      ? t("saas_setup.runtime.state.tenant_exists")
      : t("saas_setup.runtime.state.ready");
  } catch (error) {
    console.error(error);
    state.textContent = t("saas_setup.runtime.state.check_failed");
    toast(t("saas_setup.runtime.toast.check_failed"), "error");
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", refreshSummary);

startButton.addEventListener("click", async () => {
  const overwrite = overwriteData.checked;
  const confirmed = await askConfirm(overwrite
    ? t("saas_setup.runtime.confirm.overwrite")
    : t("saas_setup.runtime.confirm.copy", { source: "default-shop" }), {
      title: t("saas_setup.runtime.confirm.title"),
      confirmText: t("saas_setup.runtime.confirm.confirm"),
      cancelText: t("saas_setup.runtime.confirm.cancel"),
      type: "warning"
    });
  if (!confirmed) return;

  startButton.disabled = true;
  refreshButton.disabled = true;
  log.textContent = "";
  appendLog(t("saas_setup.runtime.log.start"));

  try {
    const results = await migrateLegacyStore({
      overwrite,
      onProgress: ({ message }) => appendLog(message)
    });

    for (const result of results) {
      appendLog(t("saas_setup.runtime.log.result", {
        source: result.sourceName,
        copied: result.copied,
        skipped: result.skipped,
        total: result.total,
      }));
    }

    state.textContent = t("saas_setup.runtime.state.migration_success");
    toast(t("saas_setup.runtime.toast.migration_success"));
    await refreshSummary();
  } catch (error) {
    console.error(error);
    state.textContent = t("saas_setup.runtime.state.migration_failed");
    appendLog(t("saas_setup.runtime.log.error", { message: error.message || error }));
    toast(t("saas_setup.runtime.toast.migration_failed"), "error");
  } finally {
    startButton.disabled = false;
    refreshButton.disabled = false;
  }
});

await refreshSummary();
