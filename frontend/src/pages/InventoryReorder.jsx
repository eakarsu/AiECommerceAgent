import { useEffect, useState } from 'react';
import { InventoryReorderApi, apiGet } from '../services/api';
import ScenarioButtons from '../components/ScenarioButtons';

export const InventoryReorder = () => {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [productId, setProductId] = useState('');
  const [leadTime, setLeadTime] = useState(14);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1 });

  const loadProducts = async () => {
    try {
      const r = await apiGet('/products', { limit: 100 });
      setProducts(r.data || []);
    } catch {}
  };

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const r = await InventoryReorderApi.list({ page, limit: 20 });
      setItems(r.data || []);
      setPagination(r.pagination || { totalPages: 1 });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { loadSuggestions(); }, [page]);

  const runPrediction = async () => {
    if (!productId) return;
    setRunning(true);
    try {
      await InventoryReorderApi.predict(parseInt(productId), parseInt(leadTime) || 14);
      await loadSuggestions();
    } catch (e) { alert(e.message); } finally { setRunning(false); }
  };

  const setStatus = async (id, status) => {
    try {
      await InventoryReorderApi.setStatus(id, status);
      loadSuggestions();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Predictive Inventory Reorder</h1>
      </div>

      <div className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Run Prediction</h2>
        <ScenarioButtons disabled={!products.length} scenarios={[
          {label:'Standard Replenishment',tone:'standard',values:{productId:products[0]?.id,leadTime:14}},
          {label:'Long Lead-Time Risk',tone:'risk',values:{productId:products[1]?.id||products[0]?.id,leadTime:45}},
          {label:'Urgent Stockout',tone:'exception',values:{productId:products.at(-1)?.id,leadTime:3}},
        ]} onApply={values=>{setProductId(String(values.productId||''));setLeadTime(values.leadTime);}} onClear={()=>{setProductId('');setLeadTime('');}} />
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Product</label>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">-- Select product --</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} (SKU {p.sku || p.id})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lead time (days)</label>
            <input type="number" className="input w-28" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={runPrediction} disabled={running || !productId}>
            {running ? 'Predicting...' : 'Predict & Reorder'}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-3">Suggestions</h2>
        {loading ? <p>Loading...</p> : items.length === 0 ? <p className="text-gray-500">No suggestions yet.</p> : (
          <table className="table-auto w-full">
            <thead><tr className="text-left text-sm text-gray-600">
              <th>ID</th><th>Product</th><th>Stock</th><th>Days to Stockout</th><th>Reorder Qty</th><th>Status</th><th>Created</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td>{it.id}</td>
                  <td>{it.Product?.name || it.productId}</td>
                  <td>{it.current_stock}</td>
                  <td>{it.predicted_days_to_stockout}</td>
                  <td>{it.recommended_qty}</td>
                  <td><span className="px-2 py-0.5 rounded text-xs bg-gray-100">{it.status}</span></td>
                  <td>{new Date(it.createdAt).toLocaleString()}</td>
                  <td className="space-x-1">
                    {it.status === 'pending' && (
                      <>
                        <button className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded" onClick={() => setStatus(it.id, 'approved')}>Approve</button>
                        <button className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded" onClick={() => setStatus(it.id, 'ordered')}>Order</button>
                        <button className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded" onClick={() => setStatus(it.id, 'cancelled')}>Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
            <span className="self-center text-sm">Page {page} of {pagination.totalPages}</span>
            <button className="btn btn-secondary" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryReorder;
