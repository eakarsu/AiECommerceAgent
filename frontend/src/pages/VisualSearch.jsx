import { useState } from 'react';
import { apiPost } from '../services/api';

export default function VisualSearch() {
  const [imageDescription, setImageDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await apiPost('/ai/visual-search', {
        image_description: imageDescription,
        image_url: imageUrl,
        top_k: parseInt(topK, 10) || 10,
      });
      setResult(r);
    } catch (err) {
      setError(err.message || 'Visual search failed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Visual Search</h1>
      </div>

      <div className="card p-6 space-y-3">
        <p className="text-sm text-gray-500">
          Stub mode: deterministic in-memory embedding (no pgvector / CLIP). Production should swap in OpenAI/Cohere embeddings.
        </p>
        <form onSubmit={run} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Image description</label>
            <textarea className="input" rows={2} value={imageDescription} onChange={e => setImageDescription(e.target.value)} placeholder="Describe the image you'd like to match..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Or image URL</label>
            <input className="input" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
          </div>
          <div className="flex gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Top-K</label>
              <input className="input" type="number" min={1} max={50} value={topK} onChange={e => setTopK(e.target.value)} style={{ width: 100 }} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading || (!imageDescription && !imageUrl)}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {error && <div className="card p-3 text-red-600">{error}</div>}

      {result && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-3">Results {result.stub && <span className="text-xs text-gray-500">(stub)</span>}</h2>
          {result.note && <p className="text-xs text-gray-500 mb-3">{result.note}</p>}
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Score</th></tr></thead>
            <tbody>
              {(result.results || []).map(r => (
                <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.category}</td><td>{r.price}</td><td>{(r.score || 0).toFixed(3)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
