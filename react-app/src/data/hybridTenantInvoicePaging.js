// Phase 9: guard paginated invoice results against stale tenant/refresh requests.
// Firestore document IDs, never user-supplied invoice fields, identify each row.
export function mergeHybridTenantInvoicePage(current, scope, cursor, incoming) {
  if (!current || current.scope !== scope || !cursor || current.cursor !== cursor
    || !incoming || !Array.isArray(incoming.items)) return current;
  const items = [...current.items];
  const seen = new Set(items.map(row => row.id));
  for (const row of incoming.items) {
    if (!row || typeof row.id !== "string" || seen.has(row.id)) continue;
    seen.add(row.id);
    items.push(row);
  }
  return {
    scope, items, cursor: incoming.cursor || null, hasMore: incoming.hasMore === true,
  };
}
