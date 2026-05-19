import React, { useEffect, useState } from 'react';

// VIZ 1: CSS grid of products with image, price, stock badge, bestseller chip.
// Data source: GET /api/custom-views/product-grid
export default function ProductGrid() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/product-grid?limit=24', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stockBadge = (s) => {
    if (s === 'out_of_stock') return { label: 'Out of Stock', bg: '#fee2e2', fg: '#991b1b' };
    if (s === 'low_stock') return { label: 'Low Stock', bg: '#fef3c7', fg: '#92400e' };
    return { label: 'In Stock', bg: '#dcfce7', fg: '#166534' };
  };

  if (loading) return <div style={{ padding: 16 }}>Loading product grid...</div>;
  if (error) return <div style={{ padding: 16, color: '#b91c1c' }}>Error: {error}</div>;

  return (
    <div data-testid="product-grid" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Product Grid ({items.length})
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {items.map((p) => {
          const sb = stockBadge(p.stockStatus);
          return (
            <div
              key={p.id}
              data-sku={p.sku}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#fff',
                position: 'relative',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {p.bestseller && (
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: '#facc15',
                    color: '#78350f',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  BESTSELLER
                </span>
              )}
              <img
                src={p.imageUrl}
                alt={p.name}
                onError={(e) => {
                  e.currentTarget.src = `https://picsum.photos/seed/p${p.id}/300/200`;
                }}
                style={{ width: '100%', height: 140, objectFit: 'cover', background: '#f3f4f6' }}
              />
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{p.sku}</div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, marginTop: 2 }}>
                  {p.name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 8,
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                    ${p.price.toFixed(2)}
                  </div>
                  <span
                    style={{
                      background: sb.bg,
                      color: sb.fg,
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {sb.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
