import { useCallback, useEffect, useState } from "react";
import { applyPosTheme, readCachedPosTheme } from "@/config/posThemes";
import { loadPosThemeSetting } from "@/data/posThemeData";

export function usePosTheme(tenantId) {
  const [theme, setThemeState] = useState(() => readCachedPosTheme(tenantId));

  useEffect(() => {
    const id = String(tenantId || "").trim();
    const cached = applyPosTheme(readCachedPosTheme(id), id);
    setThemeState(cached);
    if (!id) return undefined;

    let alive = true;
    loadPosThemeSetting(id).then(row => {
      if (!alive) return;
      const applied = applyPosTheme(row.theme, id);
      setThemeState(applied);
    }).catch(error => console.warn("POS_THEME_LOAD_FAILED", error));

    const onApplied = event => {
      const detail = event?.detail || {};
      if (detail.tenantId && String(detail.tenantId) !== id) return;
      if (detail.theme) setThemeState(String(detail.theme));
    };
    window.addEventListener("pos-theme-applied", onApplied);
    return () => {
      alive = false;
      window.removeEventListener("pos-theme-applied", onApplied);
    };
  }, [tenantId]);

  const setTheme = useCallback(value => {
    const applied = applyPosTheme(value, tenantId);
    setThemeState(applied);
    return applied;
  }, [tenantId]);

  return { theme, setTheme };
}
