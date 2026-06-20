import { inspectLegacyData, migrateLegacyStore } from "./saas-migration-service.js";
import { toast } from "./ui.js";

const state = document.querySelector("#migrationState");
const menuCount = document.querySelector("#menuCount");
const tableCount = document.querySelector("#tableCount");
const orderCount = document.querySelector("#orderCount");
const settingCount = document.querySelector("#settingCount");
const overwriteData = document.querySelector("#overwriteData");
const refreshButton = document.querySelector("#refreshMigration");
const startButton = document.querySelector("#startMigration");
const log = document.querySelector("#migrationLog");

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
    state.textContent = summary.shopExists ? "สร้างร้านแล้ว" : "พร้อมเริ่ม";
  } catch (error) {
    console.error(error);
    state.textContent = "ตรวจสอบไม่สำเร็จ";
    toast("ตรวจสอบข้อมูลเดิมไม่สำเร็จ", "error");
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", refreshSummary);

startButton.addEventListener("click", async () => {
  const overwrite = overwriteData.checked;
  const confirmed = confirm(overwrite
    ? "ยืนยันย้ายข้อมูลและเขียนทับข้อมูล SaaS ที่มีอยู่?"
    : "ยืนยันสร้างร้านเริ่มต้นและคัดลอกข้อมูลเดิม? ข้อมูลเดิมจะไม่ถูกลบ");
  if (!confirmed) return;

  startButton.disabled = true;
  refreshButton.disabled = true;
  log.textContent = "";
  appendLog("เริ่มกระบวนการย้ายข้อมูล...");

  try {
    const results = await migrateLegacyStore({
      overwrite,
      onProgress: ({ message }) => appendLog(message)
    });

    for (const result of results) {
      appendLog(`${result.sourceName}: คัดลอก ${result.copied}, ข้าม ${result.skipped}, ทั้งหมด ${result.total}`);
    }

    state.textContent = "ย้ายสำเร็จ";
    toast("ย้ายข้อมูลเข้าร้านเริ่มต้นแล้ว");
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
