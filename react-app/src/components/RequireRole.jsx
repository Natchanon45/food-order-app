import { useLocation } from "react-router-dom";import { useAuth } from "@/auth/AuthProvider";import { useI18n } from "@/i18n/I18nProvider";
export function RequireRole({allowed=[],children}){const {profile}=useAuth(),{t}=useI18n(),loc=useLocation();
 if(!profile){const next=encodeURIComponent("/react"+loc.pathname+loc.search);return <section className="state-card"><h1>{t("auth.loginRequired")}</h1><a className="button button-primary" href={"/login/?next="+next}>{t("common.signIn")}</a></section>}
 const ok=profile.role==="owner"||profile.role==="super_admin"||allowed.includes(profile.role);if(!ok)return <section className="state-card"><h1>{t("auth.forbidden")}</h1><p>{profile.email||profile.uid}</p></section>;return children}
