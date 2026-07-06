const { onRequest } = require('firebase-functions/v2/https');

const DBD_OPENAPI_BASE = 'https://openapi.dbd.go.th/api/v1/juristic_person';

function cleanTaxId(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function pick(source = {}, keys = []) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function flattenAddress(source = {}) {
  const direct = pick(source, ['buyerAddress', 'address', 'addressTh', 'address_th', 'location', 'fullAddress']);
  if (direct) return cleanText(direct);
  const parts = [
    pick(source, ['houseNo', 'house_no', 'addressNo', 'buildingNo']),
    pick(source, ['moo']),
    pick(source, ['soi']),
    pick(source, ['road', 'street']),
    pick(source, ['subDistrict', 'subdistrict', 'tambon', 'districtSub']),
    pick(source, ['district', 'amphur', 'amphoe']),
    pick(source, ['province']),
    pick(source, ['postcode', 'postalCode', 'zipCode'])
  ].filter(Boolean);
  return cleanText(parts.join(' '));
}

function normalize(data = {}, taxId = '') {
  const source = data.data || data.result || data.profile || data.juristic_person || data.juristicPerson || data;
  const buyerTaxId = cleanTaxId(pick(source, [
    'buyerTaxId', 'taxId', 'tax_id', 'juristicId', 'juristic_id', 'juristicPersonId',
    'juristic_person_id', 'registrationNo', 'registration_no', 'id'
  ]) || taxId);
  const buyerName = cleanText(pick(source, [
    'buyerName', 'name', 'companyName', 'company_name', 'juristicNameTH', 'juristicNameTh',
    'juristic_name_th', 'juristicPersonNameTH', 'juristic_person_name_th', 'nameTh'
  ]));
  const buyerAddress = flattenAddress(source);
  const buyerBranchName = cleanText(pick(source, [
    'buyerBranchName', 'branchName', 'branch_name', 'branch', 'branchNo', 'branch_no'
  ]) || 'สำนักงานใหญ่') || 'สำนักงานใหญ่';
  return { buyerTaxId, buyerName, buyerAddress, buyerBranchName };
}

async function lookupFromDbdOpenApi(taxId) {
  const url = `${DBD_OPENAPI_BASE}/${encodeURIComponent(taxId)}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'FoodOrderApp/1.0 (+https://natchanon-food-order-delivery.web.app)'
    }
  });
  const rawText = await response.text();
  if (!response.ok) throw new Error(`DBD OpenAPI returned ${response.status}`);
  let payload;
  try { payload = rawText ? JSON.parse(rawText) : {}; }
  catch { throw new Error('DBD OpenAPI returned non-JSON data'); }
  return normalize(payload, taxId);
}

async function lookupFromAdapter(taxId) {
  const baseUrl = process.env.TAX_BUYER_LOOKUP_URL;
  if (!baseUrl) return null;
  const url = new URL(baseUrl);
  url.searchParams.set('taxId', taxId);
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`lookup adapter returned ${response.status}`);
  return normalize(await response.json(), taxId);
}

exports.lookupTaxBuyer = onRequest(
  { region: 'asia-southeast1', timeoutSeconds: 20, memory: '256MiB' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

    const taxId = cleanTaxId(req.query.taxId || req.query.id || '');
    if (taxId.length !== 13) return res.status(400).json({ ok: false, error: 'invalid-tax-id' });

    try {
      let data = null;
      try { data = await lookupFromDbdOpenApi(taxId); }
      catch (openApiError) {
        console.warn('DBD OpenAPI lookup failed, trying adapter', { taxId, error: openApiError.message });
        data = await lookupFromAdapter(taxId);
      }
      if (!data || (!data.buyerName && !data.buyerAddress)) {
        return res.status(404).json({ ok: false, error: 'not-found', taxId });
      }
      return res.json({ ok: true, taxId, data });
    } catch (error) {
      return res.status(502).json({ ok: false, error: 'lookup-failed', message: error.message, taxId });
    }
  }
);
