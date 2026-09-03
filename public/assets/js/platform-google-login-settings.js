import { apiRequest } from './platform-contact-firebase-api.js?v=20260903-214';
import { toast } from './ui.js?v=20260805-081';
import { t } from './i18n.js?v=20260812-099';

const form = document.getElementById('googleCustomerLoginForm');
const enabledField = document.getElementById('googleCustomerLoginEnabled');
const clientIdField = document.getElementById('googleCustomerClientId');
const ttlField = document.getElementById('googleCustomerTokenTtlDays');
const sourceBadge = document.getElementById('googleLoginSettingsSource');
const statusBox = document.getElementById('googleLoginSettingsStatus');
const reloadButton = document.getElementById('reloadGoogleLoginSettings');
const validateButton = document.getElementById('validateGoogleLoginSettings');
const saveButton = document.getElementById('saveGoogleLoginSettings');
const originList = document.getElementById('googleAuthorizedOrigins');
const previewStatus = document.getElementById('googleLoginPreviewStatus');
const previewButton = document.getElementById('googleLoginPreviewButton');

const CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/;

function showStatus(message = '', type = 'success') {
  statusBox.textContent = message;
  statusBox.dataset.type = type;
  statusBox.hidden = !message;
}

function readForm() {
  return {
    enabled: enabledField.checked,
    clientId: clientIdField.value.trim(),
    tokenTtlDays: Math.max(
      1,
      Math.min(90, Number.parseInt(ttlField.value, 10) || 30),
    ),
  };
}

function validateSettings(data = readForm()) {
  if (data.enabled && !data.clientId) {
    return t('platform_contact.google.validation.client_required');
  }

  if (data.clientId && !CLIENT_ID_PATTERN.test(data.clientId)) {
    return t('platform_contact.google.validation.client_invalid');
  }

  if (data.tokenTtlDays < 1 || data.tokenTtlDays > 90) {
    return t('platform_contact.google.validation.ttl_invalid');
  }

  return '';
}

function renderPreview() {
  const data = readForm();
  const ready = data.enabled && CLIENT_ID_PATTERN.test(data.clientId);

  previewStatus.textContent = ready
    ? t('platform_contact.google.preview.ready')
    : data.enabled
      ? t('platform_contact.google.preview.invalid')
      : t('platform_contact.google.preview.disabled');
  previewStatus.dataset.ready = ready ? 'true' : 'false';
  previewButton.classList.toggle('is-disabled', !ready);
  previewButton.setAttribute('aria-disabled', ready ? 'false' : 'true');
}

function writeSettings(settings = {}) {
  enabledField.checked = settings.enabled === true;
  clientIdField.value = settings.clientId || '';
  ttlField.value = String(settings.tokenTtlDays || 30);
  sourceBadge.textContent = settings.source === 'database'
    ? t('platform_contact.google.source.database')
    : t('platform_contact.google.source.environment');
  sourceBadge.dataset.source = settings.source || 'environment';
  renderPreview();
}

function renderOrigins() {
  const origins = [
    location.origin,
    'http://127.0.0.1:8000',
    'http://localhost:8000',
  ].filter((value, index, list) => list.indexOf(value) === index);

  originList.replaceChildren(...origins.map(origin => {
    const item = document.createElement('div');
    item.className = 'platform-google-origin';

    const code = document.createElement('code');
    code.textContent = origin;

    const button = document.createElement('button');
    button.className = 'btn btn-sm';
    button.type = 'button';
    button.innerHTML = `<i class="bi bi-clipboard" aria-hidden="true"></i><span>${t('platform_contact.google.origins.copy')}</span>`;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(origin);
        toast(t('platform_contact.google.origins.copied'));
      } catch {
        code.focus?.();
        toast(t('platform_contact.google.origins.copy_failed'), 'error');
      }
    });

    item.append(code, button);
    return item;
  }));
}

async function loadSettings({ announce = false } = {}) {
  reloadButton.disabled = true;
  saveButton.disabled = true;
  validateButton.disabled = true;
  showStatus(t('platform_contact.google.status.loading'));

  try {
    const payload = await apiRequest(
      `/api/platform/contact/google-login?ts=${Date.now()}`,
      { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
    );
    writeSettings(payload?.googleCustomerLogin || {});
    showStatus(
      payload?.googleCustomerLogin?.source === 'database'
        ? t('platform_contact.google.status.loaded_database')
        : t('platform_contact.google.status.loaded_environment'),
    );
    if (announce) toast(t('platform_contact.google.toast.loaded'));
  } catch (error) {
    console.error('[platform-google-login] load failed', error);
    showStatus(
      t('platform_contact.google.status.load_failed'),
      'error',
    );
  } finally {
    reloadButton.disabled = false;
    saveButton.disabled = false;
    validateButton.disabled = false;
  }
}

if (form) {
  renderOrigins();
  renderPreview();

  form.addEventListener('input', renderPreview);
  form.addEventListener('change', renderPreview);

  reloadButton.addEventListener('click', () => {
    loadSettings({ announce: true });
  });

  validateButton.addEventListener('click', () => {
    const error = validateSettings();
    if (error) {
      showStatus(error, 'error');
      return;
    }
    showStatus(t('platform_contact.google.status.valid'));
    toast(t('platform_contact.google.toast.validated'));
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const data = readForm();
    const error = validateSettings(data);
    if (error) {
      showStatus(error, 'error');
      return;
    }

    reloadButton.disabled = true;
    validateButton.disabled = true;
    saveButton.disabled = true;
    saveButton.innerHTML = `<span class="platform-contact-saving" aria-hidden="true"></span><span>${t('platform_contact.google.status.saving')}</span>`;
    showStatus(t('platform_contact.google.status.saving'));

    try {
      const payload = await apiRequest('/api/platform/contact/google-login', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      writeSettings(payload?.googleCustomerLogin || data);
      showStatus(t('platform_contact.google.status.saved'));
      toast(t('platform_contact.google.toast.saved'));
    } catch (requestError) {
      console.error('[platform-google-login] save failed', requestError);
      showStatus(
        requestError?.serverResponse?.message
          || t('platform_contact.google.errors.save_failed'),
        'error',
      );
    } finally {
      reloadButton.disabled = false;
      validateButton.disabled = false;
      saveButton.disabled = false;
      saveButton.innerHTML = `<i class="bi bi-floppy" aria-hidden="true"></i><span>${t('platform_contact.google.actions.save')}</span>`;
    }
  });

  loadSettings();
}
