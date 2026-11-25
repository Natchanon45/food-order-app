import { useLayoutEffect, useRef } from "react";

// Shrink only the badge label to its available width, keeping the full text
// in one line even with translated or unusually long status labels.
function StaffStatusBadge({className, children}) {
  const badgeRef = useRef(null);
  const textRef = useRef(null);
  useLayoutEffect(() => {
    const badge = badgeRef.current;
    const label = textRef.current;
    let active = true;
    const fit = () => {
      if (!active || !badge || !label || !badge.clientWidth) return;
      label.style.fontSize = "";
      const css = getComputedStyle(badge);
      const available = badge.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      const natural = label.getBoundingClientRect().width;
      if (available > 0 && natural > available) {
        const base = parseFloat(css.fontSize);
        label.style.fontSize = Math.floor(base * (available - 1) / natural * 100) / 100 + "px";
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(badge);
    document.fonts?.ready.then(fit);
    return () => { active = false; observer.disconnect(); };
  }, [children]);
  return <span ref={badgeRef} className={className}><span ref={textRef} className="delivery-staff-status-label">{children}</span></span>;
}

// One presentation for the cashier and kitchen; operational and payment
// state remain independent. No matching, payment or admission side effects.
export function DeliveryOrderHeading({order,t,date,status,overdueLabel}) {
  const paid=order.paymentStatus==="paid";
  const payment=paid?t("cashier.payment.confirmed"):
    order.paymentMethod==="cod"?t("cashier.payment.cod"):
    order.paymentStatus==="pending_verification"?t("cashier.payment.header_pending_verification"):
    t("cashier.payment.waiting");
  return <header className="delivery-staff-heading">
    <div className="delivery-staff-bill-column">
      <span className="delivery-staff-bill"><small>{t("cashier_documents.receipt.bill_number")}</small><strong>{order.billNo || order.billId || "-"}</strong></span>
      {overdueLabel?<span className="delivery-staff-overdue">{overdueLabel}</span>:null}
    </div>
    <div className="delivery-staff-recipient">
      <h2>{t("kitchen.order.delivery_title",{name:order.recipientName || t("cashier.delivery.recipient_fallback")})}</h2>
      <time>{date}{order.queueNo?" · "+t("cashier.queue.number")+": "+order.queueNo:""}</time>
    </div>
    <div className="delivery-staff-states">
      <StaffStatusBadge className="delivery-staff-order-status">{status}</StaffStatusBadge>
      <StaffStatusBadge className={"delivery-staff-payment-status "+(paid?"is-paid":"is-pending")}>{payment}</StaffStatusBadge>
    </div>
  </header>;
}
