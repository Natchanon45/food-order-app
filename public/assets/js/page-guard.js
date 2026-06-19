import { requireRole } from "./auth-service.js";

const roles = (document.body.dataset.roles || "")
  .split(",")
  .map(role => role.trim())
  .filter(Boolean);

await requireRole(roles);
