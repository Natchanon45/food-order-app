
const money = (value, locale) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
    : "—";

/**
 * Owner-supplied service conditions, displayed without claiming settlement,
 * suspensions or Slip2Go entitlements are currently automated.
 * Display amounts must be supplied by an authoritative pricing/report read.
 */
export function MerchantServiceTerms({
  locale = "th-TH",
  pricing = null,
  threshold = null,
  shareRate = null,
  context = "registration",
}) {
  const th = locale.toLowerCase().startsWith("th");
  const validPricing = pricing?.storageReady === true;
  const config = validPricing ? pricing.config : null;
  const monthly = validPricing ? pricing.pricing?.monthly?.payable : null;
  const annual = validPricing ? pricing.pricing?.annual?.payable : null;
  const cap = threshold ?? config?.deliveryThreshold;
  const rate = shareRate ?? config?.deliveryShareRate;
  const thresholdText = money(cap, locale);
  const rateText = money(rate, locale);
  const monthlyText = money(monthly, locale);
  const annualText = money(annual, locale);
  const isReport = context === "report";

  return (
    <section className={"merchant-service-terms" + (isReport ? " is-report" : "")}
      id={isReport ? "revenueShareServiceTerms" : "registrationServiceTerms"}
      aria-label={th ? "เงื่อนไขการใช้งานและค่าบริการ" : "Service and billing terms"}>
      <h3><i className="bi bi-info-circle" aria-hidden="true"></i>{" "}
        {th ? "เงื่อนไขการใช้งานและค่าบริการ PENGUIN" : "PENGUIN service and billing terms"}</h3>
      <ul>
        <li>{th
          ? "รองรับร้านอาหาร/คาเฟ่ และร้านค้าปลีก รวมถึงร้านที่ดำเนินธุรกิจทั้งสองรูปแบบ"
          : "Supports restaurants/cafés and retail stores, including combined businesses."}</li>
        <li>{th
          ? <>ทดลองใช้งานฟรี <strong>30 วันแรกหลังเปิดใช้งาน</strong> จากนั้นแพ็กเกจปกติ <strong>{monthlyText} บาท/เดือน</strong> หรือ <strong>{annualText} บาท/ปี</strong> ตามแผนและราคาที่ยืนยันไว้</>
          : <>The first <strong>30 days after activation are a trial</strong>. Standard pricing: <strong>{monthlyText} THB/month</strong> or <strong>{annualText} THB/year</strong>, subject to the confirmed plan.</>}</li>
        <li>{th
          ? <>รอบยอดขาย Delivery นับตาม <strong>วันครบรอบเปิดใช้งาน</strong> เช่น 18/10/2026–17/11/2026 และเริ่มรอบใหม่เวลา 00:00 น. วันที่ 18/11/2026 (จำนวนวันต่อรอบอาจต่างกันตามเดือน)</>
          : <>Delivery cycles follow the <strong>activation anniversary</strong>, e.g. 18 Oct–17 Nov 2026; the next cycle starts at 00:00 on 18 Nov. Calendar-month cycle lengths vary.</>}</li>
        <li>{th
          ? <>ช่วงทดลองใช้ฟรี ยอดสินค้า Delivery ที่ชำระแล้วไม่เกิน <strong>{thresholdText} บาท/รอบ</strong> ยังไม่มีส่วนแบ่ง เมื่อยอดเกินจึงคำนวณ <strong>{rateText}% เฉพาะส่วนที่เกินเพดาน</strong> ไม่คิดย้อนหลังจากยอดที่ได้รับยกเว้น</>
          : <>During trial, paid Delivery merchandise up to <strong>{thresholdText} THB/cycle</strong> has no share. Above the threshold, <strong>{rateText}% applies only to excess</strong>, never retroactively to the exempt amount.</>}</li>
        <li>{th
          ? <>เงื่อนไขแพ็กเกจกำหนดตรวจสลิป Slip2Go ฟรี <strong>100 รายการต่อรอบบิล</strong> และเมื่อยอด Delivery <strong>ถึง {thresholdText} บาท</strong> จะได้สิทธิ์ไม่จำกัดรายการในรอบนั้น</>
          : <>Package terms provide <strong>100 free Slip2Go checks per cycle</strong>, becoming unlimited for the cycle when Delivery sales <strong>reach {thresholdText} THB</strong>.</>}</li>
        <li>{th
          ? "เมื่อมีส่วนแบ่งที่ต้องชำระ กำหนดสรุปยอดรายวันและระงับการใช้งานในวันถัดจากวันครบกำหนดที่ยังไม่ชำระ ตามเงื่อนไขการเรียกเก็บที่ประกาศ"
          : "Once share is payable, the stated policy calls for daily billing and suspension the day after an unpaid due date."}</li>
      </ul>
      <p className="merchant-service-terms-status">
        {th
          ? "หมายเหตุ: รายงานยอดส่วนแบ่งเป็นข้อมูลตรวจสอบเบื้องต้น ระบบเรียกเก็บเงินจริง การระงับอัตโนมัติ และการบังคับใช้โควตา Slip2Go ยังต้องยืนยันความพร้อมของบริการ ไม่ถือว่าเปิดใช้งานเพียงเพราะแสดงเงื่อนไขนี้"
          : "Note: Revenue Share reporting is provisional. Live settlement, automatic suspension and Slip2Go quota enforcement are not confirmed active merely by displaying these terms."}
      </p>
    </section>
  );
}
