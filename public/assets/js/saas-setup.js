import "./sweet-dialog.js?v=20260629-048";
import { inspectLegacyData, migrateLegacyStore } from "./saas-migration-service.js?v=20260621-2";
import { toast } from "./ui.js?v=20260701-001";

if (!document.querySelector('link[href*="sweet-dialog.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/sweet-dialog.css?v=20260629-048";
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
  state.textContent = "กำลังตรวจสอบ";
  refreshButton.disabled = true;
  try {
    const summary = await inspectLegacyData();
    menuCount.textContent = `${summary.menus} รายการ`;
    tableCount.textContent = `${summary.tables} โต๊ะ`;
    orderCount.textContent = `${summary.orders} ออเดอร์`;
    settingCount.textContent = summary.settings ? "พบข้อมูล" : "ไม่พบข้อมูล";
    state.textContent = summary.tenantExists ? "พบ Tenant แล้ว" : "พร้อมเริ่ม";
  } catch (error) {
    console.error(error);
    state.textContent = "ตรวจสอบไม่สำเร็จ";
    toast("ตรวจสอบข้อมูลต้นทางไม่สำเร็จ", "error");
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", refreshSummary);

startButton.addEventListener("click", async () => {
  const overwrite = overwriteData.checked;
  const confirmed = await askConfirm(overwrite
    ? "ยืนยันย้ายข้อมูลและเขียนทับข้อมูลใน Tenant ร้านส้มตำตัวเฮีย?"
    : "ยืนยันคัดลอกข้อมูลจาก default-shop เข้า Tenant ร้านส้มตำตัวเฮีย? ข้อมูลต้นทางจะไม่ถูกลบ", {
      title: "ยืนยันย้ายข้อมูล",
      confirmText: "ตกลง",
      cancelText: "ยกเลิก",
      type: "warning"
    });
  if (!confirmed) return;

  startButton.disabled = true;
  refreshButton.disabled = true;
  log.textContent = "";
  appendLog("เริ่มกระบวนการย้ายข้อมูลเข้า Tenant...");

  try {
    const results = await migrateLegacyStore({
      overwrite,
      onProgress: ({ message }) => appendLog(message)
    });

    for (const result of results) {
      appendLog(`${result.sourceName}: คัดลอก ${result.copied}, ข้าม ${result.skipped}, ทั้งหมด ${result.total}`);
    }

    state.textContent = "ย้ายสำเร็จ";
    toast("ย้ายข้อมูลเข้า Tenant ร้านแรกแล้ว");
    await refreshSummary();
  } catch (error) {
    console.error(error);
    state.textContent = "ย้ายไม่สำเร็จ";
    appendLog(`เกิดข้อผิดพลาด: ${error.message || error}`);
    toast("ย้ายข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และ Rules", "error");
  } finally {
    startButton.disabled = false;
    refreshButton.disabled = false;
  }
});

await refreshSummary();