import { apiRequest } from "./platform-contact-firebase-api.js?v=20260903-214";
import { toast } from "./ui.js?v=20260805-081";
import translations from "./platform-contact-translations.js?v=20260903-214";
import { configureI18n, applyTranslations, t } from "./i18n.js?v=20260903-202";

configureI18n(translations);
applyTranslations();
document.title = t("platform_contact.meta.title");

const form = document.getElementById("platformContactForm");
const enabledField = document.getElementById("contactEnabled");
const headingField = document.getElementById("contactHeading");
const descriptionField = document.getElementById("contactDescription");

const phoneEnabled = document.getElementById("phoneEnabled");
const phoneLabel = document.getElementById("phoneLabel");
const phoneNumber = document.getElementById("phoneNumber");
const lineEnabled = document.getElementById("lineEnabled");
const lineLabel = document.getElementById("lineLabel");
const lineUrl = document.getElementById("lineUrl");

const messengerEnabled = document.getElementById("messengerEnabled");
const messengerLabel = document.getElementById("messengerLabel");
const messengerUrl = document.getElementById("messengerUrl");
const emailEnabled = document.getElementById("emailEnabled");
const emailLabel = document.getElementById("emailLabel");
const emailField = document.getElementById("contactEmail");

const reloadButton = document.getElementById("reloadContactButton");
const saveButton = document.getElementById("saveContactButton");
const statusBox = document.getElementById("contactFormStatus");
const preview = document.getElementById("contactPreview");
const previewHeading = document.getElementById("previewHeading");
const previewDescription = document.getElementById("previewDescription");
const previewLinks = document.getElementById("previewLinks");

const defaults = {
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
};

function showStatus(message = "", type = "success") {
  statusBox.textContent = message;
  statusBox.dataset.type = type;
  statusBox.hidden = !message;
}

function normalizeHttpUrl(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function normalizeMessengerUrl(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";

  const fullUrl = normalizeHttpUrl(raw);
  if (fullUrl) return fullUrl;
  const username = raw
    .replace(/^@/, "")
    .replace(/^m\.me\//i, "")
    .replace(/^facebook\.com\//i, "")
    .replace(/^www\.facebook\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .trim();

  if (!/^[a-zA-Z0-9._-]{2,100}$/.test(username)) return "";
  return `https://m.me/${username}`;
}

function normalizePhone(value = "") {
  return String(value).replace(/[^\d+*#,;]/g, "");
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function createPreviewAction({ channel, icon, label, href }) {
  const link = document.createElement("a");
  link.className = "public-contact-action";
  link.dataset.channel = channel;
  link.href = href || "#";
  link.addEventListener("click", event => event.preventDefault());

  const iconWrap = document.createElement("span");
  iconWrap.className = "public-contact-action-icon";
  iconWrap.setAttribute("aria-hidden", "true");
  const iconNode = document.createElement("i");
  iconNode.className = `bi bi-${icon}`;
  iconWrap.appendChild(iconNode);

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  link.append(iconWrap, labelNode);
  return link;
}

function readForm() {
  return {
    enabled: enabledField.checked,
    heading: headingField.value.trim() || defaults.heading,
    description: descriptionField.value.trim(),
    phoneEnabled: phoneEnabled.checked,
    phoneLabel: phoneLabel.value.trim() || defaults.phoneLabel,
    phoneNumber: normalizePhone(phoneNumber.value),
    lineEnabled: lineEnabled.checked,
    lineLabel: lineLabel.value.trim() || defaults.lineLabel,
    lineUrl: normalizeHttpUrl(lineUrl.value),
    messengerEnabled: messengerEnabled.checked,
    messengerLabel: messengerLabel.value.trim() || defaults.messengerLabel,
    messengerUrl: normalizeMessengerUrl(messengerUrl.value),
    emailEnabled: emailEnabled.checked,
    emailLabel: emailLabel.value.trim() || defaults.emailLabel,
    email: normalizeEmail(emailField.value),
  };
}

function writeForm(data = {}) {
  const value = { ...defaults, ...data };

  enabledField.checked = value.enabled === true;
  headingField.value = value.heading || defaults.heading;
  descriptionField.value = value.description || defaults.description;

  phoneEnabled.checked = value.phoneEnabled === true;
  phoneLabel.value = value.phoneLabel || defaults.phoneLabel;
  phoneNumber.value = value.phoneNumber || "";
  lineEnabled.checked = value.lineEnabled === true;
  lineLabel.value = value.lineLabel || defaults.lineLabel;
  lineUrl.value = value.lineUrl || "";

  messengerEnabled.checked = value.messengerEnabled === true;
  messengerLabel.value = value.messengerLabel || defaults.messengerLabel;
  messengerUrl.value = value.messengerUrl || "";

  emailEnabled.checked = value.emailEnabled === true;
  emailLabel.value = value.emailLabel || defaults.emailLabel;
  emailField.value = value.email || "";
  renderPreview();
}

function renderPreview() {
  const data = readForm();
  preview.hidden = data.enabled !== true;
  previewHeading.textContent = data.heading;
  previewDescription.textContent =
    data.description || t("platform_contact.contact.defaults.preview_description");

  previewLinks.replaceChildren();

  const actions = [];
  if (data.phoneEnabled && data.phoneNumber) {
    actions.push(createPreviewAction({
      channel: "phone",
      icon: "telephone-fill",
      label: data.phoneLabel,
      href: `tel:${data.phoneNumber}`,
    }));
  }

  if (data.lineEnabled && data.lineUrl) {
    actions.push(createPreviewAction({
      channel: "line",
      icon: "line",
      label: data.lineLabel,
      href: data.lineUrl,
    }));
  }

  if (data.messengerEnabled && data.messengerUrl) {
    actions.push(createPreviewAction({
      channel: "messenger",
      icon: "messenger",
      label: data.messengerLabel,
      href: data.messengerUrl,
    }));
  }

  if (data.emailEnabled && data.email) {
    actions.push(createPreviewAction({
      channel: "email",
      icon: "envelope-fill",
      label: data.emailLabel,
      href: `mailto:${data.email}`,
    }));
  }

  previewLinks.append(...actions);
}

function validateData(data) {
  if (!data.heading) return t("platform_contact.contact.validation.heading_required");

  if (data.phoneEnabled && !data.phoneNumber) {
    return t("platform_contact.contact.validation.phone_required");
  }

  if (data.lineEnabled && !data.lineUrl) {
    return t("platform_contact.contact.validation.line_required");
  }

  if (data.messengerEnabled && !data.messengerUrl) {
    return t("platform_contact.contact.validation.messenger_required");
  }

  if (
    data.emailEnabled
    && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
  ) {
    return t("platform_contact.contact.validation.email_required");
  }

  const enabledChannels = [
    data.phoneEnabled && data.phoneNumber,
    data.lineEnabled && data.lineUrl,
    data.messengerEnabled && data.messengerUrl,
    data.emailEnabled && data.email,
  ].filter(Boolean).length;

  if (data.enabled && enabledChannels === 0) {
    return t("platform_contact.contact.validation.channel_required");
  }

  return "";
}

async function loadSettings({ announce = false } = {}) {
  reloadButton.disabled = true;
  saveButton.disabled = true;
  showStatus(t("platform_contact.contact.status.loading"));

  try {
    const payload = await apiRequest(`/api/platform/contact?ts=${Date.now()}`, {
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    writeForm(payload?.exists && payload?.contact ? payload.contact : defaults);
    showStatus(
      payload?.exists
        ? t("platform_contact.contact.status.loaded")
        : t("platform_contact.contact.status.empty"),
    );
    if (announce) toast(t("platform_contact.contact.toast.loaded"));
  } catch (error) {
    console.error("[platform-contact] load failed", error);
    showStatus(
      t("platform_contact.contact.status.load_failed"),
      "error",
    );
  } finally {
    reloadButton.disabled = false;
    saveButton.disabled = false;
  }
}

if (form && reloadButton && saveButton) {
  form.addEventListener("input", renderPreview);
  form.addEventListener("change", renderPreview);

  reloadButton.addEventListener("click", () => {
    loadSettings({ announce: true });
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const data = readForm();
    const validationError = validateData(data);

    if (validationError) {
      showStatus(validationError, "error");
      return;
    }

    saveButton.disabled = true;
    reloadButton.disabled = true;
    saveButton.innerHTML =
      '<span class="platform-contact-saving" aria-hidden="true"></span>'
      + `<span>${t("platform_contact.contact.status.saving")}</span>`;
    showStatus(t("platform_contact.contact.status.saving"));

    try {
      await apiRequest("/api/platform/contact", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      showStatus(t("platform_contact.contact.status.saved"));
      toast(t("platform_contact.contact.toast.saved"));
    } catch (error) {
      console.error("[platform-contact] save failed", error);
      const validationMessage = error?.serverResponse?.message;
      showStatus(
        error?.status === 403
          ? t("platform_contact.contact.errors.permission_denied")
          : (validationMessage || t("platform_contact.contact.errors.save_failed")),
        "error",
      );
    } finally {
      saveButton.disabled = false;
      reloadButton.disabled = false;
      saveButton.innerHTML =
        '<i class="bi bi-floppy" aria-hidden="true"></i>'
        + `<span>${t("platform_contact.contact.actions.save")}</span>`;
    }
  });

  loadSettings();
}
