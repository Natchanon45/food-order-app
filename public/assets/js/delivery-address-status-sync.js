import "./public-i18n-bootstrap.js?v=20260903-231";

import { t } from "./i18n.js?v=20260903-202";

const addressCount = document.querySelector("#addressCount");
const lookupStatus = document.querySelector("#addressLookupStatus");

function currentAddressCount() {
  const match = String(addressCount?.textContent || "").match(/(\d+)\s*\/\s*5/);
  return match ? Number(match[1]) : 0;
}

function syncAddressStatus() {
  if (!lookupStatus || !addressCount) return;
  const count = currentAddressCount();

  if (count > 0) {
    lookupStatus.textContent = t("delivery.checkout.address.found", { count });
    return;
  }

  const status = lookupStatus.textContent || "";
  if (status.includes(t("delivery.checkout.address.loading")) || status.includes(t("delivery.checkout.address.load_failed"))) return;
  lookupStatus.textContent = t("delivery.checkout.address.none_saved_prompt");
}

if (addressCount && lookupStatus) {
  syncAddressStatus();
  new MutationObserver(syncAddressStatus).observe(addressCount, {
    childList: true,
    characterData: true,
    subtree: true
  });
}