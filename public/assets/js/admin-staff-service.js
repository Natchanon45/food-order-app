import { auth, db, functions, collection, doc, getDoc, getDocs, httpsCallable } from './firebase-config.js?v=20260630-073';
import { resolveTenantContext } from './tenant-context.js';

const STAFF_ROLES = new Set(['admin', 'cashier', 'kitchen']);
const BUSINESS_SCOPES = new Set(['order_delivery', 'retail_pos', 'both']);
const POS_SCOPE_VALUES = new Set(['pos', 'retail', 'retail_pos', 'retail-pos', 'retail_pos_staff']);
const RESTAURANT_SCOPE_VALUES = new Set(['restaurant', 'order_delivery', 'order-delivery']);

function rawRole(data = {}) {
  return String(data.role || '').trim().toLowerCase();
}

function isRestaurantScoped(row = {}) {
  const values = [row.staffScope, row.scope, row.source, row.system, row.userType, row.appType]
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  return values.some(value => RESTAURANT_SCOPE_VALUES.has(value));
}

function isPosScoped(row = {}) {
  const values = [row.staffScope, row.scope, row.source, row.system, row.userType, row.appType]
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  if (values.some(value => POS_SCOPE_VALUES.has(value))) return true;
  if (isRestaurantScoped(row)) return false;

  const role = rawRole(row);
  const roleId = String(row.roleId || '').trim().toLowerCase();
  const displayName = String(row.displayName || row.name || '').trim().toLowerCase();
  const email = String(row.email || '').trim().toLowerCase();
  const hasLocalPosLogin = Boolean(row.username || row.passwordHash || row.passwordSalt);
  const idLooksLocalPos = String(row.uid || row.id || row.userId || '').startsWith('user-');
  const looksNamedPosUser = /^cashier\d+$/i.test(displayName) || /^pos[-_ ]?cashier/i.test(displayName) || email.includes('.pos') || email.includes('+pos');
  return hasLocalPosLogin || idLooksLocalPos || looksNamedPosUser || (roleId && roleId === role && ['stock', 'manager'].includes(roleId));
}

function staffOnly(row) {
  return STAFF_ROLES.has(rawRole(row));
}

function normalizeBusinessScope(data = {}) {
  const requested = String(data.businessScope || data.business_scope || '').trim().toLowerCase();
  if (BUSINESS_SCOPES.has(requested)) return requested;
  const unit = String(data.businessUnit || data.business_unit || '').trim().toLowerCase();
  if (unit === 'retail_pos') return 'retail_pos';
  if (unit === 'all' || unit === 'both') return 'both';
  return 'order_delivery';
}

function normalizeUser(uid, data = {}) {
  return {
    uid: uid || data.uid || data.userId || '',
    displayName: data.displayName || data.name || '',
    email: data.email || '',
    role: rawRole(data),
    roleId: data.roleId || '',
    businessScope: normalizeBusinessScope(data),
    active: data.active !== false,
    tenantId: data.tenantId || '',
    tenantSlug: data.tenantSlug || '',
    staffScope: data.staffScope || data.scope || '',
    source: data.source || data.system || data.userType || data.appType || ''
  };
}

async function currentProfile() {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('AUTH_REQUIRED');
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) throw new Error('PROFILE_NOT_FOUND');
  return { uid, ...snapshot.data() };
}

async function currentTenant() {
  try { return resolveTenantContext(); }
  catch {
    const profile = await currentProfile();
    if (!profile.tenantId) throw new Error('TENANT_ID_REQUIRED');
    return { id: profile.tenantId, slug: profile.tenantSlug || '', name: profile.tenantName || '' };
  }
}

async function callStaffFunction(name, payload = {}) {
  if (!functions) throw new Error('FUNCTIONS_NOT_READY');
  const fn = httpsCallable(functions, name);
  const response = await fn(payload);
  return response.data;
}

export async function listStaffUsers() {
  const tenant = await currentTenant();
  try {
    const data = await callStaffFunction('listTenantStaff', { tenantId: tenant.id, tenantSlug: tenant.slug });
    const rows = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
    return rows.filter(staffOnly).map(row => normalizeUser(row.uid || row.id, { ...row, tenantId: row.tenantId || tenant.id, tenantSlug: row.tenantSlug || tenant.slug })).sort((a, b) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email), 'th'));
  } catch (error) {
    console.warn('LIST_STAFF_CALLABLE_FALLBACK', error);
    const snapshot = await getDocs(collection(db, 'tenants', tenant.id, 'memberships'));
    return snapshot.docs.filter(item => staffOnly(item.data())).map(item => normalizeUser(item.id, { ...item.data(), tenantId: tenant.id, tenantSlug: tenant.slug })).sort((a, b) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email), 'th'));
  }
}

export async function createStaffUser(payload = {}) {
  const tenant = await currentTenant();
  return callStaffFunction('createTenantStaff', { ...payload, businessScope: payload.businessScope || 'order_delivery', staffScope: 'restaurant', tenantId: tenant.id, tenantSlug: tenant.slug });
}

export async function updateStaffUser(uid, patch = {}) {
  const tenant = await currentTenant();
  return callStaffFunction('updateTenantStaff', { uid, userId: uid, tenantId: tenant.id, tenantSlug: tenant.slug, ...patch });
}