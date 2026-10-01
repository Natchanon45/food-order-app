// Delivery customer authentication is intentionally isolated from staff auth.
// This compatibility module remains as a no-op so older cached module graphs
// cannot re-hide the customer Google login when a staff session exists.
export {};
