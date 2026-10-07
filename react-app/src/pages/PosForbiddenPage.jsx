import { useMemo } from "react";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { Link } from "react-router-dom";
import { getRetailPosSession } from "@/auth/retailPosSession";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PosNavigation } from "@/components/PosNavigation";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";

export function PosForbiddenPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const stylesReady = useParityPage({
    title: t("pos_forbidden.meta_title"),
    bodyClass: "pos-forbidden-page",
    styles: ["retail-pos.css", "retail-pos-navigation.css", "icons.css"],
  });
  const session = useMemo(() => getRetailPosSession(), []);
  const posProfile = session || profile || {};
  if (!stylesReady) return <PageReadyOverlay />;
  return (
    <>
      <header className="pos-header">
        <div><strong>{t("pos_forbidden.header_title")}</strong><small>{t("pos_forbidden.header_subtitle")}</small></div>
        <div className="header-actions"><LocaleSwitcher /><PosNavigation profile={posProfile} currentKey="" /></div>
      </header>
      <main className="forbidden-page">
        <section className="forbidden-card">
          <span className="forbidden-icon" aria-hidden="true"><i className="bi bi-shield-exclamation"></i></span>
          <h1>{t("pos_forbidden.title")}</h1>
          <p>{t("pos_forbidden.description")}</p>
          <div className="dialog-actions"><Link className="btn btn-secondary header-link" to="/pos"><i className="bi bi-house-door app-icon"></i><span>{t("pos_forbidden.home")}</span></Link></div>
        </section>
      </main>
    </>
  );
}
