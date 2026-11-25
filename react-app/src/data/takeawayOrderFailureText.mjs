// Take Away errors can be terminal (4xx) or ambiguous (timeout/5xx).
// Show only vetted Go error codes; never echo provider JSON, input, customer
// details, SQL strings, request URL or Axios internals in a public toast.
const publicErrorCodes = new Set([
 "INVALID_ORIGIN", "WRITE_API_DISABLED", "TAKEAWAY_FIELDS_INVALID",
 "STOREFRONT_NOT_FOUND", "TENANT_NOT_AVAILABLE", "MENU_NOT_AVAILABLE",
 "MENU_READ_FAILED",
 "QUEUE_UNAVAILABLE", "ORDER_DATABASE_UNAVAILABLE",
 "TAKEAWAY_ORDER_FAILED", "TAKEAWAY_ORDER_COMMIT_FAILED",
 "ORDER_READBACK_FAILED", "ORDER_AMOUNT_EXCEEDED", "ORDER_ID_CONFLICT",
 "ORDER_ITEMS_REQUIRED", "ORDER_ITEM_INVALID", "ORDER_ID_INVALID",
 "TAKEAWAY_CUSTOMER_REQUIRED", "TAKEAWAY_ORDER_NOT_CONFIRMED"
]);

export function takeawayOrderFailureText(error, fallback, customerRequired) {
 if (error?.message === "TAKEAWAY_CUSTOMER_REQUIRED") return customerRequired;
 const rawStatus = error?.response?.status;
 const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599
   ? rawStatus : null;
 const rawCode = error?.response?.data?.error;
 const code = typeof rawCode === "string" && publicErrorCodes.has(rawCode)
   ? rawCode : "";
 const detail = [status ? "HTTP " + status : "", code].filter(Boolean).join(" / ");
 const text = String(fallback || "ส่งออเดอร์ไม่สำเร็จ") +
   (detail ? " (" + detail + ")" : "");
 const unconfirmed = status === null || [408, 429].includes(status) || status >= 500
   || error?.message === "TAKEAWAY_ORDER_NOT_CONFIRMED";
 return unconfirmed
   ? text + " — ยังยืนยันผลไม่ได้ โปรดตรวจรายการที่ครัวก่อนส่งซ้ำ"
   : text;
}
