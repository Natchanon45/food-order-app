import "./public-page-static-i18n.js?v=20260903-231";

// DELIVERY_GOOGLE_NORMAL_BUTTON_20260805_098
// DELIVERY_CURRENT_LOCATION_ADDRESS_FLOW_20260827_001
import {
  watchCustomerAuth,
  loginCustomerWithGoogle,
  logoutCustomer,
  getCustomerProfile,
  saveCustomerProfile,
  isCustomerAccountAvailable,
} from './customer-profile-service.js?v=20260903-201';
import { toast } from './ui.js?v=20260903-231';
import { t } from './i18n.js?v=20260903-202';

const phoneInput = document.querySelector('#recipientPhone');
const nameInput = document.querySelector('#recipientName');
const addressInput = document.querySelector('#deliveryAddress');
const addressBook = document.querySelector('#addressBook');
const addressList = document.querySelector('#addressList');
const addressCount = document.querySelector('#addressCount');
const lookupStatus = document.querySelector('#addressLookupStatus');
const addAddressButton = document.querySelector('#addAddressButton');
const addressForm = document.querySelector('#addressForm');
const addressLabel = document.querySelector('#addressLabel');
const addressRecipient = document.querySelector('#addressRecipient');
const addressText = document.querySelector('#addressText');
const addressDefault = document.querySelector('#addressDefault');
const saveAddressButton = document.querySelector('#saveAddressButton');
const cancelAddressButton = document.querySelector('#cancelAddressButton');
const submitOrderButton = document.querySelector('#submitOrder');
const googleLoginButton = document.querySelector('#googleLoginButton');
const customerLogoutButton = document.querySelector('#customerLogoutButton');
const customerAccount = document.querySelector('#customerAccount');
const customerAccountName = document.querySelector('#customerAccountName');
const customerModeText = document.querySelector('#customerModeText');

let currentUser = null;
let currentStaff = null;
let currentProfile = { displayName: '', phone: '', addresses: [] };
let selectedAddressId = '';
let editingAddressId = '';
let bypassSubmitCapture = false;

function currentDeliveryLocation() {
  return window.deliveryLocation?.get?.() || null;
}

function preferredSavedAddress(addresses = []) {
  return addresses.find(item => item.isDefault) || addresses[0] || null;
}

function setDeliveryLocationFromAddress(address) {
  if (
    address?.latitude !== null
    && address?.latitude !== undefined
    && address?.longitude !== null
    && address?.longitude !== undefined
  ) {
    window.deliveryLocation?.set?.(
      address.latitude,
      address.longitude,
      { source: 'saved-address' },
    );
    return;
  }

  window.deliveryLocation?.clear?.({
    source: 'saved-address',
  });
}

function clearSelectedAddressForLocationOverride() {
  if (!selectedAddressId) return;

  const selected = currentProfile.addresses.find(
    item => item.id === selectedAddressId,
  );

  if (
    selected
    && addressInput.value.trim() === String(selected.address || '').trim()
  ) {
    /*
     * The coordinates are no longer the saved address coordinates. Clear the
     * saved address text as well so an order cannot accidentally combine a
     * new GPS pin with an old delivery-address label.
     */
    addressInput.value = '';
  }

  selectedAddressId = '';
  renderAddressBook();
}

async function fallbackToSavedAddressIfCurrentLocationUnavailable(addresses = []) {
  const initialCurrentLocation =
    window.deliveryLocation?.initialCurrentLocation;

  if (initialCurrentLocation?.then) {
    try {
      await initialCurrentLocation;
    } catch (error) {
      console.warn(
        '[delivery-addresses] initial current location failed',
        error,
      );
    }
  }

  /*
   * Current GPS (or a manual map choice made while GPS was resolving) always
   * wins. Saved default is only a fallback when no usable location exists.
   */
  if (currentDeliveryLocation() || selectedAddressId) return;

  const preferred = preferredSavedAddress(addresses);
  if (preferred) selectAddress(preferred.id);
}

async function askConfirm(message, options = {}) {
  if (typeof window.sweetConfirm === 'function') return window.sweetConfirm(message, options);
  return confirm(message);
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function newAddressId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = new Uint8Array(12);
  if (typeof cryptoApi?.getRandomValues === 'function') cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return `address-${Date.now()}-${[...bytes].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function renderAccount() {
  const signedIn = Boolean(currentUser);
  const accountAvailable = isCustomerAccountAvailable();
  const showGoogle = accountAvailable && !signedIn;

  currentStaff = null;
  googleLoginButton.hidden = !showGoogle;
  googleLoginButton.disabled = !showGoogle;
  customerLogoutButton.hidden = !signedIn;
  customerLogoutButton.textContent = t('delivery.checkout.customer.logout');
  customerAccount.hidden = !signedIn;
  customerAccountName.textContent = signedIn
    ? (currentUser.displayName || t('delivery.checkout.customer.google_account'))
    : '';

  customerModeText.textContent = signedIn
    ? t('delivery.checkout.customer.signed_in_mode')
    : t('delivery.checkout.customer.guest_mode');

}
function renderAddressBook() {
  const addresses = currentProfile.addresses || [];
  addressBook.hidden = false;
  addressCount.textContent = t('delivery.checkout.address.count', { count: addresses.length });
  addAddressButton.disabled = addresses.length >= 5;

  addressList.innerHTML = addresses.length ? addresses.map(address => `
    <label class="address-card${address.id === selectedAddressId ? ' selected' : ''}">
      <input type="radio" name="savedDeliveryAddress" value="${address.id}" ${address.id === selectedAddressId ? 'checked' : ''}>
      <div>
        <div class="address-card-title">
          ${address.label || t('delivery.checkout.address.fallback_label')}
          ${address.isDefault ? `<span class="address-default">${t('delivery.checkout.address.default_badge')}</span>` : ''}
        </div>
        <div class="address-card-text"><strong>${address.recipientName || currentProfile.displayName || ''}</strong>\n${address.address}</div>
      </div>
      <div class="address-card-actions">
        <button type="button" class="btn btn-sm" data-edit-address="${address.id}">${t('delivery.checkout.address.edit')}</button>
        ${address.isDefault ? '' : `<button type="button" class="btn btn-sm" data-default-address="${address.id}">${t('delivery.checkout.address.set_default')}</button>`}
        <button type="button" class="btn btn-danger btn-sm" data-delete-address="${address.id}">${t('delivery.checkout.address.delete')}</button>
      </div>
    </label>
  `).join('') : `<div class="empty" style="padding:20px 10px">${t('delivery.checkout.address.none_saved')}</div>`;
}

function selectAddress(id) {
  const address = currentProfile.addresses.find(item => item.id === id);
  if (!address) return;
  selectedAddressId = id;
  addressInput.value = address.address || '';
  if (address.recipientName) nameInput.value = address.recipientName;
  if (address.recipientPhone) phoneInput.value = address.recipientPhone;
  setDeliveryLocationFromAddress(address);
  renderAddressBook();
}

function openAddressForm(address = null) {
  editingAddressId = address?.id || '';
  addressLabel.value = address?.label || t('delivery.checkout.address.home_label');
  addressRecipient.value = address?.recipientName || nameInput.value.trim();
  addressText.value = address?.address || addressInput.value.trim();
  addressDefault.checked = address ? Boolean(address.isDefault) : currentProfile.addresses.length === 0;
  addressForm.hidden = false;
  addressText.focus();
}

function closeAddressForm() {
  editingAddressId = '';
  addressForm.hidden = true;
  addressLabel.value = '';
  addressRecipient.value = '';
  addressText.value = '';
  addressDefault.checked = false;
}

async function persistProfile() {
  currentProfile = {
    ...currentProfile,
    displayName: nameInput.value.trim() || currentProfile.displayName || '',
    phone: normalizePhone(phoneInput.value),
  };
  currentProfile = await saveCustomerProfile(currentProfile, currentUser);
}

async function loadProfile() {
  lookupStatus.textContent = t('delivery.checkout.address.loading');
  try {
    currentProfile = await getCustomerProfile(currentUser);
    if (currentProfile.displayName) nameInput.value = currentProfile.displayName;
    if (currentProfile.phone) phoneInput.value = currentProfile.phone;

    const addresses = currentProfile.addresses || [];

    /*
     * A saved default address is an address-book preference, not the default
     * location for a new checkout. Start unselected and keep the device GPS
     * location until the customer explicitly chooses a saved address.
     */
    selectedAddressId = '';
    addressInput.value = '';

    lookupStatus.textContent = addresses.length
      ? t('delivery.checkout.address.found', { count: addresses.length })
      : t('delivery.checkout.address.none_for_store');

    renderAddressBook();

    await fallbackToSavedAddressIfCurrentLocationUnavailable(addresses);
  } catch (error) {
    console.error(error);
    currentProfile = { displayName: '', phone: '', addresses: [] };
    selectedAddressId = '';
    lookupStatus.textContent = t('delivery.checkout.address.load_failed');
    renderAddressBook();
  }
}

function setGoogleButtonBusy(busy) {
  googleLoginButton.disabled = busy;
  const label = googleLoginButton.querySelector('span');
  if (label) {
    label.textContent = busy
      ? t('delivery.checkout.customer.google_login_busy')
      : t('delivery.checkout.customer.google_login');
  }
}

googleLoginButton.addEventListener('click', async () => {
  if (googleLoginButton.disabled) return;

  setGoogleButtonBusy(true);
  try {
    await loginCustomerWithGoogle();
  } catch (error) {
    console.error('[delivery-addresses] Google login failed', error);
    const messages = {
      popup_failed_to_open: t('delivery.checkout.customer.google_errors.popup_failed_to_open'),
      popup_closed: t('delivery.checkout.customer.google_errors.popup_closed'),
      GOOGLE_LOGIN_NOT_READY: t('delivery.checkout.customer.google_errors.not_ready'),
      GOOGLE_LOGIN_ALREADY_OPEN: t('delivery.checkout.customer.google_errors.already_open'),
      GOOGLE_ACCESS_TOKEN_INVALID: t('delivery.checkout.customer.google_errors.invalid_token'),
    };
    const code = error?.code || error?.message || '';
    toast(messages[code] || t('delivery.checkout.customer.google_login_failed'), 'error');
  } finally {
    setGoogleButtonBusy(false);
  }
});

customerLogoutButton.addEventListener('click', async () => {
  await logoutCustomer();
  toast(t('delivery.checkout.customer.logout_done'));
});

addAddressButton.addEventListener('click', () => {
  if (currentProfile.addresses.length >= 5) {
    toast(t('delivery.checkout.address.max_five'), 'error');
    return;
  }
  openAddressForm();
});

cancelAddressButton.addEventListener('click', closeAddressForm);

saveAddressButton.addEventListener('click', async () => {
  const label = addressLabel.value.trim();
  const recipientName = addressRecipient.value.trim();
  const recipientPhone = normalizePhone(phoneInput.value);
  const address = addressText.value.trim();
  const location = currentDeliveryLocation();

  if (!label || !recipientName || !address) {
    toast(t('delivery.checkout.address.required_fields'), 'error');
    return;
  }

  if (!location) {
    toast(t('delivery.checkout.validation.delivery_location_required'), 'error');
    document.querySelector('#deliveryLocationMap')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    return;
  }

  let addresses = [...(currentProfile.addresses || [])];
  if (!editingAddressId && addresses.length >= 5) {
    toast(t('delivery.checkout.address.max_five'), 'error');
    return;
  }

  const wasEditing = Boolean(editingAddressId);
  const id = editingAddressId || newAddressId();
  const isDefault = addressDefault.checked || addresses.length === 0;
  if (isDefault) addresses = addresses.map(item => ({ ...item, isDefault: false }));

  const nextAddress = {
    id,
    label,
    recipientName,
    recipientPhone,
    address,
    latitude: location.latitude,
    longitude: location.longitude,
    isDefault,
  };
  const index = addresses.findIndex(item => item.id === id);
  if (index >= 0) addresses[index] = nextAddress;
  else addresses.push(nextAddress);

  currentProfile = { ...currentProfile, displayName: recipientName, addresses: addresses.slice(0, 5) };
  selectedAddressId = id;
  nameInput.value = recipientName;
  addressInput.value = address;

  try {
    await persistProfile();
    closeAddressForm();
    renderAddressBook();
    toast(wasEditing ? t('delivery.checkout.address.updated') : t('delivery.checkout.address.saved'));
  } catch (error) {
    console.error(error);
    toast(t('delivery.checkout.address.save_failed'), 'error');
  }
});

addressList.addEventListener('change', event => {
  const radio = event.target.closest('input[name="savedDeliveryAddress"]');
  if (radio) selectAddress(radio.value);
});

addressList.addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit-address]');
  if (editButton) {
    event.preventDefault();
    openAddressForm(currentProfile.addresses.find(item => item.id === editButton.dataset.editAddress));
    return;
  }

  const defaultButton = event.target.closest('[data-default-address]');
  if (defaultButton) {
    event.preventDefault();
    const id = defaultButton.dataset.defaultAddress;
    currentProfile.addresses = currentProfile.addresses.map(item => ({ ...item, isDefault: item.id === id }));
    selectedAddressId = id;
    await persistProfile();
    selectAddress(id);
    toast(t('delivery.checkout.address.set_default_done'));
    return;
  }

  const deleteButton = event.target.closest('[data-delete-address]');
  if (deleteButton) {
    event.preventDefault();
    const ok = await askConfirm(t('delivery.checkout.address.delete_prompt'), {
      title: t('delivery.checkout.address.delete_title'),
      confirmText: t('delivery.checkout.common.confirm'),
      cancelText: t('delivery.checkout.common.cancel'),
      type: 'warning',
    });
    if (!ok) return;
    const id = deleteButton.dataset.deleteAddress;
    currentProfile.addresses = currentProfile.addresses.filter(item => item.id !== id);
    if (currentProfile.addresses.length && !currentProfile.addresses.some(item => item.isDefault)) {
      currentProfile.addresses[0].isDefault = true;
    }
    selectedAddressId = currentProfile.addresses.find(item => item.isDefault)?.id || currentProfile.addresses[0]?.id || '';
    await persistProfile();
    if (selectedAddressId) selectAddress(selectedAddressId);
    else {
      addressInput.value = '';
      renderAddressBook();
    }
    toast(t('delivery.checkout.address.deleted'));
  }
});

/*
 * Returning to device GPS, clicking the map or dragging the marker means the
 * customer is no longer using the saved-address coordinates. Unselect the
 * radio card so the UI and the delivery-fee calculation describe one source.
 */
document.addEventListener('delivery-location-source-changed', event => {
  const source = String(event.detail?.source || '');

  if (
    source === 'current-location'
    || source === 'map'
    || source === 'manual'
  ) {
    clearSelectedAddressForLocationOverride();
  }
});

async function saveCurrentDeliveryAddress() {
  const recipientName = nameInput.value.trim();
  const recipientPhone = normalizePhone(phoneInput.value);
  const address = addressInput.value.trim();
  const location = currentDeliveryLocation();

  if (!recipientName || !address || !location) return;

  let addresses = [...(currentProfile.addresses || [])];
  const matched = addresses.find(item => item.address.trim() === address);

  if (matched) {
    addresses = addresses.map(item => item.id === matched.id ? {
      ...item,
      recipientName,
      recipientPhone,
      latitude: location.latitude,
      longitude: location.longitude,
    } : item);
  } else if (addresses.length < 5) {
    const id = newAddressId();

    addresses.push({
      id,
      label: t('delivery.checkout.address.latest_label'),
      recipientName,
      recipientPhone,
      address,
      latitude: location.latitude,
      longitude: location.longitude,
      isDefault: addresses.length === 0,
    });

    selectedAddressId = id;
  }
  currentProfile = { ...currentProfile, displayName: recipientName, addresses: addresses.slice(0, 5) };
  await persistProfile();
}

submitOrderButton.addEventListener('click', async event => {
  if (bypassSubmitCapture) {
    bypassSubmitCapture = false;
    return;
  }

  if (!nameInput.value.trim() || !addressInput.value.trim()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  submitOrderButton.disabled = true;
  const originalText = submitOrderButton.textContent;
  submitOrderButton.textContent = t('delivery.checkout.address.saving');

  try {
    await saveCurrentDeliveryAddress();
    bypassSubmitCapture = true;
    submitOrderButton.disabled = false;
    submitOrderButton.textContent = originalText;
    submitOrderButton.click();
  } catch (error) {
    console.error(error);
    submitOrderButton.disabled = false;
    submitOrderButton.textContent = originalText;
    toast(t('delivery.checkout.address.save_retry_failed'), 'error');
  }
}, true);

watchCustomerAuth(async (user, staff) => {
  currentUser = user;
  currentStaff = staff;
  renderAccount();
  await loadProfile();
});
