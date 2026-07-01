import { auth, db, functions, collection, doc, getDoc, getDocs, httpsCallable } from './firebase-config.js?v=20260630-073';
import { resolveTenantContext } from './tenant-context.js';

const STAFF_ROLES = new Set(['admin', 'cashier', 'kitchen']);

function normalizeUser(uid, data = {}) {
  return {
    uid: uid || data.uid || data.userId || '',
    displayName: data.displayName || data.name || '',
    email: data.email || '',
    role: STAFF_ROLES.has(data.role) ? data.role : 'cashier',
    active: data.active !== false,
    tenantId: data.tenantId || '',
    tenantSlug: data.tenantSlug || ''
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
    const data = await callStaffFunction('listStaffUsers', { tenantId: tenant.id, tenantSlug: tenant.slug });
    const rows = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
    return rows.map(row => normalizeUser(row.uid || row.id, { ...row, tenantId: row.tenantId || tenant.id, tenantSlug: row.tenantSlug || tenant.slug })).filter(row => STAFF_ROLES.has(row.role));
  } catch (error) {
    console.warn('LIST_STAFF_CALLABLE_FALLBACK', error);
    const snapshot = await getDocs(collection(db, 'tenants', tenant.id, 'memberships'));
    return snapshot.docs
      .map(item => normalizeUser(item.id, { ...item.data(), tenantId: tenant.id, tenantSlug: tenant.slug }))
      .filter(row => STAFF_ROLES.has(row.role))
      .sort((a, b) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email), 'th'));
  }
}

export async function createStaffUser(payload = {}) {
  const tenant = await currentTenant();
  return callStaffFunction('createStaffUser', { ...payload, tenantId: tenant.id, tenantSlug: tenant.slug });
}

export async function updateStaffUser(uid, patch = {}) {
  const tenant = await currentTenant();
  return callStaffFunction('updateStaffUser', { uid, userId: uid, tenantId: tenant.id, tenantSlug: tenant.slug, ...patch });
}
