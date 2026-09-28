import { useEffect, useState } from 'react';
import { PriceElasticityApi, apiGet } from '../services/api';
import ScenarioButtons from '../components/ScenarioButtons';

export const PriceElasticity = () => {
  const [tests, setTests] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1 });

  const load = async () => {
    setLoading(true);
    try {
      const r = await PriceElasticityApi.list({ page, limit: 20 });
      setTests(r.data || []);
      setPagination(r.pagination || {});
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { apiGet('/products', { limit: 100 }).then((r) => setProducts(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [page]);

  const start = async () => {
    if (!productId) return;
    try { await PriceElasticityApi.start(parseInt(productId)); load(); } catch (e) { alert(e.message); }
  };

  const recordEvent = async (id, variant, type) => {
    try { await PriceElasticityApi.recordEvent(id, variant, type); load(); } catch (e) { alert(e.message); }
  };

  const conclude = async (id) => {
    try { await PriceElasticityApi.conclude(id); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Price Elasticity Tester</h1>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-3">Start Test (AI proposes 2 variants)</h2>
        <ScenarioButtons className="mb-4" disabled={!products.length} scenarios={[
          {label:'Core Product',tone:'standard',values:{productId:products[0]?.id}},
          {label:'Margin Pressure',tone:'risk',values:{productId:products[1]?.id||products[0]?.id}},
          {label:'Low-Volume Exception',tone:'exception',values:{productId:products.at(-1)?.id}},
        ]} onApply={values=>setProductId(String(values.productId||''))} onClear={()=>setProductId('')} />
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Product</label>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">-- Select product --</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={start} disabled={!productId}>Start AI Test</button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-3">Active & Past Tests</h2>
        {loading ? <p>Loading...</p> : tests.length === 0 ? <p className="text-gray-500">No tests yet.</p> : (
          <div className="space-y-3">
            {tests.map((t) => (
              <div key={t.id} className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div><strong>{t.Product?.name || `Product ${t.productId}`}</strong> <span className="text-xs text-gray-500">#{t.id} • {t.status}</span></div>
                  {t.status === 'running' && <button className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded" onClick={() => conclude(t.id)}>Conclude</button>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="font-bold">A: ${t.variant_a_price}</div>
                    <div>Views: {t.variant_a_views} | Conv: {t.variant_a_conversions} ({t.conv_rate_a}%)</div>
                    {t.status === 'running' && (
                      <div className="mt-2 flex gap-2">
                        <button className="text-xs px-2 py-1 bg-white rounded" onClick={() => recordEvent(t.id, 'a', 'view')}>+ View</button>
                        <button className="text-xs px-2 py-1 bg-white rounded" onClick={() => recordEvent(t.id, 'a', 'conversion')}>+ Conv</button>
                      </div>
                    )}
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="font-bold">B: ${t.variant_b_price}</div>
                    <div>Views: {t.variant_b_views} | Conv: {t.variant_b_conversions} ({t.conv_rate_b}%)</div>
                    {t.status === 'running' && (
                      <div className="mt-2 flex gap-2">
                        <button className="text-xs px-2 py-1 bg-white rounded" onClick={() => recordEvent(t.id, 'b', 'view')}>+ View</button>
                        <button className="text-xs px-2 py-1 bg-white rounded" onClick={() => recordEvent(t.id, 'b', 'conversion')}>+ Conv</button>
                      </div>
                    )}
                  </div>
                </div>
                {t.ai_proposal?.hypothesis && <div className="mt-2 text-xs text-gray-600"><em>AI Hypothesis:</em> {t.ai_proposal.hypothesis}</div>}
                {t.winner && <div className="mt-2 text-sm font-bold text-purple-700">Winner: Variant {t.winner.toUpperCase()}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceElasticity;
