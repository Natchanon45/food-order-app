import { useEffect, useMemo } from "react";
import "@/ui/cashier-source-telegram-focus.css";

// The Telegram URL never grants access. The signed cashier/kitchen order feed
// remains tenant/role-scoped. If an unpaid order is not admitted to the kitchen
// queue, explain that rather than surfacing unauthorized order details.
export function TelegramOrderFocus({ orders = [], role = "cashier" }) {
  const requested = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("orderId") || "";
    return /^[a-zA-Z0-9_-]{8,128}$/.test(value) ? value : "";
  }, []);
  const selected = orders.some(order => order?.id === requested);
  useEffect(() => {
    if (!requested || !selected) return undefined;
    const element = Array.from(document.querySelectorAll("[data-telegram-order-id]"))
      .find(node => node.getAttribute("data-telegram-order-id") === requested);
    if (!element) return undefined;
    element.classList.add("telegram-order-focus-active");
    element.scrollIntoView({behavior:"smooth",block:"center"});
    return () => element.classList.remove("telegram-order-focus-active");
  }, [requested, selected, orders]);
  if (!requested) return null;
  return (
    <aside className="telegram-order-focus-banner" role="status" data-telegram-order-lookup={requested}>
      <i className="bi bi-telegram" aria-hidden="true"></i>
      <span>
        <strong>เปิดจาก Telegram • ออร์เดอร์ {requested}</strong>
        <small>{selected
          ? "พบออร์เดอร์ในคิวปัจจุบัน ระบบเลื่อนไปยังรายการให้แล้ว"
          : role === "kitchen"
            ? "หากยังไม่เห็นรายการ ออร์เดอร์อาจรอแคชเชียร์ตรวจสอบการชำระเงิน หรือออกจากคิวครัวแล้ว"
            : "ออร์เดอร์อาจถูกปิดงานแล้วหรือไม่ได้อยู่ในรายการที่บัญชีนี้มีสิทธิ์ดู"}</small>
      </span>
    </aside>
  );
}
