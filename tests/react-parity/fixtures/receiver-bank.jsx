import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { PlatformReceiverBankSelect } from "../../../react-app/src/components/PlatformReceiverBankSelect.jsx";

function Fixture() {
  const [value, setValue] = useState("01014");
  window.__bankCode = value;
  return (
    <main style={{ padding: 32, maxWidth: 540 }}>
      <label htmlFor="platformSlip2GoReceiverAccountType">ธนาคารผู้รับเงิน</label>
      <PlatformReceiverBankSelect
        id="platformSlip2GoReceiverAccountType"
        value={value}
        options={window.__bankOptions}
        onChange={setValue}
        searchPlaceholder="ค้นหาธนาคาร"
        noResultsText="ไม่พบธนาคาร"
        loadMoreText="โหลดรายการเพิ่มเติม"
      />
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
