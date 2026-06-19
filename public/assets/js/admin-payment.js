import { dataService } from "./data-service.js";

const fieldIds = ["promptPayId", "promptPayName", "bankName", "bankAccountNumber", "bankAccountName"];
const currentSettings = await dataService.getStoreSettings();

for (const fieldId of fieldIds) {
  const field = document.getElementById(fieldId);
  if (field) field.value = currentSettings[fieldId] || "";
}

document.getElementById("storeForm")?.addEventListener("submit", async () => {
  const paymentSettings = {};
  for (const fieldId of fieldIds) {
    paymentSettings[fieldId] = document.getElementById(fieldId)?.value.trim() || "";
  }
  await dataService.saveStoreSettings(paymentSettings);
});
