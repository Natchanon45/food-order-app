import { waitForAuth, getUserProfile } from "./auth-service.js?v=20260802-104";

let contextPromise = null;

export function ensureAdminSessionContext() {
  if (contextPromise) return contextPromise;
  contextPromise = (async () => {
    const user = await waitForAuth();
    if (!user) throw new Error("ADMIN_AUTH_REQUIRED");
    const profile = await getUserProfile(user);
    if (!profile || profile.active === false || !["owner", "admin", "super_admin"].includes(profile.role)) {
      throw new Error("ADMIN_PERMISSION_REQUIRED");
    }
    return profile;
  })();
  return contextPromise;
}
