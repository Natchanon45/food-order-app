export function cashierCancellationErrorKey(error){
 const code=String(error?.response?.data?.error||error?.code||"");
 switch(code){
  case "CASHIER_CANCEL_PAYMENT_REVIEW_REQUIRED":
  case "CASHIER_CANCEL_PAYMENT_METHOD_NOT_ELIGIBLE":return "cashier.cancel_order.review_required";
  case "CASHIER_CANCEL_ALREADY_PAID":return "cashier.cancel_order.paid";
  case "CASHIER_CANCEL_PROVIDER_DISPATCH_EXISTS":return "cashier.cancel_order.dispatched";
  case "CASHIER_CANCEL_KITCHEN_IN_PROGRESS":return "cashier.cancel_order.in_progress";
  case "CASHIER_CANCEL_SESSION_REQUIRED":return "cashier.cancel_order.session_required";
  case "CASHIER_CANCEL_STATUS_INVALID":
  case "CASHIER_CANCEL_REVIEW_NOT_REQUIRED":return "cashier.cancel_order.not_eligible";
  default:return "cashier.cancel_order.failed";
 }
}
