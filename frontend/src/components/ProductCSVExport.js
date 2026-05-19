import React, { useEffect, useState } from 'react';

// NON-VIZ 1: Category filter → text/csv download of products
// (sku, name, price, stock, category).
export default function ProductCSVExport() {
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    // Fetch the grid product list to derive available categories.
    fetch('/api/custom-views/product-grid?limit=100', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        const set = new Set();
        (d.items || []).forEach((p) => p.category && set.add(p.category));
        setCategories(Array.from(set).sort());
      })
      .catch(() => {});
  }, []);

  const download = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const qs = category ? `?category=${encodeURIComponent(category)}` : '';
      const res = await fetch(`/api/custom-views/product-csv${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products${category ? `-${category}` : ''}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded CSV${category ? ` for ${category}` : ''}.`);
    } catch (e) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="product-csv-export" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Product CSV Export</h3>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: '#fff',
          border: '1px solid #e5e7eb',
          padding: 16,
          borderRadius: 8,
        }}
      >
        <label style={{ fontSize: 14 }}>
          Category:&nbsp;
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={download}
          disabled={busy}
          style={{
            padding: '8px 16px',
            background: busy ? '#9ca3af' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: busy ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {busy ? 'Generating...' : 'Download CSV'}
        </button>
        {message && (
          <span style={{ fontSize: 13, color: message.startsWith('Error') ? '#b91c1c' : '#15803d' }}>
            {message}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
        Columns: sku, name, price, stock, category
      </p>
    </div>
  );
}
