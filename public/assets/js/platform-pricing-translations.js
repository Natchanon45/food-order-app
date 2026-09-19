export default {
  th: { pricing: {
    meta: { title: "ราคาแพ็กเกจ" },
    header: { title: "ราคาแพ็กเกจ", back: "กลับระบบกลาง" },
    hero: { title: "ตั้งราคา Premium", description: "กำหนดราคา ส่วนลด และ VAT จากส่วนกลาง ค่าเดียวกันจะแสดงที่หน้าแรกและหน้าลงทะเบียน" },
    form: {
      monthly: "ราคาปกติต่อเดือน (บาท)",
      months: "จำนวนเดือนสำหรับแพ็กเกจรายปี",
      discountType: "รูปแบบส่วนลดรายปี",
      discountValue: "มูลค่าส่วนลด",
      none: "ไม่มีส่วนลด", amount: "ลดเป็นจำนวนเงิน", percent: "ลดเป็นเปอร์เซ็นต์",
      vatMode: "รูปแบบ VAT", inclusive: "Include VAT (ราคารวม VAT แล้ว)", exclusive: "Exclude VAT (ราคายังไม่รวม VAT)",
      vatRate: "VAT (%)", save: "บันทึกราคา", saving: "กำลังบันทึก...", reset: "คืนค่าเริ่มต้น"
    },
    preview: { title: "ตัวอย่างราคาที่ลูกค้าเห็น", monthly: "รายเดือน", annual: "รายปี", regular: "ราคาเต็ม", discount: "ส่วนลด", vat: "VAT", payable: "ยอดชำระจริง", net: "ราคาก่อน VAT" },
    toast: { saved: "บันทึกราคาแพ็กเกจแล้ว", failed: "บันทึกราคาแพ็กเกจไม่สำเร็จ", loadFailed: "โหลดราคาแพ็กเกจไม่สำเร็จ ใช้ค่าเริ่มต้นชั่วคราว" }
  } },
  en: { pricing: {
    meta: { title: "Package pricing" },
    header: { title: "Package pricing", back: "Back to platform" },
    hero: { title: "Premium pricing", description: "Manage price, discount, and VAT centrally. The same values appear on the homepage and registration page." },
    form: {
      monthly: "Regular monthly price (THB)",
      months: "Months in annual package",
      discountType: "Annual discount type",
      discountValue: "Discount value",
      none: "No discount", amount: "Fixed amount", percent: "Percentage",
      vatMode: "VAT mode", inclusive: "Include VAT (price already includes VAT)", exclusive: "Exclude VAT (VAT added later)",
      vatRate: "VAT (%)", save: "Save pricing", saving: "Saving...", reset: "Reset defaults"
    },
    preview: { title: "Customer price preview", monthly: "Monthly", annual: "Annual", regular: "Regular price", discount: "Discount", vat: "VAT", payable: "Amount payable", net: "Price before VAT" },
    toast: { saved: "Package pricing saved", failed: "Could not save package pricing", loadFailed: "Could not load package pricing. Temporary defaults are shown." }
  } }
};
