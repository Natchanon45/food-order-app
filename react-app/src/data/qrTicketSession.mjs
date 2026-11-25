// Firebase owns QR session validity. Keep SOURCE ticket JSX unchanged while
// deciding whether its currently displayed data belongs to an active session.
const asId = value => String(value ?? "").trim();

export function sameQrTicketSession(a, b) {
  return Boolean(asId(a?.table?.id) && asId(a?.token)
    && asId(a?.table?.id) === asId(b?.table?.id)
    && asId(a?.token) === asId(b?.token));
}

export function isCurrentQrTicket(ticket, table) {
  return Boolean(
    asId(ticket?.table?.id) && asId(ticket?.token)
    && asId(ticket.table.id) === asId(table?.id)
    && table?.active !== false
    && table?.status === "occupied"
    && String(table?.occupancyType || "qr").toLowerCase() !== "walkin"
    && !asId(table?.walkInOrderId)
    && asId(table?.orderToken) === asId(ticket.token)
  );
}

export function isCurrentQrTicketInTables(ticket, tables) {
  return Array.isArray(tables) && tables.some(table => isCurrentQrTicket(ticket, table));
}
