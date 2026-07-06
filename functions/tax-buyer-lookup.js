const { onRequest } = require('firebase-functions/v2/https');

function cleanTaxId(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalize(data = {}, taxId = '') {
  const source = data.data || data.result || data.profile || data;
  return {
    buyerTaxId: cleanTaxId(source.buyerTaxId || source.taxId || source.juristicId || source.registrationNo || taxId),
    buyerName: cleanText(source.buyerName || source.name || source.companyName || source.juristicNameTH || ''),
    buyerAddress: cleanText(source.buyerAddress || source.address || source.addressTh || ''),
    buyerBranchName: cleanText(source.buyerBranchName || source.branchName || source.branch || 'สำนักงานใหญ่') || 'สำนักงานใหญ่'
  };
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
      const data = await lookupFromAdapter(taxId);
      if (!data || (!data.buyerName && !data.buyerAddress)) {
        return res.status(501).json({ ok: false, error: 'adapter-not-configured', taxId });
      }
      return res.json({ ok: true, taxId, data });
    } catch (error) {
      return res.status(502).json({ ok: false, error: 'lookup-failed', message: error.message, taxId });
    }
  }
);
