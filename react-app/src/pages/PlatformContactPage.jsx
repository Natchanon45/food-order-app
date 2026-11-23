import "@/ui/platform-contact-card-collapse.css";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { ParityFooter } from "@/components/ParityFooter";
import { UserMenu } from "@/components/UserMenu";
import {
  loadGoogleCustomerLogin,
  loadPublicContact,
  saveGoogleCustomerLogin,
  savePublicContact,
} from "@/data/platformContactService";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { TelegramSettingsPanel } from "@/components/TelegramSettingsPanel";
import { LKShopPairingPanel } from "@/components/LKShopPairingPanel";

function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `app-toast ${type === "error" ? "error" : "success"}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `<span class="app-toast-icon" aria-hidden="true"><i class="bi bi-${type === "error" ? "x-circle" : "check-circle"} app-icon"></i></span><span class="app-toast-message"></span>`;
  el.querySelector(".app-toast-message").textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  window.setTimeout(() => {
    el.classList.remove("show");
    window.setTimeout(() => el.remove(), 250);
  }, 3200);
}

const CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/;
const normalizeHttpUrl = value => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};
const normalizeMessengerUrl = value => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const full = normalizeHttpUrl(raw);
  if (full) return full;
  const username = raw.replace(/^@/, "").replace(/^m\.me\//i, "").replace(/^facebook\.com\//i, "").replace(/^www\.facebook\.com\//i, "").replace(/[/?#].*$/, "").trim();
  return /^[a-zA-Z0-9._-]{2,100}$/.test(username) ? `https://m.me/${username}` : "";
};
const normalizePhone = value => String(value || "").replace(/[^\d+*#,;]/g, "");

function ContactChannel({ channel, icon, title, enabled, onEnabled, label, onLabel, value, onValue, valueId, valueLabel, placeholder, type = "text", valueMaxLength, help, t }) {
  return (
    <fieldset className="platform-contact-channel" data-channel={channel}>
      <legend><i className={`bi bi-${icon}`} aria-hidden="true"></i>{title}</legend>
      <label className="platform-contact-channel-toggle">
        <input id={`${channel}Enabled`} type="checkbox" checked={enabled} onChange={e => onEnabled(e.target.checked)} />
        <span>{t("platform_contact.contact.fields.enabled")}</span>
      </label>
      <div className="field">
        <label htmlFor={`${channel}Label`}>{t("platform_contact.contact.fields.button_label")}</label>
        <input className="input" id={`${channel}Label`} maxLength="60" value={label} onChange={e => onLabel(e.target.value)} placeholder={title} />
      </div>
      <div className="field">
        <label htmlFor={valueId}>{valueLabel}</label>
        <input className="input" id={valueId} type={type} maxLength={valueMaxLength ?? (type === "email" ? 160 : 500)} value={value} onChange={e => onValue(e.target.value)} placeholder={placeholder} />
        {help ? <small>{help}</small> : null}
      </div>
    </fieldset>
  );
}

function ContactCornerToggle({ expanded, onToggle, controls, label }) {
  return <button type="button" className="platform-contact-corner-toggle"
    title={expanded ? "หุบการ์ด" : "ขยายการ์ด"}
    aria-label={expanded ? `หุบการ์ด ${label}` : `ขยายการ์ด ${label}`}
    aria-expanded={expanded} aria-controls={controls}
    data-platform-card-toggle onClick={onToggle}>
    <i className="bi bi-chevron-down" aria-hidden="true" />
  </button>;
}

function PreviewAction({ channel, icon, label, href }) {
  return (
    <a className="public-contact-action" data-channel={channel} href={href || "#"} onClick={e => e.preventDefault()}>
      <span className="public-contact-action-icon" aria-hidden="true"><i className={`bi bi-${icon}`}></i></span>
      <span>{label}</span>
    </a>
  );
}

export function PlatformContactPage() {
  const authState = useAuth();
  const { profile } = authState;
  const { t } = useI18n();
  const [expandedCards, setExpandedCards] = useState({ public: false, telegram: false, google: false, lkShop: false });
  const toggleCard = key => setExpandedCards(current => ({ ...current, [key]: !current[key] }));
  const stylesReady = useParityPage({
    title: t("platform_contact.meta.title"),
    bodyClass: "platform-contact-page",
    styles: ["public-contact.css", "platform-contact-settings.css", "platform-google-login-settings.css", "telegram-notifications-port.css", "super-admin-header.css"],
    attributes: { "data-roles": "super_admin" },
  });

  const defaults = useMemo(() => ({
    enabled: true,
    heading: t("platform_contact.contact.defaults.heading"),
    description: t("platform_contact.contact.defaults.description"),
    phoneEnabled: false,
    phoneLabel: t("platform_contact.contact.defaults.phone_label"),
    phoneNumber: "",
    lineEnabled: false,
    lineLabel: t("platform_contact.contact.defaults.line_label"),
    lineUrl: "",
    messengerEnabled: false,
    messengerLabel: t("platform_contact.contact.defaults.messenger_label"),
    messengerUrl: "",
    emailEnabled: false,
    emailLabel: t("platform_contact.contact.defaults.email_label"),
    email: "",
  }), [t]);
  const [contact, setContact] = useState(defaults);
  const [contactStatus, setContactStatus] = useState("");
  const [contactStatusType, setContactStatusType] = useState("success");
  const [contactBusy, setContactBusy] = useState(true);
  const [initialContactReady, setInitialContactReady] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [google, setGoogle] = useState({ enabled: false, clientId: "", tokenTtlDays: 30, source: "environment" });
  const [googleStatus, setGoogleStatus] = useState("");
  const [googleStatusType, setGoogleStatusType] = useState("success");
  const [googleBusy, setGoogleBusy] = useState(true);
  const [initialGoogleReady, setInitialGoogleReady] = useState(false);
  const [googleSaving, setGoogleSaving] = useState(false);
  const [contactLoadError, setContactLoadError] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState(false);
  const [googleStorageReady, setGoogleStorageReady] = useState(false);
  // Ambiguous writes may already have changed Laravel. Don't permit a duplicate
  // PUT until the operator reloads this page and checks canonical settings.
  const [contactUnconfirmed, setContactUnconfirmed] = useState(false);
  const [googleUnconfirmed, setGoogleUnconfirmed] = useState(false);

  const patchContact = patch => setContact(current => ({ ...current, ...patch }));

  const loadContact = async ({ announce = false } = {}) => {
    setContactBusy(true);
    setContactLoadError(false);
    setContactStatus(t("platform_contact.contact.status.loading"));
    setContactStatusType("success");
    try {
      const data = await loadPublicContact();
      setContact({ ...defaults, ...(data.exists && data.contact ? data.contact : {}) });
      setContactStatus(data.exists ? t("platform_contact.contact.status.loaded") : t("platform_contact.contact.status.empty"));
      if (announce) showToast(t("platform_contact.contact.toast.loaded"));
    } catch (error) {
      console.error("PLATFORM_CONTACT_LOAD_FAILED", error);
      setContactLoadError(true);
      setContactStatus(t("platform_contact.contact.status.load_failed"));
      setContactStatusType("error");
    } finally {
      setContactBusy(false);
      setInitialContactReady(true);
    }
  };

  const loadGoogle = async ({ announce = false } = {}) => {
    setGoogleBusy(true);
    setGoogleLoadError(false);
    setGoogleStorageReady(false);
    setGoogleStatus(t("platform_contact.google.status.loading"));
    setGoogleStatusType("success");
    try {
      const data = await loadGoogleCustomerLogin();
      setGoogle(data);
      setGoogleStorageReady(data.storageReady === true);
      setGoogleStatus(data.source === "database"
        ? t("platform_contact.google.status.loaded_database")
        : t("platform_contact.google.status.loaded_environment"));
      if (announce) showToast(t("platform_contact.google.toast.loaded"));
    } catch (error) {
      console.error("GOOGLE_CUSTOMER_LOGIN_LOAD_FAILED", error);
      setGoogleLoadError(true);
      setGoogleStatus(t("platform_contact.google.status.load_failed"));
      setGoogleStatusType("error");
    } finally {
      setGoogleBusy(false);
      setInitialGoogleReady(true);
    }
  };

  useEffect(() => {
    if (profile?.role !== "super_admin") return undefined;
    setInitialContactReady(false);
    setInitialGoogleReady(false);
    loadContact();
    loadGoogle();
    return undefined;
  }, [profile?.role, defaults]);

  const normalizedContact = () => ({
    enabled: contact.enabled === true,
    heading: String(contact.heading || "").trim() || defaults.heading,
    description: String(contact.description || "").trim(),
    phoneEnabled: contact.phoneEnabled === true,
    phoneLabel: String(contact.phoneLabel || "").trim() || defaults.phoneLabel,
    phoneNumber: normalizePhone(contact.phoneNumber),
    lineEnabled: contact.lineEnabled === true,
    lineLabel: String(contact.lineLabel || "").trim() || defaults.lineLabel,
    lineUrl: normalizeHttpUrl(contact.lineUrl),
    messengerEnabled: contact.messengerEnabled === true,
    messengerLabel: String(contact.messengerLabel || "").trim() || defaults.messengerLabel,
    messengerUrl: normalizeMessengerUrl(contact.messengerUrl),
    emailEnabled: contact.emailEnabled === true,
    emailLabel: String(contact.emailLabel || "").trim() || defaults.emailLabel,
    email: String(contact.email || "").trim().toLowerCase(),
  });

  const validateContact = data => {
    if (!data.heading) return t("platform_contact.contact.validation.heading_required");
    if (data.phoneEnabled && !data.phoneNumber) return t("platform_contact.contact.validation.phone_required");
    if (data.lineEnabled && !data.lineUrl) return t("platform_contact.contact.validation.line_required");
    if (data.messengerEnabled && !data.messengerUrl) return t("platform_contact.contact.validation.messenger_required");
    if (data.emailEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return t("platform_contact.contact.validation.email_required");
    const enabledChannels = [
      data.phoneEnabled && data.phoneNumber,
      data.lineEnabled && data.lineUrl,
      data.messengerEnabled && data.messengerUrl,
      data.emailEnabled && data.email,
    ].filter(Boolean).length;
    if (data.enabled && enabledChannels === 0) return t("platform_contact.contact.validation.channel_required");
    return "";
  };

  const submitContact = async event => {
    event.preventDefault();
    if (authState.status !== "ready" || profile?.role !== "super_admin" || contactBusy || contactLoadError || contactUnconfirmed) return;
    const data = normalizedContact();
    const error = validateContact(data);
    if (error) {
      setContactStatus(error);
      setContactStatusType("error");
      return;
    }
    setContactBusy(true);
    setContactSaving(true);
    setContactStatus(t("platform_contact.contact.status.saving"));
    try {
      const saved = await savePublicContact(data);
      setContact({ ...defaults, ...saved.contact });
      setContactStatus(t("platform_contact.contact.status.saved"));
      setContactStatusType("success");
      showToast(t("platform_contact.contact.toast.saved"));
    } catch (error) {
      console.error("PLATFORM_CONTACT_SAVE_FAILED", error);
      if (error?.message === "PLATFORM_CONTACT_WRITE_UNCONFIRMED") {
        setContactUnconfirmed(true);
        setContactStatus("ไม่สามารถยืนยันช่องทางติดต่อที่บันทึกใน Firebase ได้ กรุณารีโหลดหน้านี้เพื่อตรวจสอบข้อมูลก่อนบันทึกอีกครั้ง");
      } else {
        setContactStatus(t(error?.code === "permission-denied"
          ? "platform_contact.contact.errors.permission_denied"
          : "platform_contact.contact.errors.save_failed"));
      }
      setContactStatusType("error");
    } finally {
      setContactSaving(false);
      setContactBusy(false);
    }
  };

  const validateGoogle = value => {
    if (value.enabled && !String(value.clientId || "").trim()) return t("platform_contact.google.validation.client_required");
    if (value.clientId && !CLIENT_ID_PATTERN.test(String(value.clientId).trim())) return t("platform_contact.google.validation.client_invalid");
    const ttl = Number.parseInt(value.tokenTtlDays, 10);
    if (ttl < 1 || ttl > 90) return t("platform_contact.google.validation.ttl_invalid");
    return "";
  };

  const validateGoogleNow = () => {
    const error = validateGoogle(google);
    if (error) {
      setGoogleStatus(error);
      setGoogleStatusType("error");
      return;
    }
    setGoogleStatus(t("platform_contact.google.status.valid"));
    setGoogleStatusType("success");
    showToast(t("platform_contact.google.toast.validated"));
  };

  const submitGoogle = async event => {
    event.preventDefault();
    if (authState.status !== "ready" || profile?.role !== "super_admin" || googleBusy || !googleStorageReady || googleLoadError || googleUnconfirmed) return;
    const data = {
      enabled: google.enabled === true,
      clientId: String(google.clientId || "").trim(),
      tokenTtlDays: Math.max(1, Math.min(90, Number.parseInt(google.tokenTtlDays, 10) || 30)),
    };
    const error = validateGoogle(data);
    if (error) {
      setGoogleStatus(error);
      setGoogleStatusType("error");
      return;
    }
    setGoogleBusy(true);
    setGoogleSaving(true);
    setGoogleStatus(t("platform_contact.google.status.saving"));
    try {
      const saved = await saveGoogleCustomerLogin(data);
      setGoogle(saved);
      setGoogleStorageReady(saved.storageReady === true);
      setGoogleStatus(t("platform_contact.google.status.saved"));
      setGoogleStatusType("success");
      showToast(t("platform_contact.google.toast.saved"));
    } catch (error) {
      console.error("GOOGLE_CUSTOMER_LOGIN_SAVE_FAILED", error);
      if (error?.message === "GOOGLE_LOGIN_WRITE_UNCONFIRMED") {
        setGoogleUnconfirmed(true);
        setGoogleStatus("ไม่สามารถยืนยันค่า Google Customer Login ที่บันทึกใน Firebase ได้ กรุณารีโหลดหน้านี้เพื่อตรวจสอบก่อนบันทึกอีกครั้ง");
      } else {
        setGoogleStatus(t("platform_contact.google.errors.save_failed"));
      }
      setGoogleStatusType("error");
    } finally {
      setGoogleSaving(false);
      setGoogleBusy(false);
    }
  };

  const previewContact = normalizedContact();
  const previewActions = [
    previewContact.phoneEnabled && previewContact.phoneNumber ? { channel: "phone", icon: "telephone-fill", label: previewContact.phoneLabel, href: `tel:${previewContact.phoneNumber}` } : null,
    previewContact.lineEnabled && previewContact.lineUrl ? { channel: "line", icon: "line", label: previewContact.lineLabel, href: previewContact.lineUrl } : null,
    previewContact.messengerEnabled && previewContact.messengerUrl ? { channel: "messenger", icon: "messenger", label: previewContact.messengerLabel, href: previewContact.messengerUrl } : null,
    previewContact.emailEnabled && previewContact.email ? { channel: "email", icon: "envelope-fill", label: previewContact.emailLabel, href: `mailto:${previewContact.email}` } : null,
  ].filter(Boolean);
  const initialReady = initialContactReady && initialGoogleReady;
  const googleReady = google.enabled === true && CLIENT_ID_PATTERN.test(String(google.clientId || "").trim());
  const origins = [location.origin, "http://127.0.0.1:8000", "http://localhost:8000"].filter((value, index, list) => list.indexOf(value) === index);

  if (authState.status === "loading" || !stylesReady || (profile?.role === "super_admin" && !initialReady)) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} />;
  }
  if (authState.status !== "ready") return <main role="alert" data-platform-contact-auth-error>ตรวจสอบสิทธิ์กับ PENGUIN ไม่สำเร็จ</main>;
  if (!profile) return <Navigate to="/login?next=%2Fplatform%2Fcontact" replace />;
  if (profile.role !== "super_admin") return <Navigate to="/" replace />;

  return (
    <>
      <header className="app-header super-admin-header">
        <div className="super-admin-header-leading">
          <div className="brand"><span className="brand-mark">PG</span><span>{t("platform_contact.header.title")}</span></div>
          <Link className="btn btn-sm super-admin-header-back" to="/platform"><i className="bi bi-arrow-left" aria-hidden="true"></i><span>{t("platform_contact.header.back")}</span></Link>
        </div>
        <div className="app-header-actions" data-header-actions>
          <LocaleSwitcher style={{ marginLeft: 0, marginRight: 0 }} />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main className="container platform-contact-shell">
        <section className="hero platform-contact-hero">
          <h1>{t("platform_contact.hero.title")}</h1>
          <p>{t("platform_contact.hero.description")}</p>
        </section>

        <div className="platform-contact-layout">
          <section className="card platform-contact-form-card platform-contact-toggle-host"
            data-expanded={expandedCards.public} aria-labelledby="platformContactPublicTitle">
            <ContactCornerToggle expanded={expandedCards.public} onToggle={() => toggleCard("public")}
              controls="platformContactPublicPanel" label="ข้อมูลที่แสดงต่อสาธารณะ" />
            <div className="section-title">
              <div className="platform-contact-heading-group">
                <span className="platform-contact-heading-icon platform-contact-heading-icon-public" aria-hidden="true"><i className="bi bi-chat-heart" /></span>
                <div className="platform-contact-heading-copy">
                  <h2 id="platformContactPublicTitle">{t("platform_contact.contact.section.title")}</h2>
                  <p>{t("platform_contact.contact.section.subtitle")}</p>
                </div>
              </div>
              <label className="platform-contact-master-toggle"><input id="contactEnabled" type="checkbox" checked={contact.enabled} onChange={e => patchContact({ enabled: e.target.checked })} /><span>{t("platform_contact.contact.section.master_toggle")}</span></label>
            </div>

            <div id="platformContactPublicPanel" className="platform-contact-collapsed-body" hidden={!expandedCards.public}>
            <form id="platformContactForm" className="platform-contact-form" noValidate onSubmit={submitContact}>
              <div className="grid grid-2">
                <div className="field">
                  <label htmlFor="contactHeading">{t("platform_contact.contact.fields.heading")}</label>
                  <input className="input" id="contactHeading" maxLength="80" required value={contact.heading} onChange={e => patchContact({ heading: e.target.value })} placeholder={t("platform_contact.contact.fields.heading_placeholder")} />
                </div>
                <div className="field">
                  <label htmlFor="contactDescription">{t("platform_contact.contact.fields.description")}</label>
                  <input className="input" id="contactDescription" maxLength="240" value={contact.description} onChange={e => patchContact({ description: e.target.value })} placeholder={t("platform_contact.contact.fields.description_placeholder")} />
                </div>
              </div>
              <div className="platform-contact-channel-grid">
                <ContactChannel channel="phone" icon="telephone-fill" title={t("platform_contact.contact.channels.phone")} enabled={contact.phoneEnabled} onEnabled={value => patchContact({ phoneEnabled: value })} label={contact.phoneLabel} onLabel={value => patchContact({ phoneLabel: value })} value={contact.phoneNumber} onValue={value => patchContact({ phoneNumber: value })} valueId="phoneNumber" valueLabel={t("platform_contact.contact.fields.phone_number")} placeholder={t("platform_contact.contact.fields.phone_placeholder")} type="tel" valueMaxLength={40} t={t} />
                <ContactChannel channel="line" icon="line" title={t("platform_contact.contact.channels.line")} enabled={contact.lineEnabled} onEnabled={value => patchContact({ lineEnabled: value })} label={contact.lineLabel} onLabel={value => patchContact({ lineLabel: value })} value={contact.lineUrl} onValue={value => patchContact({ lineUrl: value })} valueId="lineUrl" valueLabel={t("platform_contact.contact.fields.line_url")} placeholder="https://lin.ee/..." type="url" t={t} />
                <ContactChannel channel="messenger" icon="messenger" title={t("platform_contact.contact.channels.messenger")} enabled={contact.messengerEnabled} onEnabled={value => patchContact({ messengerEnabled: value })} label={contact.messengerLabel} onLabel={value => patchContact({ messengerLabel: value })} value={contact.messengerUrl} onValue={value => patchContact({ messengerUrl: value })} valueId="messengerUrl" valueLabel={t("platform_contact.contact.fields.messenger_url")} placeholder={t("platform_contact.contact.fields.messenger_placeholder")} help={t("platform_contact.contact.fields.messenger_help")} t={t} />
                <ContactChannel channel="email" icon="envelope-fill" title={t("platform_contact.contact.channels.email")} enabled={contact.emailEnabled} onEnabled={value => patchContact({ emailEnabled: value })} label={contact.emailLabel} onLabel={value => patchContact({ emailLabel: value })} value={contact.email} onValue={value => patchContact({ email: value })} valueId="contactEmail" valueLabel={t("platform_contact.contact.fields.email")} placeholder="support@example.com" type="email" t={t} />
              </div>

              <div className="platform-contact-form-status" id="contactFormStatus" data-type={contactStatusType} data-write-unconfirmed={contactUnconfirmed ? "true" : undefined} hidden={!contactStatus}>{contactStatus}</div>
              <div className="platform-contact-actions">
                <button className="btn" id="reloadContactButton" type="button" disabled={contactBusy} onClick={() => loadContact({ announce: true })}><i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span>{t("platform_contact.contact.actions.reload")}</span></button>
                <button className="btn btn-primary" id="saveContactButton" type="submit" disabled={contactBusy || contactLoadError || contactUnconfirmed}>{contactSaving ? <><span className="platform-contact-saving" aria-hidden="true"></span><span>{t("platform_contact.contact.status.saving")}</span></> : <><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform_contact.contact.actions.save")}</span></>}</button>
              </div>
            </form>
            </div>
          </section>

          <aside className="card platform-contact-preview-card" data-expanded={expandedCards.public}>
            <div className="section-title">
              <div className="platform-contact-heading-group">
                <span className="platform-contact-heading-icon platform-contact-heading-icon-preview" aria-hidden="true"><i className="bi bi-eye" /></span>
                <div className="platform-contact-heading-copy">
                  <h2>{t("platform_contact.contact.preview.title")}</h2>
                  <p>{t("platform_contact.contact.preview.subtitle")}</p>
                </div>
              </div>
            </div>
            <div className="platform-contact-preview-body" hidden={!expandedCards.public}>
            <section className="public-contact-card platform-contact-preview" id="contactPreview" hidden={contactLoadError || previewContact.enabled !== true}>
              <div className="public-contact-copy">
                <span className="public-contact-kicker"><i className="bi bi-chat-heart" aria-hidden="true"></i><span>{t("platform_contact.contact.preview.kicker")}</span></span>
                <h2 id="previewHeading">{previewContact.heading}</h2>
                <p id="previewDescription">{previewContact.description || t("platform_contact.contact.defaults.preview_description")}</p>
              </div>
              <nav className="public-contact-links" id="previewLinks" aria-label={t("platform_contact.contact.preview.aria_label")}>
                {previewActions.map(action => <PreviewAction key={action.channel} {...action} />)}
              </nav>
            </section>
            <p className="platform-contact-preview-note">{t("platform_contact.contact.preview.note")}</p>
            </div>
          </aside>
        </div>

        <div className="platform-google-login-layout">
          <section className="card platform-google-login-card platform-contact-toggle-host"
            data-expanded={expandedCards.google} aria-labelledby="platformContactGoogleTitle">
            <ContactCornerToggle expanded={expandedCards.google} onToggle={() => toggleCard("google")}
              controls="platformContactGooglePanel" label="Google Login สำหรับลูกค้า Delivery" />
            <div className="section-title">
              <div className="platform-google-login-title">
                <span className="platform-google-login-icon" aria-hidden="true"><i className="bi bi-google"></i></span>
                <div><h2 id="platformContactGoogleTitle">{t("platform_contact.google.title")}</h2><p>{t("platform_contact.google.subtitle")}</p></div>
              </div>
              <span className="platform-google-login-source" id="googleLoginSettingsSource" data-source={google.source}>
                {googleStatus === t("platform_contact.google.status.loading")
                  ? t("platform_contact.google.loading")
                  : t(google.source === "database" ? "platform_contact.google.source.database" : "platform_contact.google.source.environment")}
              </span>
            </div>

            <div id="platformContactGooglePanel" className="platform-contact-collapsed-body" hidden={!expandedCards.google}>
            {!googleStorageReady ? <p role="alert" data-google-storage-unavailable>{googleLoadError ? t("platform_contact.google.status.load_failed") : "ฐานข้อมูล Google Login ยังไม่พร้อม กรุณาตรวจสอบ Migration"}</p> : null}
            <form id="googleCustomerLoginForm" className="platform-google-login-form" noValidate onSubmit={submitGoogle}>
              <label className="platform-google-login-toggle">
                <span><strong>{t("platform_contact.google.toggle.title")}</strong><small>{t("platform_contact.google.toggle.help")}</small></span>
                <input id="googleCustomerLoginEnabled" type="checkbox" checked={google.enabled} onChange={e => setGoogle(current => ({ ...current, enabled: e.target.checked }))} />
              </label>

              <div className="platform-google-login-field-grid">
                <div className="field">
                  <label htmlFor="googleCustomerClientId">{t("platform_contact.google.fields.client_id")}</label>
                  <input className="input" id="googleCustomerClientId" maxLength="255" autoComplete="off" spellCheck="false" value={google.clientId} onChange={e => setGoogle(current => ({ ...current, clientId: e.target.value }))} placeholder="1234567890-xxxxxxxx.apps.googleusercontent.com" />
                  <small>{t("platform_contact.google.fields.client_id_help")}</small>
                </div>
                <div className="field">
                  <label htmlFor="googleCustomerTokenTtlDays">{t("platform_contact.google.fields.ttl")}</label>
                  <input className="input" id="googleCustomerTokenTtlDays" type="number" min="1" max="90" step="1" value={google.tokenTtlDays} onChange={e => setGoogle(current => ({ ...current, tokenTtlDays: e.target.value }))} />
                  <small>{t("platform_contact.google.fields.ttl_help")}</small>
                </div>
              </div>
              <div className="platform-google-login-privacy">
                <div className="is-stored"><strong>{t("platform_contact.google.privacy.stored_title")}</strong><span>{t("platform_contact.google.privacy.stored_description")}</span></div>
                <div className="is-not-stored"><strong>{t("platform_contact.google.privacy.not_stored_title")}</strong><span>{t("platform_contact.google.privacy.not_stored_description")}</span></div>
              </div>

              <div className="field">
                <label>{t("platform_contact.google.origins.label")}</label>
                <div className="platform-google-origins" id="googleAuthorizedOrigins">
                  {origins.map(origin => (
                    <div className="platform-google-origin" key={origin}>
                      <code>{origin}</code>
                      <button className="btn btn-sm" type="button" onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(origin);
                          showToast(t("platform_contact.google.origins.copied"));
                        } catch {
                          showToast(t("platform_contact.google.origins.copy_failed"), "error");
                        }
                      }}>
                        <i className="bi bi-clipboard" aria-hidden="true"></i><span>{t("platform_contact.google.origins.copy")}</span>
                      </button>
                    </div>
                  ))}
                </div>
                <small>{t("platform_contact.google.origins.help")}</small>
              </div>

              <div className="platform-contact-form-status" id="googleLoginSettingsStatus" data-type={googleStatusType} data-write-unconfirmed={googleUnconfirmed ? "true" : undefined} hidden={!googleStatus}>{googleStatus}</div>
              <div className="platform-google-login-actions">
                <button className="btn" id="reloadGoogleLoginSettings" type="button" disabled={googleBusy} onClick={() => loadGoogle({ announce: true })}><i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i><span>{t("platform_contact.google.actions.reload")}</span></button>
                <button className="btn" id="validateGoogleLoginSettings" type="button" disabled={googleBusy} onClick={validateGoogleNow}><i className="bi bi-shield-check" aria-hidden="true"></i><span>{t("platform_contact.google.actions.validate")}</span></button>
                <button className="btn btn-primary" id="saveGoogleLoginSettings" type="submit" disabled={googleBusy || googleLoadError || !googleStorageReady || googleUnconfirmed}>{googleSaving ? <><span className="platform-contact-saving" aria-hidden="true"></span><span>{t("platform_contact.google.status.saving")}</span></> : <><i className="bi bi-floppy" aria-hidden="true"></i><span>{t("platform_contact.google.actions.save")}</span></>}</button>
              </div>
            </form>
            </div>
          </section>

          <aside className="card platform-google-login-preview-card" data-expanded={expandedCards.google}>
            <div className="section-title">
              <div className="platform-contact-heading-group">
                <span className="platform-contact-heading-icon platform-contact-heading-icon-google-preview" aria-hidden="true"><i className="bi bi-person-check" /></span>
                <div className="platform-contact-heading-copy">
                  <h2>{t("platform_contact.google.preview.title")}</h2>
                  <p>{t("platform_contact.google.preview.subtitle")}</p>
                </div>
              </div>
            </div>
            <div className="platform-contact-preview-body" hidden={!expandedCards.google}>
            <div className="platform-google-login-preview">
              <strong>{t("platform_contact.google.preview.account_title")}</strong>
              <p className="menu-category">{t("platform_contact.google.preview.guest_description")}</p>
              <div className={`platform-google-preview-button${googleReady ? "" : " is-disabled"}`} id="googleLoginPreviewButton" aria-disabled={googleReady ? "false" : "true"}>
                <span className="platform-google-preview-g">G</span><span>{t("platform_contact.google.preview.sign_in")}</span>
              </div>
              <p className="platform-google-preview-status" id="googleLoginPreviewStatus" data-ready={googleReady ? "true" : "false"}>
                {t(googleReady ? "platform_contact.google.preview.ready" : google.enabled ? "platform_contact.google.preview.invalid" : "platform_contact.google.preview.disabled")}
              </p>
            </div>
            <p className="platform-google-warning">{t("platform_contact.google.preview.warning")}</p>
            </div>
          </aside>
        </div>

        <div className="platform-telegram-layout">
          <section className="card platform-telegram-settings-card platform-contact-telegram-toggle-host platform-contact-toggle-host"
            data-expanded={expandedCards.telegram} aria-labelledby="platformTelegramHeading">
            <ContactCornerToggle expanded={expandedCards.telegram} onToggle={() => toggleCard("telegram")}
              controls="platformContactTelegramPanel" label="การแจ้งเตือน Telegram" />
            <span className="platform-telegram-header-reload-slot" id="platformTelegramReloadSlot" />
            <div className="platform-telegram-settings-heading">
              <span className="platform-contact-heading-icon platform-contact-heading-icon-telegram" aria-hidden="true">
                <i className="bi bi-telegram" />
              </span>
              <div className="platform-contact-heading-copy">
                <h2 id="platformTelegramHeading">การแจ้งเตือนผ่าน Telegram</h2>
                <p>แจ้งเตือนผ่าน Bot ชั่วคราว พร้อมปุ่มเปิดรายการใน PENGUIN</p>
              </div>
            </div>
            <div id="platformContactTelegramPanel" className="platform-contact-collapsed-body" hidden={!expandedCards.telegram}>
              <TelegramSettingsPanel scope="platform" hideHeading reloadPortalId="platformTelegramReloadSlot" />
            </div>
          </section>
          <aside className="card platform-telegram-preview-card" aria-labelledby="platformTelegramPreviewHeading"
            data-expanded={expandedCards.telegram}>
            <div className="section-title">
              <div className="platform-contact-heading-group">
                <span className="platform-contact-heading-icon platform-contact-heading-icon-preview" aria-hidden="true">
                  <i className="bi bi-chat-square-text" />
                </span>
                <div className="platform-contact-heading-copy">
                  <h2 id="platformTelegramPreviewHeading">ตัวอย่างการแจ้งเตือน Telegram</h2>
                  <p>ตัวอย่างข้อความที่ระบบส่งผ่าน Bot</p>
                </div>
              </div>
            </div>
            <div className="platform-contact-preview-body" hidden={!expandedCards.telegram}>
            <div className="platform-telegram-demo" aria-label="ตัวอย่างข้อความ Telegram ไม่ใช่ข้อมูลจริง">
              <div className="platform-telegram-demo-day">17 พฤศจิกายน</div>
              <div className="platform-telegram-demo-message">
                <div className="platform-telegram-demo-sender">
                  <span>penguin_notification_bot</span>
                  <span className="platform-telegram-demo-role">bot</span>
                </div>
                <div className="platform-telegram-demo-title">PENGUIN | แจ้งเตือนคำสั่งซื้อ Delivery</div>
                <div className="platform-telegram-demo-lines">
                  <div>ร้าน: ร้านค้าตัวอย่าง</div>
                  <div>ชื่อร้านในระบบ: Demo Store</div>
                  <div>รหัสร้าน: demo-store</div>
                  <div>จำนวน: 44.50 บาท</div>
                  <div>สถานะ: รับชำระเงินแล้ว</div>
                  <div>เลขที่บิล: B261117-00021</div>
                  <div>ดูรายละเอียดในระบบ PENGUIN</div>
                </div>
                <div className="platform-telegram-demo-time">13:30</div>
              </div>
              <div className="platform-telegram-demo-action" aria-hidden="true">
                <span>เปิดดูรายการใน PENGUIN</span><i className="bi bi-box-arrow-up-right" />
              </div>
            </div>
            <p className="platform-telegram-demo-note"><i className="bi bi-info-circle" aria-hidden="true" />
              ข้อมูลและยอดเงินเป็นเพียงตัวอย่าง ไม่ใช่การแจ้งเตือนจริง</p>
            </div>
          </aside>
        </div>

        <div className="platform-lk-shop-layout">
          <section className="card platform-lk-shop-settings-card platform-contact-toggle-host"
            data-expanded={expandedCards.lkShop} aria-labelledby="platformLKShopHeading">
            <ContactCornerToggle expanded={expandedCards.lkShop} onToggle={() => toggleCard("lkShop")}
              controls="platformContactLKShopPanel" label="การแจ้งเตือน LK Shop" />
            <div className="section-title">
              <div className="platform-contact-heading-group">
                <span className="platform-contact-heading-icon platform-contact-heading-icon-lk-shop" aria-hidden="true">
                  <i className="bi bi-shop" />
                </span>
                <div className="platform-contact-heading-copy">
                  <h2 id="platformLKShopHeading">การแจ้งเตือนผ่าน LK Shop</h2>
                  <p>เลือกห้องและจับคู่อุปกรณ์เพื่อรับการแจ้งเตือนของระบบ</p>
                </div>
              </div>
            </div>
            <div id="platformContactLKShopPanel" className="platform-contact-collapsed-body"
              hidden={!expandedCards.lkShop}>
              {expandedCards.lkShop && <LKShopPairingPanel scope="platform" embedded notify={showToast} />}
            </div>
          </section>

          <aside className="card platform-lk-shop-preview-card"
            aria-labelledby="platformLKShopPreviewHeading" data-expanded={expandedCards.lkShop}>
            <div className="section-title">
              <div className="platform-contact-heading-group">
                <span className="platform-contact-heading-icon platform-contact-heading-icon-preview" aria-hidden="true">
                  <i className="bi bi-bell" />
                </span>
                <div className="platform-contact-heading-copy">
                  <h2 id="platformLKShopPreviewHeading">ตัวอย่างการแจ้งเตือน LK Shop</h2>
                  <p>ตัวอย่างข้อความแจ้งเตือนที่แสดงในแอป</p>
                </div>
              </div>
            </div>
            <div className="platform-contact-preview-body" hidden={!expandedCards.lkShop}>
              <div className="platform-lk-shop-demo" aria-label="ตัวอย่างการแจ้งเตือน LK Shop ไม่ใช่ข้อมูลจริง">
                <div className="platform-lk-shop-demo-header">
                  <span className="platform-lk-shop-demo-app-icon" aria-hidden="true"><i className="bi bi-shop" /></span>
                  <span className="platform-lk-shop-demo-app-name">LK Shop</span>
                  <span className="platform-lk-shop-demo-time">ตอนนี้</span>
                </div>
                <div className="platform-lk-shop-demo-message">
                  <span className="platform-lk-shop-demo-room"><i className="bi bi-shield-check" aria-hidden="true" /> ห้องแจ้งเตือนส่วนกลาง</span>
                  <strong>มีรายการรอตรวจสอบการชำระเงิน</strong>
                  <p>มีหลักฐานการโอนเงินรอให้ Super Admin ตรวจสอบในระบบ PENGUIN</p>
                  <div className="platform-lk-shop-demo-reference">เลขที่บิล: B261117-00021</div>
                </div>
                <div className="platform-lk-shop-demo-action" aria-hidden="true">
                  <i className="bi bi-box-arrow-up-right" /> เปิดดูรายละเอียดใน PENGUIN
                </div>
              </div>
              <p className="platform-telegram-demo-note">
                <i className="bi bi-info-circle" aria-hidden="true" />
                ข้อความเป็นตัวอย่างเท่านั้น ไม่ใช่การแจ้งเตือนจริง
              </p>
            </div>
          </aside>
        </div>
      </main>

      <ParityFooter />
    </>
  );
}
