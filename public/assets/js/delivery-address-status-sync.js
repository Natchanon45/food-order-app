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
    lookupStatus.textContent = `พบ ${count} ที่อยู่ เลือกที่อยู่สำหรับจัดส่งได้เลย`;
    return;
  }

  if (/กำลังโหลด|โหลดที่อยู่ไม่สำเร็จ/.test(lookupStatus.textContent || "")) return;
  lookupStatus.textContent = "ยังไม่มีที่อยู่ที่บันทึกไว้ กรุณาเพิ่มที่อยู่ใหม่";
}

if (addressCount && lookupStatus) {
  syncAddressStatus();
  new MutationObserver(syncAddressStatus).observe(addressCount, {
    childList: true,
    characterData: true,
    subtree: true
  });
}