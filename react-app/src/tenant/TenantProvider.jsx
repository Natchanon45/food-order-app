import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/client";
import { useAuth } from "@/auth/AuthProvider";
import { tenantAccessDecision, tenantAccessError } from "@/auth/tenantAccess";

const Ctx = createContext(null);
const KEY = "food_order_active_tenant";
const ACCESS_RECHECK_MS = 30_000;

function persist(tenant) {
  try {
    if (tenant) localStorage.setItem(KEY, JSON.stringify(tenant));
    else localStorage.removeItem(KEY);
  } catch {}
}

export function TenantProvider({ children }) {
  const auth = useAuth();
  const [state, setState] = useState({ status: "loading", tenant: null, error: null });

  useEffect(() => {
    let alive = true;
    let latestSnapshot = null;
    const profile = auth.profile;

    if (auth.status === "loading") {
      setState({ status: "loading", tenant: null, error: null });
      return () => { alive = false; };
    }
    if (auth.status === "error") {
      setState({ status: "error", tenant: null, error: auth.error });
      return () => { alive = false; };
    }
    if (!profile || profile.role === "super_admin") {
      persist(null);
      setState({ status: "ready", tenant: null, error: null });
      return () => { alive = false; };
    }
    if (!profile.tenantId) {
      persist(null);
      setState({ status: "error", tenant: null, error: new Error("TENANT_CONTEXT_REQUIRED") });
      return () => { alive = false; };
    }

    const evaluate = (data, id) => {
      if (!alive || !data) return;
      const decision = tenantAccessDecision(data, profile.role);
      if (!decision.allowed) {
        persist(null);
        setState({ status: "error", tenant: null, error: tenantAccessError(decision) });
        return;
      }

      const tenant = {
        ...data,
        id,
        effectiveSubscriptionStatus: decision.status,
        slug: String(profile.tenantSlug || data.slug || "").trim().toLowerCase(),
        name: String(profile.tenantName || data.name || data.shopName || data.slug || "").trim(),
      };
      if (!tenant.slug) {
        persist(null);
        setState({ status: "error", tenant: null, error: new Error("TENANT_SLUG_REQUIRED") });
        return;
      }

      persist({ id: tenant.id, slug: tenant.slug, name: tenant.name });
      setState({ status: "ready", tenant, error: null });
    };

    setState({ status: "loading", tenant: null, error: null });
    const tenantRef = doc(db, "tenants", profile.tenantId);
    const stop = onSnapshot(tenantRef, snapshot => {
      if (!snapshot.exists()) {
        latestSnapshot = null;
        persist(null);
        if (alive) setState({ status: "error", tenant: null, error: new Error("TENANT_NOT_FOUND") });
        return;
      }
      latestSnapshot = { id: snapshot.id, data: snapshot.data() };
      evaluate(latestSnapshot.data, latestSnapshot.id);
    }, error => {
      persist(null);
      if (alive) setState({ status: "error", tenant: null, error });
    });

    const timer = window.setInterval(() => {
      if (latestSnapshot) evaluate(latestSnapshot.data, latestSnapshot.id);
    }, ACCESS_RECHECK_MS);

    return () => {
      alive = false;
      window.clearInterval(timer);
      stop();
    };
  }, [auth.status, auth.profile, auth.error]);

  const value = useMemo(() => state, [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant() {
  const value = useContext(Ctx);
  if (!value) throw new Error("TENANT_PROVIDER_REQUIRED");
  return value;
}
