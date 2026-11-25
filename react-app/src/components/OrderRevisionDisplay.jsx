import { originalItemRevision, originalNetRevision, originalCombinedNetRevision } from "@/data/orderRevision.mjs";
import "@/ui/cashier-source-order-revisions.css";

// Original values are immutable display history from the Go-signed payload.
// Never infer refunded amounts or a completed external money transfer.
export function OriginalItemLine({ item, money, showAmount = false, nameFirst = false }) {
  const original = originalItemRevision(item);
  if (!original) return null;
  // Exactly the same wording and placement as the current item line.
  // Prices only appear when that page already has a line-amount column.
  return <div className="order-revision-original order-revision-item-row" data-original-item-line>
    <del>{nameFirst ? (original.name + " x " + original.qty) : (original.qty + " × " + original.name)}</del>
    {showAmount ? <del className="order-revision-original-amount" data-original-line-total>{money(original.amount)}</del> : null}
  </div>;
}
export function OriginalLineAmount({ item, money }) {
  const original = originalItemRevision(item);
  return original ? <del className="order-revision-original" data-original-line-total>{money(original.amount)}</del> : null;
}
// Standalone table row: original name and original total share their baseline
// above the normal SOURCE 3-column current item / unit-price / total row.
export function ReceiptOriginalItemRow({ item, money }) {
  if (!originalItemRevision(item)) return null;
  return <tr className="receipt-revision-history-row" data-original-receipt-row>
    <td className="receipt-item-name"><OriginalItemLine item={item} money={money} nameFirst /></td>
    <td className="num receipt-unit"></td>
    <td className="num receipt-line-total"><OriginalLineAmount item={item} money={money} /></td>
  </tr>;
}

export function RevisedOrderNet({ order, orders, money, current, unit = "" }) {
  const original = Array.isArray(orders)
    ? originalCombinedNetRevision(orders)
    : originalNetRevision(order);
  const display = value => money(value) + (unit ? " " + unit : "");
  if (original === null) return <>{display(current)}</>;
  return <span className="order-revision-total" data-revised-order-net>
    <del className="order-revision-original" data-original-net-total>{display(original)}</del>
    <strong data-current-net-total>{display(current)}</strong>
  </span>;
}

export function OrderCancellationWatermark({ order, orders, t }) {
  const rows = Array.isArray(orders) ? orders : [order];
  if (!rows.length || rows.some(row => !row || row.status !== "cancelled")) return null;
  const actors = new Set(rows.map(row => String(row.cancellationSource || "unknown")));
  const actor = actors.size === 1 ? [...actors][0] : "mixed";
  const source = ["cashier", "kitchen", "mixed"].includes(actor) ? actor : "unknown";
  return <div className="order-revision-cancel-watermark"
    aria-label={t("sales_report.cancel.cancelled")} data-cancelled-actor-watermark>
    {t("sales_report.cancel.source_" + source)}
  </div>;
}
