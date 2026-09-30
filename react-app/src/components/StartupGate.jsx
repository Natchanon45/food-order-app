import { PageReadyOverlay } from "./PageReadyOverlay";
import { useAuth } from "@/auth/AuthProvider";import { useTenant } from "@/tenant/TenantProvider";import { useI18n } from "@/i18n/I18nProvider";
export function StartupGate({children}){const a=useAuth(),n=useTenant(),{t}=useI18n();
 if(a.status==="loading")return <PageReadyOverlay title={t("auth.checking")} message={t("common.loading")}/>;
 if(a.status==="error")return <PageReadyOverlay error title={t("auth.failed")} message={String(a.error?.message||"")} onRetry={()=>location.reload()}/>;
 if(n.status==="loading")return <PageReadyOverlay title={t("auth.loadingTenant")} message={t("common.loading")}/>;
 if(n.status==="error")return <PageReadyOverlay error title={t("auth.failed")} message={String(n.error?.message||"")} onRetry={()=>location.reload()}/>;
 return children}
