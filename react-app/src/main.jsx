import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AuthProvider } from "@/auth/AuthProvider";
import { TenantProvider } from "@/tenant/TenantProvider";
import { PlatformBrandingRuntime } from "@/components/PlatformBrandingRuntime";
import { FormValidationUi } from "@/components/FormValidationUi";
import "@/ui/toast-top-layer";
import "@/ui/horizontalScrollEnhancer";
import App from "@/app/App";

const reactAlias = location.pathname === "/react" || location.pathname.startsWith("/react/");
if (reactAlias) {
  const canonicalPath = location.pathname === "/react"
    ? "/"
    : location.pathname.slice("/react".length) || "/";
  location.replace(`${canonicalPath}${location.search}${location.hash}`);
} else {
  window.__lukkhajaReactEntryLoaded?.();

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <I18nProvider>
        <FormValidationUi />
        <AuthProvider>
          <TenantProvider>
            <PlatformBrandingRuntime />
            <BrowserRouter basename="/">
              <App />
            </BrowserRouter>
          </TenantProvider>
        </AuthProvider>
      </I18nProvider>
    </React.StrictMode>,
  );
}
