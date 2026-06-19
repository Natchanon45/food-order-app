import { dataService } from "./data-service.js";

const textFieldIds = ["promptPayId", "promptPayName", "bankName", "bankAccountNumber", "bankAccountName"];
const feeFieldIds = ["deliveryFeeNearby", "deliveryFeeGeneral", "deliveryFeeFar"];
const currentSettings = await dataService.getStoreSettings();

for (const fieldId of textFieldIds) {
  const field = document.getElementById(fieldId);
  if (field) field.value = currentSettings[fieldId] || "";
}

const feeDefaults = {
  deliveryFeeNearby: 0,
  deliveryFeeGeneral: 30,
  deliveryFeeFar: 50
};

for (const fieldId of feeFieldIds) {
  const field = document.getElementById(fieldId);
  if (field) field.value = Number(currentSettings[fieldId] ?? feeDefaults[fieldId]);
}

document.getElementById("storeForm")?.addEventListener("submit", async () => {
  const settings = {};

  for (const fieldId of textFieldIds) {
    settings[fieldId] = document.getElementById(fieldId)?.value.trim() || "";
  }

  for (const fieldId of feeFieldIds) {
    settings[fieldId] = Math.max(0, Number(document.getElementById(fieldId)?.value || 0));
  }

  await dataService.saveStoreSettings(settings);
});
