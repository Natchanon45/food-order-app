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

function rootPayload(data = {}) {
  return data.data ?? data.result ?? data.results ?? data.profile ?? data.juristic_person ?? data.juristicPerson ?? data;
}

function candidateObjects(value, output = []) {
  if (!value || output.length > 40) return output;
  if (Array.isArray(value)) {
    value.forEach(item => candidateObjects(item, output));
    return output;
  }
  if (typeof value === 'object') {
    output.push(value);
    Object.values(value).forEach(item => candidateObjects(item, output));
  }
  return output;
}

function scoreCandidate(source = {}, taxId = '') {
  const blob = JSON.stringify(source || '');
  let score = 0;
  if (blob.includes(taxId)) score += 10;
  if (pick(source, TAX_ID_KEYS)) score += 7;
  if (pick(source, NAME_KEYS)) score += 5;
  if (pick(source, ADDRESS_KEYS)) score += 4;
  if (pick(source, BRANCH_KEYS)) score += 1;
  return score;
}

function bestSource(data = {}, taxId = '') {
  const root = rootPayload(data);
  const candidates = candidateObjects(root);
  if (!candidates.length && root && typeof root === 'object') return root;
  return candidates.sort((a, b) => scoreCandidate(b, taxId) - scoreCandidate(a, taxId))[0] || {};
}

const TAX_ID_KEYS = [
  'buyerTaxId', 'taxId', 'tax_id', 'juristicId', 'juristic_id', 'juristicID',
  'juristicPersonId', 'juristic_person_id', 'juristic_person_no', 'juristicNo',
  'registrationNo', 'registration_no', 'id'
];

const NAME_KEYS = [
  'buyerName', 'name', 'companyName', 'company_name', 'juristicNameTH', 'juristicNameTh',
  'juristic_name_th', 'juristicPersonNameTH', 'juristic_person_name_th', 'juristic_person_name',
  'juristicName', 'juristic_name', 'nameTh', 'titleName'
];

const ADDRESS_KEYS = [
  'buyerAddress', 'address', 'addressTh', 'address_th', 'location', 'fullAddress',
  'juristicPersonAddress', 'juristic_person_address', 'juristic_address', 'addressDetail'
];

const BRANCH_KEYS = ['buyerBranchName', 'branchName', 'branch_name', 'branch', 'branchNo', 'branch_no'];

function flattenAddress(source = {}) {
  const direct = pick(source, ADDRESS_KEYS);
  if (direct) return cleanText(direct);
  const parts = [
    pick(source, ['houseNo', 'house_no', 'addressNo', 'address_no', 'buildingNo', 'building_no', 'roomNo']),
    pick(source, ['moo', 'villageNo', 'village_no']),
    pick(source, ['soi', 'soiName', 'soi_name']),
    pick(source, ['road', 'street', 'roadName', 'road_name']),
    pick(source, ['subDistrict', 'subdistrict', 'sub_district', 'tambon', 'districtSub']),
    pick(source, ['district', 'amphur', 'amphoe', 'districtName']),
    pick(source, ['province', 'provinceName']),
    pick(source, ['postcode', 'postalCode', 'zipCode'])
  ].filter(Boolean);
  return cleanText(parts.join(' '));
}

function normalize(data = {}, taxId = '') {
  const source = bestSource(data, taxId);
  const buyerTaxId = cleanTaxId(pick(source, TAX_ID_KEYS) || taxId);
  const buyerName = cleanText(pick(source, NAME_KEYS));
  const buyerAddress = flattenAddress(source);
  const buyerBranchName = cleanText(pick(source, BRANCH_KEYS) || 'สำนักงานใหญ่') || 'สำนักงานใหญ่';
  return { buyerTaxId, buyerName, buyerAddress, buyerBranchName };
}

function safeDebugPayload(payload, rawText, normalized) {
  const root = rootPayload(payload);
  const source = bestSource(payload, normalized.buyerTaxId);
  return {
    rootType: Array.isArray(root) ? 'array' : typeof root,
    topKeys: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 30) : [],
    sourceKeys: source && typeof source === 'object' ? Object.keys(source).slice(0, 60) : [],
    normalized,
    rawPreview: String(rawText || '').slice(0, 1200)
  };
}

async function lookupFromDbdOpenApi(taxId, debug = false) {
  const url = `${DBD_OPENAPI_BASE}/${encodeURIComponent(taxId)}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'FoodOrderApp/1.0 (+https://natchanon-food-order-delivery.web.app)'
    }
  });
  const rawText = await response.text();
  const meta = {
    url,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type') || ''
  };
  if (!response.ok) {
    const error = new Error(`DBD OpenAPI returned ${response.status}`);
    error.debug = { ...meta, rawPreview: rawText.slice(0, 1200) };
    throw error;
  }
  let payload;
  try { payload = rawText ? JSON.parse(rawText) : {}; }
  catch {
    const error = new Error('DBD OpenAPI returned non-JSON data');
    error.debug = { ...meta, rawPreview: rawText.slice(0, 1200) };
    throw error;
  }
  const normalized = normalize(payload, taxId);
  return debug ? { normalized, debug: { ...meta, ...safeDebugPayload(payload, rawText, normalized) } } : { normalized };
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
    const debug = String(req.query.debug || '') === '1';
    if (taxId.length !== 13) return res.status(400).json({ ok: false, error: 'invalid-tax-id' });

    try {
      let result = null;
      try { result = await lookupFromDbdOpenApi(taxId, debug); }
      catch (openApiError) {
        console.warn('DBD OpenAPI lookup failed, trying adapter', { taxId, error: openApiError.message });
        const adapterData = await lookupFromAdapter(taxId);
        result = { normalized: adapterData, debug: debug ? { openApiError: openApiError.debug || openApiError.message, adapterUsed: true } : undefined };
      }
      const data = result?.normalized;
      if (!data || (!data.buyerName && !data.buyerAddress)) {
        return res.status(404).json({ ok: false, error: 'not-found', taxId, debug: debug ? result?.debug : undefined });
      }
      return res.json({ ok: true, taxId, data, debug: debug ? result?.debug : undefined });
    } catch (error) {
      return res.status(502).json({ ok: false, error: 'lookup-failed', message: error.message, taxId, debug: debug ? error.debug : undefined });
    }
  }
);
