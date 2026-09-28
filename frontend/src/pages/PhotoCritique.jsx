import { useEffect, useState } from 'react';
import { PhotoCritiqueApi, apiGet } from '../services/api';
import ScenarioButtons from '../components/ScenarioButtons';

export const PhotoCritique = () => {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [productId, setProductId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [latest, setLatest] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1 });

  const load = async () => {
    setLoading(true);
    try {
      const r = await PhotoCritiqueApi.list({ page, limit: 20 });
      setItems(r.data || []);
      setPagination(r.pagination || {});
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { apiGet('/products', { limit: 100 }).then((r) => setProducts(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [page]);

  const submit = async () => {
    if (!imageUrl) return;
    setRunning(true);
    try {
      const r = await PhotoCritiqueApi.critique(productId ? parseInt(productId) : null, imageUrl);
      setLatest(r);
      load();
    } catch (e) { alert(e.message); } finally { setRunning(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Visual Product-Photo Critique</h1>

      <div className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Submit photo for AI critique</h2>
        <ScenarioButtons disabled={!products.length} scenarios={[
          {label:'Studio Photo',tone:'standard',values:{productId:products[0]?.id,imageUrl:'https://images.unsplash.com/photo-1523275335684-37898b6baf30'}},
          {label:'Conversion Risk',tone:'risk',values:{productId:products[1]?.id||products[0]?.id,imageUrl:'https://images.unsplash.com/photo-1560343090-f0409e92791a'}},
          {label:'Background Exception',tone:'exception',values:{productId:products.at(-1)?.id,imageUrl:'https://images.unsplash.com/photo-1542291026-7eec264c27ff'}},
        ]} onApply={values=>{setProductId(String(values.productId||''));setImageUrl(values.imageUrl);}} onClear={()=>{setProductId('');setImageUrl('');setLatest(null);}} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Product (optional)</label>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">-- None --</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <button className="btn btn-primary" onClick={submit} disabled={running || !imageUrl}>
          {running ? 'Analyzing...' : 'Critique Photo'}
        </button>
      </div>

      {latest?.ai_results && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-2">Latest Critique</h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="bg-blue-50 rounded p-3 text-center"><div className="text-2xl font-bold">{latest.ai_results.overall_score}</div><div className="text-xs">Overall</div></div>
            <div className="bg-yellow-50 rounded p-3 text-center"><div className="text-2xl font-bold">{latest.ai_results.lighting_score}</div><div className="text-xs">Lighting</div></div>
            <div className="bg-green-50 rounded p-3 text-center"><div className="text-2xl font-bold">{latest.ai_results.background_score}</div><div className="text-xs">Background</div></div>
            <div className="bg-purple-50 rounded p-3 text-center"><div className="text-2xl font-bold">{latest.ai_results.composition_score}</div><div className="text-xs">Composition</div></div>
          </div>
          <p className="text-sm">{latest.ai_results.summary}</p>
          {latest.ai_results.issues?.length > 0 && (
            <div className="mt-3"><strong>Issues:</strong><ul className="list-disc ml-5 text-sm">{latest.ai_results.issues.map((i, idx) => <li key={idx}>{i}</li>)}</ul></div>
          )}
          {latest.ai_results.improvements?.length > 0 && (
            <div className="mt-3"><strong>Improvements:</strong><ul className="list-disc ml-5 text-sm">{latest.ai_results.improvements.map((i, idx) => <li key={idx}>{i}</li>)}</ul></div>
          )}
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-3">Recent Critiques</h2>
        {loading ? <p>Loading...</p> : items.length === 0 ? <p className="text-gray-500">No critiques yet.</p> : (
          <table className="table-auto w-full">
            <thead><tr className="text-left text-sm text-gray-600"><th>ID</th><th>Product</th><th>Image</th><th>Score</th><th>When</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td>{it.id}</td>
                  <td>{it.Product?.name || '-'}</td>
                  <td><a href={it.image_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">view</a></td>
                  <td><strong>{it.overall_score || '-'}</strong></td>
                  <td className="text-xs">{new Date(it.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PhotoCritique;
