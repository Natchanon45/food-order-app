import { auth, db, doc, isFirebaseConfigured, runTransaction, serverTimestamp } from './firebase-config.js?v=20260630-073';
import { deleteRecord, getRecord, getTenantId, listRecords, saveRecord } from './retail-db.js?v=20260629-032';
import { dateKeyFrom, monthKeyFrom } from './retail-pos-firestore-foundation.js?v=20260707-001';
import { reserveRunningNumber, POS_COUNTER_VERSION } from './retail-pos-counter.js?v=20260707-001';

const TAX_INVOICE_COLLECTION = 'taxInvoices';
const TAX_BUYER_PROFILE_COLLECTION = 'taxBuyerProfiles';
const TAX_INVOICE_LOCAL_KEY = 'retail_pos_tax_invoices_v1';
const TAX_BUYER_PROFILE_KEY = 'retail_pos_tax_buyer_profiles_v1';
const STORE_SETTINGS_KEY = 'retail_pos_store_settings_v1';
const LEGACY_STORE_SETTINGS_KEY = 'food_order_store_settings';
let pendingTaxInvoiceSyncPromise = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTaxId(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

function saleKey(sale = {}) {
  return String(sale.id || sale.saleNumber || '').trim();
}

function customerKey(sale = {}) {
  return String(sale.customerId || sale.customerCode || sale.customerPhone || sale.customerName || sale.customerDisplayName || '').trim();
}

function moneyNumber(value) {
  return Number(Number(value || 0).toFixed(2));
}

function syncErrorMessage(error) {
  return normalizeText(error?.message || error || 'SYNC_FAILED').slice(0, 180);
}

function taxVoidValidationError(message) {
  const error = new Error(message);
  error.code = 'TAX_VOID_VALIDATION_FAILED';
  return error;
}

function settings() {
  const legacy = readJson(LEGACY_STORE_SETTINGS_KEY, {});
  const local = readJson(STORE_SETTINGS_KEY, {});
  const merged = { ...legacy, ...local };
  return {
    sellerName: normalizeText(merged.taxInvoiceName || merged.shopName || merged.name || 'POS ร้านค้าปลีก'),
    sellerAddress: normalizeText(merged.taxInvoiceAddress || merged.shopAddress || merged.address || ''),
    sellerPhone: normalizeText(merged.shopPhone || merged.phone || ''),
    sellerTaxId: normalizeTaxId(merged.taxId || merged.shopTaxId || ''),
    sellerBranchType: String(merged.taxBranchType || 'headOffice') === 'branch' ? 'branch' : 'headOffice',
    sellerBranchCode: normalizeText(merged.taxBranchCode || ''),
    vatRate: Number.isFinite(Number(merged.vatRate)) ? Number(merged.vatRate) : 7
  };
}

function listLocalInvoices() {
  const rows = readJson(TAX_INVOICE_LOCAL_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function isDeletedBuyerProfile(profile = {}) {
  const status = String(profile.syncStatus || '');
  return Boolean(profile.deleted || status === 'pending_delete' || status === 'deleted');
}

function listBuyerProfileRows({ includeDeleted = false } = {}) {
  const rows = readJson(TAX_BUYER_PROFILE_KEY, []);
  const tenantId = getTenantId();
  return (Array.isArray(rows) ? rows : [])
    .filter(row => !row.tenantId || row.tenantId === tenantId)
    .filter(row => includeDeleted || !isDeletedBuyerProfile(row));
}

function listBuyerProfiles() {
  return listBuyerProfileRows();
}

function writeTenantBuyerProfiles(profiles) {
  const tenantId = getTenantId();
  const rows = readJson(TAX_BUYER_PROFILE_KEY, []);
  const kept = (Array.isArray(rows) ? rows : []).filter(row => row.tenantId && row.tenantId !== tenantId);
  writeJson(TAX_BUYER_PROFILE_KEY, [...kept, ...profiles]);
}

function buyerProfileKey(profile = {}) {
  return normalizeText(profile.id || profile.customerKey || profile.buyerTaxId || profile.buyerName);
}

function mergeBuyerProfiles(...groups) {
  const tenantId = getTenantId();
  const map = new Map();
  groups.flat().forEach(profile => {
    const key = buyerProfileKey(profile);
    if (!key) return;
    if (profile.tenantId && profile.tenantId !== tenantId) return;
    const deleted = isDeletedBuyerProfile(profile);
    const normalized = deleted
      ? {
          id: key,
          customerKey: normalizeText(profile.customerKey || key),
          tenantId,
          deleted: true,
          syncStatus: String(profile.syncStatus || 'pending_delete'),
          deletedAt: Number(profile.deletedAt || profile.updatedAt || Date.now()),
          updatedAt: Number(profile.updatedAt || profile.deletedAt || Date.now())
        }
      : { id: key, customerKey: normalizeText(profile.customerKey || key), tenantId, ...normalizeBuyer(profile), updatedAt: Number(profile.updatedAt || 0) || Date.now() };
    const existing = map.get(key);
    if (!existing || Number(normalized.updatedAt || 0) >= Number(existing.updatedAt || 0)) map.set(key, normalized);
  });
  return [...map.values()].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function existingInvoiceForSale(sale) {
  const key = saleKey(sale);
  if (!key) return null;
  return listLocalInvoices().find(row => invoiceMatchesSale(row, sale)) || null;
}

function invoiceMatchesSale(invoice = {}, sale = {}) {
  const saleId = String(sale.id || '').trim();
  const saleNumber = String(sale.saleNumber || sale.number || '').trim();
  const key = saleKey(sale);
  return Boolean(
    (key && [invoice.saleId, invoice.sourceSale?.id, invoice.sourceSale?.saleNumber].some(value => String(value || '').trim() === key))
    || (saleId && [invoice.saleId, invoice.sourceSale?.id].some(value => String(value || '').trim() === saleId))
    || (saleNumber && [invoice.saleNumber, invoice.sourceSale?.saleNumber].some(value => String(value || '').trim() === saleNumber))
  );
}

function saveLocalInvoice(invoice) {
  const rows = listLocalInvoices().filter(row => String(row.id) !== String(invoice.id));
  rows.push(invoice);
  writeJson(TAX_INVOICE_LOCAL_KEY, rows);
}

function saveBuyerProfile(sale, buyer) {
  const key = customerKey(sale);
  if (!key || !buyer?.buyerName) return;
  writeBuyerProfile({ id: key, customerKey: key, ...buyer });
}

function writeBuyerProfile(profile) {
  const normalized = normalizeBuyer(profile);
  const id = normalizeText(profile.id || profile.customerKey || normalized.buyerTaxId || normalized.buyerName);
  if (!id) throw new Error('ไม่พบรหัสโปรไฟล์ลูกค้า');
  if (!normalized.buyerName) throw new Error('กรุณาระบุชื่อลูกค้า / บริษัท');
  const tenantId = getTenantId();
  const row = { id, customerKey: normalizeText(profile.customerKey || id), tenantId, ...normalized, updatedAt: Date.now() };
  const rows = readJson(TAX_BUYER_PROFILE_KEY, []);
  const kept = (Array.isArray(rows) ? rows : []).filter(item => {
    const itemKey = String(item.id || item.customerKey || '').trim();
    return itemKey !== id || (item.tenantId && item.tenantId !== tenantId);
  });
  kept.push(row);
  writeJson(TAX_BUYER_PROFILE_KEY, kept);
  if (isFirebaseConfigured && db && navigator.onLine !== false) {
    saveRecord(TAX_BUYER_PROFILE_COLLECTION, row).catch(error => {
      console.warn('[retail-pos-full-tax-invoice] save tax buyer profile failed', error);
    });
  }
  return row;
}

function removeBuyerProfile(id) {
  const key = String(id || '').trim();
  if (!key) return false;
  const tenantId = getTenantId();
  const deletedAt = Date.now();
  const rows = readJson(TAX_BUYER_PROFILE_KEY, []);
  const kept = (Array.isArray(rows) ? rows : []).filter(row => {
    const rowKey = String(row.id || row.customerKey || '').trim();
    return rowKey !== key || (row.tenantId && row.tenantId !== tenantId);
  });
  kept.push({
    id: key,
    customerKey: key,
    tenantId,
    deleted: true,
    deletedAt,
    updatedAt: deletedAt,
    syncStatus: navigator.onLine === false ? 'pending_delete' : 'deleted'
  });
  writeJson(TAX_BUYER_PROFILE_KEY, kept);
  if (isFirebaseConfigured && db && navigator.onLine !== false) {
    deleteRecord(TAX_BUYER_PROFILE_COLLECTION, key).catch(error => {
      console.warn('[retail-pos-full-tax-invoice] delete tax buyer profile failed', error);
    });
  }
  return true;
}

function updateLocalInvoice(invoicePatch) {
  const key = String(invoicePatch.id || invoicePatch.invoiceNumber || invoicePatch._documentId || '').trim();
  if (!key) throw new Error('ไม่พบรหัสใบกำกับภาษี');
  const rows = listLocalInvoices();
  const index = rows.findIndex(row => [row.id, row.invoiceNumber, row._documentId].some(value => String(value || '') === key));
  if (index < 0) throw new Error('ไม่พบใบกำกับภาษี');
  const updated = { ...rows[index], ...invoicePatch, id: rows[index].id || invoicePatch.id || key, tenantId: rows[index].tenantId || getTenantId(), updatedAt: Date.now() };
  rows[index] = updated;
  writeJson(TAX_INVOICE_LOCAL_KEY, rows);
  return updated;
}

function markLocalInvoiceSyncError(invoice, error) {
  try {
    return updateLocalInvoice({
      id: invoice.id || invoice._documentId || invoice.invoiceNumber || '',
      invoiceNumber: invoice.invoiceNumber || '',
      syncError: syncErrorMessage(error),
      syncErrorAt: Date.now(),
      syncAttemptedAt: Date.now(),
      syncAttemptCount: Number(invoice.syncAttemptCount || 0) + 1
    });
  } catch (updateError) {
    console.warn('[retail-pos-full-tax-invoice] mark sync error failed', updateError);
    return null;
  }
}

function buyerProfileForSale(sale = {}) {
  const key = customerKey(sale);
  if (!key) return null;
  return listBuyerProfiles().find(row => String(row.id || row.customerKey) === key) || null;
}

function tenantDoc(collectionName, id, tenantId = getTenantId()) {
  return doc(db, 'tenants', tenantId, collectionName, String(id));
}

function nextLocalInvoiceNumber() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TAX-${ymd}-`;
  const max = listLocalInvoices()
    .map(row => String(row.invoiceNumber || ''))
    .filter(value => value.startsWith(prefix))
    .map(value => Number(value.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export function defaultBuyerFromSale(sale = {}) {
  const saved = buyerProfileForSale(sale) || {};
  return {
    buyerName: normalizeText(saved.buyerName || sale.taxBuyerName || sale.customerName || sale.customerDisplayName || ''),
    buyerTaxId: normalizeTaxId(saved.buyerTaxId || sale.taxBuyerTaxId || sale.customerTaxId || ''),
    buyerAddress: normalizeText(saved.buyerAddress || sale.taxBuyerAddress || sale.customerAddress || ''),
    buyerBranchName: normalizeText(saved.buyerBranchName || sale.taxBuyerBranchName || sale.customerBranchName || 'สำนักงานใหญ่') || 'สำนักงานใหญ่'
  };
}

function normalizeBuyer(buyer = {}) {
  return {
    buyerName: normalizeText(buyer.buyerName),
    buyerTaxId: normalizeTaxId(buyer.buyerTaxId),
    buyerAddress: normalizeText(buyer.buyerAddress),
    buyerBranchName: normalizeText(buyer.buyerBranchName || 'สำนักงานใหญ่') || 'สำนักงานใหญ่'
  };
}

function buildInvoiceFromSale(sale, buyer, options = {}) {
  const store = settings();
  const id = `tax-${saleKey(sale) || Date.now()}`;
  const issuedAt = options.issuedAt || Date.now();
  const dateKey = dateKeyFrom(issuedAt);
  const vatRate = Number.isFinite(Number(sale.vatRate)) ? Number(sale.vatRate) : store.vatRate;
  const total = moneyNumber(sale.totalAmount ?? sale.total);
  const vatAmount = moneyNumber(sale.vatAmount || 0);
  const beforeVat = moneyNumber(sale.beforeVat ?? sale.taxableBase ?? sale.discountedBase ?? (total - vatAmount));
  return {
    id,
    tenantId: getTenantId(),
    saleId: saleKey(sale),
    saleNumber: sale.saleNumber || sale.number || '',
    invoiceNumber: options.invoiceNumber || nextLocalInvoiceNumber(),
    invoiceType: 'fullTaxInvoice',
    runningNumberType: 'TAX',
    runningNumberStatus: options.runningNumberStatus || 'local_only',
    counterVersion: options.counterVersion || '',
    counterReserved: Boolean(options.counterReserved),
    dateKey,
    monthKey: monthKeyFrom(issuedAt),
    status: 'issued',
    issuedAt,
    seller: store,
    buyer,
    items: Array.isArray(sale.items) ? sale.items : [],
    subtotal: moneyNumber(sale.subtotal),
    discount: moneyNumber(sale.discount),
    pointDiscount: moneyNumber(sale.pointDiscount),
    beforeVat,
    vatRate,
    vatAmount,
    vatMode: String(sale.vatMode || 'include') === 'exclude' ? 'exclude' : 'include',
    totalAmount: total,
    paymentMethod: sale.paymentMethod || sale.payment?.method || '',
    sourceSale: {
      id: sale.id || '',
      saleNumber: sale.saleNumber || sale.number || '',
      createdAt: sale.createdAt || null
    }
  };
}

function saleFromInvoice(invoice = {}) {
  return {
    id: invoice.saleId || invoice.sourceSale?.id || '',
    saleNumber: invoice.saleNumber || invoice.sourceSale?.saleNumber || '',
    number: invoice.saleNumber || invoice.sourceSale?.saleNumber || '',
    createdAt: invoice.sourceSale?.createdAt || invoice.issuedAt || invoice.createdAt || null,
    items: Array.isArray(invoice.items) ? invoice.items : [],
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    pointDiscount: invoice.pointDiscount,
    beforeVat: invoice.beforeVat,
    taxableBase: invoice.beforeVat,
    vatRate: invoice.vatRate,
    vatAmount: invoice.vatAmount,
    vatMode: invoice.vatMode,
    totalAmount: invoice.totalAmount,
    total: invoice.totalAmount,
    paymentMethod: invoice.paymentMethod
  };
}

function validateVoidTargetInvoice(current = {}, requested = {}, tenantId = getTenantId()) {
  if (current.tenantId && current.tenantId !== tenantId) {
    throw taxVoidValidationError('ใบกำกับภาษีนี้ไม่อยู่ในร้านปัจจุบัน');
  }
  const requestedInvoiceNumber = normalizeText(requested.invoiceNumber);
  const currentInvoiceNumber = normalizeText(current.invoiceNumber);
  if (requestedInvoiceNumber && currentInvoiceNumber && requestedInvoiceNumber !== currentInvoiceNumber) {
    throw taxVoidValidationError('เลขที่ใบกำกับภาษีไม่ตรงกับเอกสารบนระบบ');
  }
  const requestedSale = saleFromInvoice(requested);
  const currentSale = saleFromInvoice(current);
  if (saleKey(requestedSale) && saleKey(currentSale) && !invoiceMatchesSale(current, requestedSale)) {
    throw taxVoidValidationError('ข้อมูลบิลต้นทางไม่ตรงกับใบกำกับภาษีบนระบบ');
  }
}

async function createInvoiceOnline(sale, buyer) {
  if (!isFirebaseConfigured || !db || navigator.onLine === false) return null;
  const tenantId = getTenantId();
  const userId = auth?.currentUser?.uid || '';
  const issuedAt = Date.now();
  const invoiceId = `tax-${saleKey(sale) || issuedAt}`;
  const invoiceRef = tenantDoc(TAX_INVOICE_COLLECTION, invoiceId, tenantId);
  let committed = null;
  try {
    await runTransaction(db, async transaction => {
      const invoiceSnapshot = await transaction.get(invoiceRef);
      if (invoiceSnapshot.exists()) {
        committed = { ...invoiceSnapshot.data(), id: invoiceSnapshot.data()?.id || invoiceSnapshot.id, _documentId: invoiceSnapshot.id };
        return;
      }
      const reserved = await reserveRunningNumber(transaction, db, { type: 'TAX', value: issuedAt, tenantId, documentId: invoiceId, userId });
      const invoice = buildInvoiceFromSale(sale, buyer, {
        issuedAt,
        invoiceNumber: reserved.documentNumber,
        runningNumberStatus: 'reserved',
        counterVersion: POS_COUNTER_VERSION,
        counterReserved: true
      });
      committed = invoice;
      transaction.set(invoiceRef, { ...invoice, createdBy: userId, updatedBy: userId, createdAtServer: serverTimestamp(), updatedAtServer: serverTimestamp() }, { merge: true });
    });
  } catch (error) {
    console.warn('[retail-pos-full-tax-invoice] transaction fallback', error);
    return null;
  }
  if (committed) saveLocalInvoice(committed);
  return committed;
}

async function getExistingInvoiceOnlineForSale(sale) {
  if (!isFirebaseConfigured || !db || navigator.onLine === false) return null;
  const candidateIds = [...new Set([saleKey(sale), sale.id, sale.saleNumber, sale.number].filter(Boolean).map(value => `tax-${value}`))];
  for (const id of candidateIds) {
    const invoice = await getRecord(TAX_INVOICE_COLLECTION, id);
    if (invoice && invoiceMatchesSale(invoice, sale)) {
      saveLocalInvoice(invoice);
      return invoice;
    }
  }
  try {
    const rows = await listRecords(TAX_INVOICE_COLLECTION, { sortBy: 'issuedAt', direction: 'desc' });
    const invoice = rows.find(row => invoiceMatchesSale(row, sale)) || null;
    if (invoice) saveLocalInvoice(invoice);
    return invoice;
  } catch (error) {
    console.warn('[retail-pos-full-tax-invoice] existing invoice lookup failed', error);
    return null;
  }
}

async function runPendingTaxInvoiceSync() {
  if (!isFirebaseConfigured || !db || navigator.onLine === false) return [];
  const rows = listLocalInvoices();
  const synced = [];
  const pendingCreates = rows.filter(invoice => {
    const status = String(invoice.syncStatus || '');
    return invoice.status !== 'void'
      && ['pending_create', 'local_only'].includes(status)
      && saleKey(saleFromInvoice(invoice));
  });
  for (const invoice of pendingCreates) {
    try {
      const sale = saleFromInvoice(invoice);
      const buyer = normalizeBuyer(invoice.buyer || defaultBuyerFromSale(sale));
      if (!buyer.buyerName) {
        markLocalInvoiceSyncError(invoice, 'MISSING_BUYER_NAME');
        continue;
      }
      const existing = await getExistingInvoiceOnlineForSale(sale);
      if (existing) {
        synced.push(existing);
        continue;
      }
      const online = await createInvoiceOnline(sale, buyer);
      if (online) synced.push(online);
      else markLocalInvoiceSyncError(invoice, 'CREATE_ONLINE_FAILED');
    } catch (error) {
      markLocalInvoiceSyncError(invoice, error);
      console.warn('[retail-pos-full-tax-invoice] pending create sync skipped', error);
    }
  }
  const pendingVoids = listLocalInvoices().filter(invoice => {
    const status = String(invoice.syncStatus || '');
    return invoice.status === 'void' && ['pending_void', 'local_void'].includes(status);
  });
  for (const invoice of pendingVoids) {
    try {
      const sale = saleFromInvoice(invoice);
      let targetInvoice = await getExistingInvoiceOnlineForSale(sale);
      if (!targetInvoice && saleKey(sale)) {
        const buyer = normalizeBuyer(invoice.buyer || defaultBuyerFromSale(sale));
        if (buyer.buyerName) targetInvoice = await createInvoiceOnline(sale, buyer);
      }
      const voided = await voidFullTaxInvoice(targetInvoice || invoice, invoice.voidReason || 'sync pending void');
      if (voided && !['pending_void', 'local_void'].includes(String(voided.syncStatus || ''))) synced.push(voided);
      else markLocalInvoiceSyncError(invoice, 'VOID_ONLINE_FAILED');
    } catch (error) {
      markLocalInvoiceSyncError(invoice, error);
      console.warn('[retail-pos-full-tax-invoice] pending void sync skipped', error);
    }
  }
  return synced;
}

export async function syncPendingTaxInvoices() {
  if (pendingTaxInvoiceSyncPromise) return pendingTaxInvoiceSyncPromise;
  pendingTaxInvoiceSyncPromise = runPendingTaxInvoiceSync().finally(() => {
    pendingTaxInvoiceSyncPromise = null;
  });
  return pendingTaxInvoiceSyncPromise;
}

export function getExistingFullTaxInvoiceForSale(sale) {
  return existingInvoiceForSale(sale);
}

export function listTaxBuyerProfiles() {
  return listBuyerProfiles().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

export async function syncTaxBuyerProfiles() {
  const local = listBuyerProfileRows({ includeDeleted: true });
  if (!isFirebaseConfigured || !db || navigator.onLine === false) return local;
  try {
    const remote = await listRecords(TAX_BUYER_PROFILE_COLLECTION, { sortBy: 'updatedAt', direction: 'desc' });
    const merged = mergeBuyerProfiles(local, remote);
    writeTenantBuyerProfiles(merged);
    await Promise.all(merged.map(profile => {
      if (isDeletedBuyerProfile(profile)) {
        return deleteRecord(TAX_BUYER_PROFILE_COLLECTION, profile.id).catch(error => {
          console.warn('[retail-pos-full-tax-invoice] sync delete tax buyer profile failed', profile.id, error);
        });
      }
      return saveRecord(TAX_BUYER_PROFILE_COLLECTION, profile).catch(error => {
        console.warn('[retail-pos-full-tax-invoice] sync tax buyer profile failed', profile.id, error);
      });
    }));
    return listTaxBuyerProfiles();
  } catch (error) {
    console.warn('[retail-pos-full-tax-invoice] tax buyer profile sync fallback', error);
    return local;
  }
}

export function saveTaxBuyerProfile(profile) {
  return writeBuyerProfile(profile);
}

export function deleteTaxBuyerProfile(id) {
  return removeBuyerProfile(id);
}

export async function voidFullTaxInvoice(invoiceInput, reason = '') {
  const invoiceId = String(invoiceInput?.id || invoiceInput?._documentId || invoiceInput?.invoiceNumber || '').trim();
  if (!invoiceId) throw new Error('ไม่พบรหัสใบกำกับภาษี');
  const tenantId = getTenantId();
  const userId = auth?.currentUser?.uid || '';
  const voidedAt = Date.now();
  const voidReason = normalizeText(reason);
  let committed = null;
  let transactionError = null;
  if (isFirebaseConfigured && db && navigator.onLine !== false) {
    const invoiceRef = tenantDoc(TAX_INVOICE_COLLECTION, invoiceId, tenantId);
    try {
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(invoiceRef);
        if (!snapshot.exists()) throw new Error('ไม่พบใบกำกับภาษี');
        const current = { ...snapshot.data(), id: snapshot.data()?.id || snapshot.id, _documentId: snapshot.id };
        validateVoidTargetInvoice(current, invoiceInput, tenantId);
        if (current.status === 'void') {
          committed = current;
          return;
        }
        committed = { ...current, status: 'void', voidedAt, voidReason, voidedBy: userId, updatedAt: voidedAt };
        transaction.set(invoiceRef, {
          status: 'void',
          voidedAt,
          voidReason,
          voidedBy: userId,
          updatedAt: voidedAt,
          updatedBy: userId,
          updatedAtServer: serverTimestamp()
        }, { merge: true });
      });
    } catch (error) {
      if (error?.code === 'TAX_VOID_VALIDATION_FAILED') throw error;
      transactionError = error;
      console.warn('[retail-pos-full-tax-invoice] void transaction fallback', error);
    }
  }
  if (!committed) {
    committed = updateLocalInvoice({
      id: invoiceInput.id || invoiceId,
      invoiceNumber: invoiceInput.invoiceNumber || '',
      status: 'void',
      voidedAt,
      voidReason,
      voidedBy: userId,
      syncStatus: navigator.onLine === false ? 'pending_void' : 'local_void',
      syncError: transactionError ? syncErrorMessage(transactionError) : '',
      syncErrorAt: transactionError ? Date.now() : null,
      syncAttemptedAt: transactionError ? Date.now() : null,
      syncAttemptCount: transactionError ? Number(invoiceInput.syncAttemptCount || 0) + 1 : Number(invoiceInput.syncAttemptCount || 0)
    });
    return committed;
  }
  saveLocalInvoice(committed);
  return committed;
}

export async function createFullTaxInvoiceFromSale(sale, buyerInput) {
  if (!sale) throw new Error('ไม่พบข้อมูลบิล');
  if (isFirebaseConfigured && db && navigator.onLine !== false) {
    await syncPendingTaxInvoices();
  }
  const existing = existingInvoiceForSale(sale);
  if (existing) return existing;
  const onlineExisting = await getExistingInvoiceOnlineForSale(sale);
  if (onlineExisting) return onlineExisting;
  const buyer = normalizeBuyer(buyerInput || defaultBuyerFromSale(sale));
  if (!buyer.buyerName) throw new Error('กรุณาระบุชื่อลูกค้า / บริษัท');
  const onlineInvoice = await createInvoiceOnline(sale, buyer);
  if (onlineInvoice) {
    saveBuyerProfile(sale, buyer);
    return onlineInvoice;
  }
  const invoice = buildInvoiceFromSale(sale, buyer);
  invoice.syncStatus = navigator.onLine === false ? 'pending_create' : 'local_only';
  saveBuyerProfile(sale, buyer);
  saveLocalInvoice(invoice);
  return invoice;
}

export function taxInvoiceUrl(invoice, { autoPrint = false } = {}) {
  const id = encodeURIComponent(invoice?.id || invoice?.invoiceNumber || '');
  return `/pos/tax-invoice/?invoiceId=${id}&auto=${autoPrint ? '1' : '0'}`;
}
