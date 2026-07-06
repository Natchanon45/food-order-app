const { onRequest } = require('firebase-functions/v2/https');

const DBD_OPENAPI_BASE = 'https://openapi.dbd.go.th/api/v1/juristic_person';
const CD = 'cd' + ':';
const CR = 'cr' + ':';
const TD = 'td' + ':';

function cleanTaxId(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isScalar(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function pick(source = {}, keys = []) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && isScalar(value) && String(value).trim()) return String(value).trim();
  }
  return '';
}

function deepPick(value, keys = [], depth = 0) {
  if (!value || depth > 8) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepPick(item, keys, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const direct = pick(value, keys);
  if (direct) return direct;
  for (const item of Object.values(value)) {
    const found = deepPick(item, keys, depth + 1);
    if (found) return found;
  }
  return '';
}

function rootPayload(data = {}) {
  return data.data ?? data.result ?? data.results ?? data.profile ?? data.juristic_person ?? data.juristicPerson ?? data;
}

function candidateObjects(value, output = []) {
  if (!value || output.length > 80) return output;
  if (Array.isArray(value)) value.forEach(item => candidateObjects(item, output));
  else if (typeof value === 'object') {
    output.push(value);
    Object.values(value).forEach(item => candidateObjects(item, output));
  }
  return output;
}

const TAX_ID_KEYS = ['buyerTaxId', 'taxId', 'juristicId', 'juristic_id', 'juristicPersonId', 'juristic_person_id', 'registrationNo', 'id', CD + 'OrganizationJuristicID'];
const NAME_KEYS = ['buyerName', 'name', 'companyName', 'juristicNameTH', 'juristic_name_th', 'juristicPersonNameTH', 'juristic_person_name_th', 'nameTh', CD + 'OrganizationJuristicNameTH'];
const ADDRESS_KEYS = ['buyerAddress', 'addressTh', 'fullAddress', 'juristic_person_address'];
const BRANCH_KEYS = ['buyerBranchName', 'branchName', 'branch', TD + 'OrganizationJuristicBranchName'];
const ADDRESS_NO_KEYS = [CD + 'AddressNo', 'addressNo', 'houseNo'];
const MOO_KEYS = [CD + 'Moo', 'moo'];
const SOI_KEYS = [CD + 'Soi', 'soi'];
const ROAD_KEYS = [CD + 'Road', 'road'];
const SUB_DISTRICT_KEYS = [CR + 'CitySubDivisionTextTH', 'subDistrict', 'tambon'];
const DISTRICT_KEYS = [CR + 'CityTextTH', 'district', 'amphoe'];
const PROVINCE_KEYS = [CR + 'CountrySubDivisionTextTH', 'province'];
const POSTCODE_KEYS = [CD + 'PostCode', 'postcode', 'postalCode', 'zipCode'];

function scoreCandidate(source = {}, taxId = '') {
  const blob = JSON.stringify(source || '');
  return (blob.includes(taxId) ? 10 : 0) + (pick(source, TAX_ID_KEYS) ? 7 : 0) + (nameFromSource(source) ? 5 : 0) + (addressFromSource(source) ? 4 : 0);
}

function bestSource(data = {}, taxId = '') {
  return candidateObjects(rootPayload(data)).sort((a, b) => scoreCandidate(b, taxId) - scoreCandidate(a, taxId))[0] || {};
}

function dbdAddressSource(source = {}) {
  if (source.address && typeof source.address === 'object') return source.address;
  const address = source[CD + 'OrganizationJuristicAddress'];
  if (!address || typeof address !== 'object') return null;
  return address[CR + 'AddressType'] || address;
}

function dbdCapitalSource(source = {}) {
  const capital = source[TD + 'JuristicOrganizationRegisterCapital'];
  return capital && typeof capital === 'object' ? capital : null;
}

function nameFromSource(source = {}) {
  if (source.name && typeof source.name === 'object') return cleanText(source.name.th || source.name.TH || source.name.en || '');
  return cleanText(pick(source, NAME_KEYS));
}

function joinAddressParts(parts = []) {
  const cleaned = parts.map(cleanText).filter(Boolean);
  return cleanText([...new Set(cleaned)].join(' '));
}

function addressPart(src, keys) {
  return pick(src, keys) || deepPick(src, keys);
}

function addressFromSource(source = {}) {
  const src = dbdAddressSource(source) || source;
  const explicitFull = addressPart(src, ['full', 'Full', 'addressFull', 'address_full']);
  if (explicitFull) return cleanText(explicitFull);

  const dbdBase = addressPart(src, [CD + 'Address']);
  if (dbdBase) {
    return joinAddressParts([
      dbdBase,
      addressPart(src, SUB_DISTRICT_KEYS),
      addressPart(src, DISTRICT_KEYS),
      addressPart(src, PROVINCE_KEYS),
      addressPart(src, POSTCODE_KEYS)
    ]);
  }

  const direct = pick(src, ADDRESS_KEYS) || pick(source, ADDRESS_KEYS);
  if (direct) return cleanText(direct);

  return joinAddressParts([
    addressPart(src, ADDRESS_NO_KEYS),
    addressPart(src, MOO_KEYS),
    addressPart(src, SOI_KEYS),
    addressPart(src, ROAD_KEYS),
    addressPart(src, SUB_DISTRICT_KEYS),
    addressPart(src, DISTRICT_KEYS),
    addressPart(src, PROVINCE_KEYS),
    addressPart(src, POSTCODE_KEYS)
  ]);
}

function normalize(data = {}, taxId = '') {
  const source = bestSource(data, taxId);
  const capital = dbdCapitalSource(source) || {};
  const buyerTaxId = cleanTaxId(pick(source, TAX_ID_KEYS) || taxId);
  const buyerName = nameFromSource(source);
  const buyerAddress = addressFromSource(source);
  const buyerBranchName = cleanText(pick(capital, BRANCH_KEYS) || pick(source, BRANCH_KEYS) || 'สำนักงานใหญ่') || 'สำนักงานใหญ่';
  return { buyerTaxId, buyerName, buyerAddress, buyerBranchName };
}

function safeDebugPayload(payload, rawText, normalized) {
  const root = rootPayload(payload);
  const source = bestSource(payload, normalized.buyerTaxId);
  const addressSource = dbdAddressSource(source) || source;
  return {
    rootType: Array.isArray(root) ? 'array' : typeof root,
    topKeys: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 30) : [],
    sourceKeys: source && typeof source === 'object' ? Object.keys(source).slice(0, 80) : [],
    addressKeys: addressSource && typeof addressSource === 'object' ? Object.keys(addressSource).slice(0, 80) : [],
    addressProbe: {
      base: addressPart(addressSource, [CD + 'Address']),
      subDistrict: addressPart(addressSource, SUB_DISTRICT_KEYS),
      district: addressPart(addressSource, DISTRICT_KEYS),
      province: addressPart(addressSource, PROVINCE_KEYS),
      postcode: addressPart(addressSource, POSTCODE_KEYS)
    },
    normalized,
    rawPreview: String(rawText || '').slice(0, 1600)
  };
}

async function lookupFromDbdOpenApi(taxId, debug = false) {
  const url = `${DBD_OPENAPI_BASE}/${encodeURIComponent(taxId)}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const rawText = await response.text();
  const meta = { url, status: response.status, ok: response.ok, contentType: response.headers.get('content-type') || '' };
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
        const adapterData = await lookupFromAdapter(taxId);
        result = { normalized: adapterData, debug: debug ? { openApiError: openApiError.debug || openApiError.message, adapterUsed: true } : undefined };
      }
      const data = result?.normalized;
      if (!data || (!data.buyerName && !data.buyerAddress)) return res.status(404).json({ ok: false, error: 'not-found', taxId, debug: debug ? result?.debug : undefined });
      return res.json({ ok: true, taxId, data, debug: debug ? result?.debug : undefined });
    } catch (error) {
      return res.status(502).json({ ok: false, error: 'lookup-failed', message: error.message, taxId, debug: debug ? error.debug : undefined });
    }
  }
);
