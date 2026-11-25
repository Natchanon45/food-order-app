// Table order errors are shown only as vetted Go status/reason identifiers.
// Never echo customer data, provider payloads, QR session tokens, or SQL text.
const safeCodes = new Set([
 "INVALID_ORIGIN","INVALID_TABLE_SESSION","STOREFRONT_NOT_FOUND",
 "STOREFRONT_UNAVAILABLE","WRITE_API_DISABLED","ORDER_ID_INVALID",
 "ORDER_ITEMS_REQUIRED","ORDER_ITEM_INVALID","ORDER_ID_CONFLICT",
 "ORDER_TYPE_INVALID","ORDER_STATE_CANONICAL_ROUTE_REQUIRED",
 "ORDER_PAYMENT_CANONICAL_ROUTE_REQUIRED","TENANT_NOT_FOUND",
 "TENANT_INACTIVE","TABLE_DATA_INVALID","TABLE_ROUND_EXCEEDED",
 "MENU_NOT_AVAILABLE","MENU_READ_FAILED","QUEUE_UNAVAILABLE",
 "ORDER_AMOUNT_EXCEEDED","ORDER_CREATE_FAILED","TIMEZONE_UNAVAILABLE"
]);

export function tableOrderFailureText(error, failedText, expiredText) {
 const rawCode = error?.response?.data?.error;
 if (error?.message === "INVALID_TABLE_SESSION" || rawCode === "INVALID_TABLE_SESSION") {
  return expiredText;
 }
 const rawStatus = error?.response?.status;
 const status = Number.isInteger(rawStatus) && rawStatus>=400 && rawStatus<=599
  ? rawStatus : null;
 const code = typeof rawCode==="string" && safeCodes.has(rawCode) ? rawCode : "";
 const reason = [status ? "HTTP "+status : "",code].filter(Boolean).join(" / ");
 const text = String(failedText||"ส่งออเดอร์ไม่สำเร็จ")+
  (reason ? " ("+reason+")" : "");
 const ambiguous = status === null || [408,429].includes(status) || status>=500
  || code==="ORDER_ID_CONFLICT" || error?.message==="TABLE_ORDER_NOT_CONFIRMED";
 return ambiguous ? text+" — โปรดตรวจรายการในครัวก่อนส่งซ้ำ" : text;
}
