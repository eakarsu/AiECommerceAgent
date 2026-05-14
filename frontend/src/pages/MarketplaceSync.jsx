import { useState } from 'react';
import { apiPost } from '../services/api';

export default function MarketplaceSync() {
  const [marketplace, setMarketplace] = useState('shopify');
  const [direction, setDirection] = useState('push');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await apiPost('/integrations/marketplace-sync', { marketplace, direction });
      setResult(r);
    } catch (err) {
      const missing = err?.data?.missing ? ` (missing: ${err.data.missing})` : '';
      setError((err.message || 'Marketplace sync failed.') + missing);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Marketplace Sync</h1>
      </div>

      <div className="card p-6 space-y-3">
        <p className="text-sm text-gray-500">
          Requires per-marketplace credentials: Shopify (SHOPIFY_ACCESS_TOKEN), Amazon (AMAZON_SP_API_KEY), eBay (EBAY_OAUTH_TOKEN).
        </p>
        <form onSubmit={run} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Marketplace</label>
            <select className="input" value={marketplace} onChange={e => setMarketplace(e.target.value)}>
              <option value="shopify">Shopify</option>
              <option value="amazon">Amazon</option>
              <option value="ebay">eBay</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Direction</label>
            <select className="input" value={direction} onChange={e => setDirection(e.target.value)}>
              <option value="push">Push catalog out</option>
              <option value="pull">Pull catalog in</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Syncing...' : 'Run Sync'}
          </button>
        </form>
      </div>

      {error && <div className="card p-3 text-red-600">{error}</div>}

      {result && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-3">Result {result.stub && <span className="text-xs text-gray-500">(stub)</span>}</h2>
          {result.note && <p className="text-xs text-gray-500 mb-3">{result.note}</p>}
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
